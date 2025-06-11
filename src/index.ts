import "reflect-metadata";
import dotenv from "dotenv";
import path from "path";

// Load the appropriate .env file based on NODE_ENV
if (process.env.NODE_ENV === 'test') {
  console.log('Loading test environment configuration');
  dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });
} else {
  console.log('Loading development environment configuration');
  dotenv.config();
}

import express from "express";
import { ApolloServer } from "apollo-server-express";
import { Container } from "typedi";
import { buildSchema } from "type-graphql";
import cookieParser from "cookie-parser";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core";
import { resolvers } from "./resolvers";
import authChecker from "./utils/authChecker";
import { verifyJwt } from "./utils/jwt";
import { v2 as cloudinary } from "cloudinary";
import { cloudinaryConfig } from "./config";
import multer from "multer";
import streamifier from "streamifier";
import cors from "cors";
import neo4jService from "./services/neo4j.service";
import Context from "./types/context";
import authenticateUser from "./authMiddleware";

const bootstrap = async () => {
  try {
    // Initialize Neo4j and verify connection
    console.log("Connecting to Neo4j database...");
    console.log("NEO4J_URI:", process.env.NEO4J_URI || "bolt://localhost:7687");
    console.log("NEO4J_USER:", process.env.NEO4J_USER ? "***" : "not set");

    const neo4jSession = await neo4jService.getSession();

    // Test the connection with better error handling
    try {
      console.log("Testing Neo4j connection...");
      const result = await neo4jSession.run("RETURN 1 as test");
      console.log("✅ Successfully connected to Neo4j database");
      console.log(
        "Connection test result:",
        JSON.stringify(result.records[0].toObject(), null, 2)
      );
    } catch (error) {
      console.error("❌ Failed to connect to Neo4j database");
      console.error("Error details:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        if (error.stack) {
          console.error("Stack trace:", error.stack);
        }
      }
      process.exit(1);
    } finally {
      try {
        await neo4jSession.close();
        console.log("Neo4j test session closed");
      } catch (closeError) {
        console.error("Error closing Neo4j session:", closeError);
      }
    }

    const schema = await buildSchema({
      resolvers,
      authChecker,
      dateScalarMode: "timestamp",
      container: Container,
    });

    const app = express();

    // Middleware
    app.use(
      cors({
        origin: ["http://localhost:3000", "https://studio.apollographql.com", process.env.FRONTEND_URL || "*"],
        credentials: true,
      })
    );

    app.use(cookieParser());
    app.use(express.json());

    // Cloudinary configuration
    cloudinary.config(cloudinaryConfig);

    // File upload endpoint
    const upload = multer({ storage: multer.memoryStorage() });

    app.post(
      "/upload",
      authenticateUser,
      upload.single("file"),
      async (req, res) => {
        if (!req.file) {
          console.error("File upload failed");
          return res.status(400).send("File upload failed.");
        }

        try {
          let folder;
          if (req.file.mimetype.startsWith("image")) folder = "images";
          else if (req.file.mimetype.startsWith("video")) folder = "videos";
          else folder = "files";

          const result = cloudinary.uploader.upload_stream(
            { resource_type: "auto", folder },
            (error, result) => {
              if (error) {
                console.error("Error uploading to Cloudinary:", error);
                return res.status(500).send("Error uploading to Cloudinary.");
              }
              return res.json({
                url: result!.secure_url,
                type: result!.resource_type,
              });
            }
          );

          streamifier.createReadStream(req.file.buffer).pipe(result);
        } catch (error) {
          console.error("Error handling file upload:", error);
          return res.status(500).send("Error handling file upload.");
        }
      }
    );

    // Create Apollo Server
    const server = new ApolloServer({
      schema,
      persistedQueries: false,
      introspection: true, // Enable introspection in all environments
      csrfPrevention: false, // Disable CSRF prevention for easier testing
      context: async ({ req, res }) => {
        // Get the user token from the headers or cookies
        const token =
          req.headers.authorization?.split(" ")[1] || req.cookies?.token;
        let user = null;

        if (token) {
          try {
            const decoded = verifyJwt(token);
            if (decoded) {
              // Get a fresh session for each request
              const session = await neo4jService.getSession();
              const userData = await session.run(
                "MATCH (u:User {id: $id}) RETURN u",
                { id: (decoded as any).id }
              );

              if (userData.records.length > 0) {
                user = userData.records[0].get("u").properties;
              }
              await session.close();
            }
          } catch (error) {
            console.error("Error verifying token:", error);
          }
        }

        return {
          req,
          res,
          user,
          neo4jSession: await neo4jService.getSession(),
        } as Context;
      },
      plugins: [
        ApolloServerPluginLandingPageGraphQLPlayground(),
        {
          async requestDidStart() {
            return {
              async willSendResponse(requestContext) {
                // Close the Neo4j session after each request
                await requestContext.context.neo4jSession.close();
              },
            };
          },
        },
      ],
    });

    await server.start();

    // Apply middleware
    server.applyMiddleware({
      app,
      cors: false, // We handle CORS manually
      path: '/graphql',
    });

    // Start the server
    const port = process.env.PORT || 4000;
    app.listen(port, () => {
      console.log(
        `Server is running on http://localhost:${port}${server.graphqlPath}`
      );
    });
  } catch (error) {
    console.error("Error bootstrapping server:", error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Handle process termination
process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Closing server...");
  await neo4jService.close();
  process.exit(0);
});

bootstrap();
