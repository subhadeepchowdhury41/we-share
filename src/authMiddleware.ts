import { NextFunction, Request, Response } from "express";
import { verifyJwt } from "./utils/jwt";
import neo4jService from "./services/neo4j.service";

// Authentication middleware
const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Get the user token from the headers or cookies
  const token = req.headers.authorization?.split(" ")[1] || req.cookies?.token;

  if (!token) {
    return res
      .status(401)
      .json({ message: "Authentication required. No token provided." });
  }
  try {
    const decoded = verifyJwt(token);
    if (!decoded) {
      return res.status(401).json({ message: "Invalid or expired token." });
    }
    // Get a fresh session for each request
    const session = await neo4jService.getSession();
    const userData = await session.run("MATCH (u:User {id: $id}) RETURN u", {
      id: (decoded as any).id,
    });

    if (userData.records.length === 0) {
      await session.close();
      return res.status(401).json({ message: "User not found." });
    }
    // Attach the user to the request object
    (req as any).user = userData.records[0].get("u").properties;
    await session.close();
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ message: "Authentication failed." });
  }
};

export default authenticateUser;
