import { UserService } from '../../src/services/user.service';
import { Container } from 'typedi';
import { Neo4jService } from '../../src/services/neo4j.service';
import { TweetService } from '../../src/services/tweet.service';
import { ApolloError } from 'apollo-server-core';
import bcrypt from 'bcrypt';
import { User } from '../../src/models/user.model';
import { signJwt } from '../../src/utils/jwt';

// Don't mock the User class, we'll use the real one

// Mock bcrypt
jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn(),
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

// Mock TweetService
const mockTweetService = {
  listUserTweets: jest.fn().mockResolvedValue([]),
  listLikedTweets: jest.fn().mockResolvedValue([]),
  createTweet: jest.fn(),
  fetchTweet: jest.fn(),
  listTweets: jest.fn(),
  likeTweet: jest.fn(),
  unlikeTweet: jest.fn(),
  deleteTweet: jest.fn(),
  updateTweet: jest.fn(),
  commentOnTweet: jest.fn(),
  listTimelineTweets: jest.fn(),
};

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    Container.set(Neo4jService, mockNeo4jService);
    Container.set(TweetService, mockTweetService);
    userService = new UserService(mockNeo4jService as any, mockTweetService as any);
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
    // it('should validate user credentials successfully', async () => {
    //   // Create a mock user object that matches what Neo4j would return
    //   const mockUserData = {
    //     id: '123',
    //     username: 'testuser',
    //     password: 'hashedPassword', // This is how Neo4j returns it
    //     email: 'test@example.com',
    //     name: 'Test User', 
    //     bio: 'Test bio',
    //     pfp: 'profile.jpg',
    //     isVerified: true,
    //     createdAt: new Date().toISOString(),
    //     updatedAt: new Date().toISOString()
    //   };

    //   // Mock the Neo4j `service` to return our mock user data
    //   mockNeo4jService.findUserByUsername.mockResolvedValue(mockUserData);
    //   mockNeo4jService.validatePassword.mockResolvedValue(mockUserData);
    //   (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    //   // Call the method under test
    //   const result = await userService.validatePassword({
    //     username: 'testuser',
    //     password: 'password123'
    //   });
      
    //   // Verify the result exists and is a User instance
    //   expect(result).not.toBeNull();
    //   expect(result).toBeInstanceOf(User);
      
    //   // Verify the user properties are set correctly
    //   expect(result?.id).toBe(mockUserData.id);
    //   expect(result?.username).toBe(mockUserData.username);
    //   expect(result?.email).toBe(mockUserData.email);
    //   expect(result?.name).toBe(mockUserData.name);
      
    //   if (result) { // TypeScript guard to avoid null checks on each property
    //     // Check that the properties were mapped correctly
    //     expect(result.id).toBe('123');
    //     expect(result.username).toBe('testuser');
    //     expect(result.email).toBe('test@example.com');
    //     expect(result.name).toBe('Test User');
    //     expect(result.bio).toBe('Test bio');
    //     expect(result.pfp).toBe('profile.jpg');
    //     expect(result.isVerified).toBe(true);
        
    //     // Check that dates were properly converted
    //     expect(result.createdAt).toBeInstanceOf(Date);
    //     expect(result.updatedAt).toBeInstanceOf(Date);
    //   }
    // });

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
