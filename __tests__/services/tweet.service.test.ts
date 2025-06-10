import { TweetService } from '../../src/services/tweet.service';
import { Neo4jService } from '../../src/services/neo4j.service';
import { ApolloError } from 'apollo-server-core';
import { Tweet, LikeTweetInput } from '../../src/models/tweet.model';
import Container from 'typedi';

// Helper to create mock records
const createMockRecord = (tweet: any, author: any) => ({
  get: (key: string) => {
    if (key === 't' || key === 'tweet') return { properties: tweet };
    if (key === 'u' || key === 'author' || key === 'poster') return { properties: author };
    return null;
  },
});

// Mock Neo4j transaction
const mockTransaction = {
  run: jest.fn().mockResolvedValue({ records: [] }),
  commit: jest.fn(),
  rollback: jest.fn(),
};

// Mock Neo4j session
const mockSession = {
  executeWrite: jest.fn().mockImplementation(callback => callback(mockTransaction)),
  run: jest.fn().mockResolvedValue({ records: [] }),
  close: jest.fn().mockResolvedValue(undefined),
};

// Mock Neo4j driver
const mockDriver = {
  session: jest.fn().mockReturnValue(mockSession),
  close: jest.fn().mockResolvedValue(undefined),
};

// Comprehensive mock for Neo4jService
const mockNeo4jService = {
  getDriver: jest.fn().mockReturnValue(mockDriver),
  executeQuery: jest.fn(),
  createTweet: jest.fn(),
  createRelationship: jest.fn(),
  deleteRelationship: jest.fn(),
  findUserById: jest.fn(),
};

describe('TweetService', () => {
  let tweetService: TweetService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Restore mock implementations after they are cleared by jest.clearAllMocks()
    mockNeo4jService.getDriver.mockReturnValue(mockDriver);
    mockDriver.session.mockReturnValue(mockSession);
    mockSession.executeWrite.mockImplementation(callback => callback(mockTransaction));
    
    // Reset mocks that are called with specific values in tests
    mockSession.run.mockResolvedValue({ records: [] });
    mockTransaction.run.mockResolvedValue({ records: [] });

    Container.set(Neo4jService, mockNeo4jService as any);
    tweetService = Container.get(TweetService);
  });

  describe('createTweet', () => {
    it('should create a new tweet successfully', async () => {
      const userId = 'user1';
      const content = 'Test tweet';
      const media = ['image1.jpg'];
      const mockAuthor = { id: userId, name: 'Test User', username: 'testuser', email: 'test@test.com' };
      const mockTweetNode = {
        id: 'tweet1',
        text: content,
        media,
        authorId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTransaction.run.mockResolvedValueOnce({
        records: [createMockRecord(mockTweetNode, mockAuthor)],
      });

      const result = await tweetService.createTweet(content, media, userId);

      expect(mockDriver.session).toHaveBeenCalled();
      expect(mockTransaction.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (t:Tweet'),
        expect.objectContaining({ text: content, media, authorId: userId })
      );
      expect(result).toBeDefined();
      expect(result.id).toBe('tweet1');
      expect(result.text).toBe(content);
      expect(result?.author?.id).toBe(userId);
    });

    it('should throw an error if text is empty', async () => {
      await expect(tweetService.createTweet('', [], 'user1')).rejects.toThrow(
        new ApolloError('Tweet text cannot be empty', 'INVALID_INPUT')
      );
    });
  });

  describe('fetchTweet', () => {
    it('should retrieve a tweet by ID', async () => {
      const tweetId = 'tweet1';
      const mockAuthor = { id: 'user1', name: 'Test User', username: 'testuser', email: 'test@test.com' };
      const mockTweetNode = {
        id: tweetId,
        text: 'Test tweet',
        authorId: 'user1',
        media: [],
        createdAt: new Date(),
      };

      const sessionRunMock = mockSession.run;
      sessionRunMock.mockResolvedValueOnce({
        records: [createMockRecord(mockTweetNode, mockAuthor)],
      });

      const result = await tweetService.fetchTweet(tweetId);

      expect(sessionRunMock).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (t:Tweet {id: $id})'),
        { id: tweetId }
      );
      expect(result).toBeDefined();
      expect(result?.id).toBe(tweetId);
      expect(result?.author?.id).toBe('user1');
    });
  });

  describe('listUserTweets', () => {
    it('should retrieve tweets for a user', async () => {
      const userId = 'user1';
      const mockAuthor = { id: userId, name: 'Test User', username: 'testuser', email: 'test@test.com' };
      const mockTweet1 = { id: 'tweet1', text: 'First tweet', authorId: userId };
      const mockTweet2 = { id: 'tweet2', text: 'Second tweet', authorId: userId };

      const sessionRunMock = mockSession.run;
      sessionRunMock.mockResolvedValueOnce({
        records: [
          createMockRecord(mockTweet1, mockAuthor),
          createMockRecord(mockTweet2, mockAuthor),
        ],
      });

      const result = await tweetService.listUserTweets(userId);

      expect(sessionRunMock).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (u:User {id: $userId})-[:POSTED]->(t:Tweet)'),
        { userId }
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('tweet1');
      expect(result[1].id).toBe('tweet2');
    });
  });
});
