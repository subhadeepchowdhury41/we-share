import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import { Container } from 'typedi';
import { Neo4jService } from '../../src/services/neo4j.service';
import { UserService } from '../../src/services/user.service';
import { UserResolver } from '../../src/resolvers/user.resolver';
import { authChecker } from '../../src/utils/auth';
import { User } from '../../src/models/user.model';
import { signJwt } from '../../src/utils/jwt';

// Mock Neo4jService
export const mockNeo4jService = {
  findUserByUsername: jest.fn(),
  executeQuery: jest.fn(),
  createUser: jest.fn(),
  findUserById: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  createRelationship: jest.fn(),
  deleteRelationship: jest.fn(),
  getFollowings: jest.fn(),
  getFollowers: jest.fn(),
  validatePassword: jest.fn(),
};

// Mock UserService
export const mockUserService = {
  createUser: jest.fn(),
  validatePassword: jest.fn(),
  findUserById: jest.fn(),
  findUserByUsername: jest.fn(),
  updateUser: jest.fn(),
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
  getAllUsers: jest.fn(),
  getFollowers: jest.fn(),
  getFollowings: jest.fn(),
  getLikedTweets: jest.fn(),
  deleteUser: jest.fn(),
};

// Create test user
export const createTestUser = (overrides = {}): User => {
  const user = new User();
  Object.assign(user, {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    name: 'Test User',
    bio: 'Test bio',
    pfp: null,
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  });
  return user;
};

// Create test token
export const createTestToken = (userId: string = 'test-user-id'): string => {
  return signJwt({ id: userId });
};

// Create test context
export const createTestContext = (user?: User) => {
  return {
    user,
    req: {
      headers: {
        authorization: user ? `Bearer ${createTestToken(user.id)}` : ''
      }
    },
    res: {
      clearCookie: jest.fn()
    }
  };
};

// Create test Apollo server
export const createTestServer = async (context?: any) => {
  // Reset and set up container
  Container.reset();
  Container.set(Neo4jService, mockNeo4jService);
  Container.set(UserService, mockUserService);

  // Build schema
  const schema = await buildSchema({
    resolvers: [UserResolver],
    authChecker,
    container: Container
  });

  // Create Apollo server
  return new ApolloServer({
    schema,
    context: context || (() => ({}))
  });
};

// GraphQL query executor
export const executeGraphQLQuery = async (
  server: ApolloServer,
  query: string,
  variables?: Record<string, any>,
  context?: any
) => {
  return server.executeOperation({
    query,
    variables: variables || {}
  }, {
    contextValue: context
  });
};

// Reset mocks
export const resetMocks = () => {
  jest.clearAllMocks();
  Object.keys(mockNeo4jService).forEach(key => {
    if (typeof mockNeo4jService[key] === 'function') {
      mockNeo4jService[key].mockReset();
    }
  });
  Object.keys(mockUserService).forEach(key => {
    if (typeof mockUserService[key] === 'function') {
      mockUserService[key].mockReset();
    }
  });
};
