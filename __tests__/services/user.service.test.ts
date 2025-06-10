import { UserService } from '../../src/services/user.service';
import { Container } from 'typedi';
import { Neo4jService } from '../../src/services/neo4j.service';
import { ApolloError } from 'apollo-server-core';
import bcrypt from 'bcrypt';
import { User } from '../../src/models/user.model';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock Neo4jService
const mockNeo4jService = {
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

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    Container.set(Neo4jService, mockNeo4jService);
    userService = new UserService(mockNeo4jService as any);
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const userInput = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      mockNeo4jService.findUserByUsername.mockResolvedValue(null);
      mockNeo4jService.executeQuery.mockResolvedValue({ records: [] });
      mockNeo4jService.createUser.mockResolvedValue({
        id: '123',
        ...userInput,
        password: 'hashedPassword',
      });

      const result = await userService.createUser(userInput);

      expect(mockNeo4jService.findUserByUsername).toHaveBeenCalledWith(userInput.username);
      expect(mockNeo4jService.createUser).toHaveBeenCalled();
      expect(result.user).toHaveProperty('id', '123');
      expect(result).toHaveProperty('token');
    });

    it('should throw error if username already exists', async () => {
      const userInput = {
        username: 'existinguser',
        email: 'test@example.com',
        password: 'password123',
      };

      mockNeo4jService.findUserByUsername.mockResolvedValue({ id: '456', username: 'existinguser' });

      await expect(userService.createUser(userInput)).rejects.toThrow(ApolloError);
      await expect(userService.createUser(userInput)).rejects.toMatchObject({
        message: 'Username already exists',
        extensions: { code: 'USERNAME_EXISTS' },
      });
    });
  });

  describe('validateUser', () => {
    it('should validate user credentials successfully', async () => {
      const user = {
        id: '123',
        username: 'testuser',
        password: 'hashedPassword',
      };

      mockNeo4jService.findUserByUsername.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await userService.validatePassword({
        username: 'testuser',
        password: 'password123'
      });
      
      expect(result).toBeInstanceOf(User);
      expect(result).toMatchObject({
        id: '123',
        username: 'testuser',
        email: undefined,
        name: null,
        bio: null,
        pfp: null,
        isVerified: false
      });
      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.updatedAt).toBeInstanceOf(Date);
    });

    it('should return null for invalid credentials', async () => {
      mockNeo4jService.findUserByUsername.mockResolvedValue({
        id: '123',
        username: 'testuser',
        password: 'hashedPassword',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await userService.validatePassword({
        username: 'testuser',
        password: 'wrongpassword'
      });

      expect(result).toBeNull();
    });
  });

  describe('followUser', () => {
    it('should create a follow relationship', async () => {
      // Mock user data with required properties
      const followerId = 'user1';
      const followingId = 'user2';
      
      // Mock the findUserById to return users
      jest.spyOn(userService, 'findUserById')
        .mockImplementationOnce(async (id) => ({
          id: followerId,
          username: 'follower',
          email: 'follower@test.com',
          name: 'Follower User',
          bio: '',
          pfp: null,
          isVerified: false,
          password: 'hashedpassword',
          createdAt: new Date(),
          updatedAt: new Date(),
          followers: [],
          following: [],
          save: jest.fn()
        } as any))
        .mockImplementationOnce(async (id) => ({
          id: followingId,
          username: 'following',
          email: 'following@test.com',
          name: 'Following User',
          bio: '',
          pfp: null,
          isVerified: false,
          password: 'hashedpassword',
          createdAt: new Date(),
          updatedAt: new Date(),
          followers: [],
          following: [],
          save: jest.fn()
        } as any));

      // Mock the check for existing follow relationship
      mockNeo4jService.executeQuery.mockResolvedValueOnce({
        records: []
      });

      // Mock the createRelationship call
      mockNeo4jService.createRelationship.mockResolvedValue({});

      const result = await userService.followUser(followingId, followerId);

      // Verify the follow relationship was created
      expect(mockNeo4jService.createRelationship).toHaveBeenCalledWith(
        followerId,
        followingId,
        'FOLLOWS'
      );
      
      // Verify the success response
      expect(result).toEqual({
        success: true,
        message: 'Successfully followed user'
      });
    });

    it('should throw error if user not found', async () => {
      const followerId = 'user1';
      const followingId = 'user2';

      // Mock first user exists, second user doesn't
      jest.spyOn(userService, 'findUserById')
        .mockImplementationOnce(async () => ({
          id: followerId,
          username: 'follower',
          email: 'follower@test.com',
          name: 'Follower User',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any))
        .mockImplementationOnce(async () => null);

      await expect(userService.followUser(followingId, followerId))
        .rejects
        .toThrow('User not found');
    });
  });
});
