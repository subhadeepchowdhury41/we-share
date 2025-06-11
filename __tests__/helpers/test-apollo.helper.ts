import { ApolloServer } from 'apollo-server';
import { buildSchema } from 'type-graphql';
import { Container } from 'typedi';
import { UserResolver } from '../../src/resolvers/user.resolver';
import { User } from '../../src/models/user.model';
import { Neo4jService } from '../../src/services/neo4j.service';
import { UserService } from '../../src/services/user.service';
import Context from '../../src/types/context';
import { TweetService } from '../../src/services/tweet.service';

/**
 * Creates a test Apollo server instance
 * @param contextValue Optional context value to include in the server
 * @returns A configured Apollo server instance for testing
 */
export async function createTestServer(contextValue: Partial<Context> = {}) {
  // Register services in the container
  if (!Container.has(Neo4jService)) {
    Container.set(Neo4jService, new Neo4jService());
  }
  
  if (!Container.has(UserService)) {
    Container.set(UserService, new UserService(Container.get(Neo4jService), Container.get(TweetService)));
  }

  // Build the GraphQL schema
  const schema = await buildSchema({
    resolvers: [UserResolver],
    container: Container,
    validate: false,
  });

  // Create the Apollo server
  return new ApolloServer({
    schema,
    context: () => contextValue,
  });
}

/**
 * Creates a test context with an authenticated user
 * @param user The user to authenticate in the context
 * @returns A context object with the authenticated user
 */
export function createTestContext(user?: User): Partial<Context> {
  return {
    user,
    req: {} as any,
    res: {} as any,
  };
}
