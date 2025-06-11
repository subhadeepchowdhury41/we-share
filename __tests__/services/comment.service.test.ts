import { CommentService } from '../../src/services/comment.service';
import { Neo4jService } from '../../src/services/neo4j.service';
import { ApolloError } from 'apollo-server-core';
import { Comment } from '../../src/models/comment.model';
import { User } from '../../src/models/user.model';
import Container from 'typedi';

// Helper to create mock records
const createMockRecord = (comment: any, author: any, tweet: any, likeCount = 0, isLiked = false) => ({
  get: (key: string) => {
    if (key === 'c' || key === 'comment') return { properties: comment };
    if (key === 'u' || key === 'author') return { properties: author };
    if (key === 't' || key === 'tweet') return { properties: tweet };
    if (key === 'likeCount') return { toNumber: () => likeCount };
    if (key === 'isLiked') return isLiked;
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
  writeTransaction: jest.fn().mockImplementation(callback => callback(mockTransaction)),
  readTransaction: jest.fn().mockImplementation(callback => callback(mockTransaction)),
  close: jest.fn().mockResolvedValue(undefined),
};

// Mock Neo4j driver
const mockDriver = {
  session: jest.fn().mockReturnValue(mockSession),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockNeo4jService = {
  getDriver: jest.fn().mockReturnValue(mockDriver),
};

describe('CommentService', () => {
  let commentService: CommentService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNeo4jService.getDriver.mockReturnValue(mockDriver);
    mockDriver.session.mockReturnValue(mockSession);
    mockSession.writeTransaction.mockImplementation(callback => callback(mockTransaction));
    mockSession.readTransaction.mockImplementation(callback => callback(mockTransaction));
    mockSession.close.mockResolvedValue(undefined);
    mockTransaction.run.mockResolvedValue({ records: [] });
    Container.set(Neo4jService, mockNeo4jService as any);
    commentService = Container.get(CommentService);
  });

  describe('createComment', () => {
    it('should create a new comment successfully', async () => {
      const text = 'Test comment';
      const authorId = 'user1';
      const tweetId = 'tweet1';
      const mockCommentNode = {
        id: 'comment1',
        text,
        authorId,
        tweetId,
        createdAt: new Date(),
        updatedAt: new Date(),
        isLiked: false,
        likesCount: 0,
      };
      const mockAuthorNode = {
        id: authorId,
        username: 'testuser',
        name: 'Test User',
        email: 'test@test.com',
      };
      const mockTweetNode = {
        id: tweetId,
        text: 'Test tweet',
        authorId,
      };
      mockTransaction.run.mockResolvedValueOnce({
        records: [createMockRecord(mockCommentNode, mockAuthorNode, mockTweetNode)],
      });
      const result = await commentService.createComment(text, authorId, tweetId);
      expect(mockDriver.session).toHaveBeenCalled();
      expect(mockTransaction.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (c:Comment'),
        expect.objectContaining({ text, authorId, tweetId })
      );
      expect(result).toBeDefined();
      expect(result.id).toBe('comment1');
      expect(result.text).toBe(text);
      expect(result.author?.id).toBe(authorId);
    });
  });

  describe('getCommentsForTweet', () => {
    it('should retrieve comments for a tweet', async () => {
      const tweetId = 'tweet1';
      const userId = 'user1';
      const mockCommentNode = {
        id: 'comment1',
        text: 'Nice tweet!',
        authorId: userId,
        tweetId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockAuthorNode = {
        id: userId,
        username: 'testuser',
        name: 'Test User',
        email: 'test@test.com',
      };
      const mockTweetNode = {
        id: tweetId,
        text: 'Test tweet',
        authorId: userId,
      };
      mockTransaction.run.mockResolvedValueOnce({
        records: [createMockRecord(mockCommentNode, mockAuthorNode, mockTweetNode, 3, true)],
      });
      const result = await commentService.getCommentsForTweet(tweetId, userId);
      expect(mockDriver.session).toHaveBeenCalled();
      expect(mockTransaction.run).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (c:Comment)-[:COMMENTS_ON]->(t:Tweet {id: $tweetId})'),
        expect.objectContaining({ tweetId, userId })
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('comment1');
      expect(result[0].likesCount).toBe(3);
      expect(result[0].isLiked).toBe(true);
    });
  });

  describe('likeComment', () => {
    it('should like a comment if not already liked', async () => {
      const commentId = 'comment1';
      const userId = 'user1';
      // First call: check if already liked (returns empty)
      mockTransaction.run.mockResolvedValueOnce({ records: [] });
      // Second call: create like relationship
      mockTransaction.run.mockResolvedValueOnce({});
      const result = await commentService.likeComment(commentId, userId);
      expect(mockTransaction.run).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (u:User {id: $userId})-[r:LIKES_COMMENT]->(c:Comment {id: $commentId})'),
        { userId, commentId }
      );
      expect(result).toBe(true);
    });
    it('should return false if already liked', async () => {
      const commentId = 'comment1';
      const userId = 'user1';
      // First call: check if already liked (returns a record)
      mockTransaction.run.mockResolvedValueOnce({ records: [{}] });
      const result = await commentService.likeComment(commentId, userId);
      expect(result).toBe(false);
    });
  });

  describe('unlikeComment', () => {
    it('should unlike a comment if liked', async () => {
      const commentId = 'comment1';
      const userId = 'user1';
      // First call: check if like exists (returns a record)
      mockTransaction.run.mockResolvedValueOnce({ records: [{}] });
      // Second call: delete like relationship
      mockTransaction.run.mockResolvedValueOnce({});
      const result = await commentService.unlikeComment(commentId, userId);
      expect(mockTransaction.run).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (u:User {id: $userId})-[r:LIKES_COMMENT]->(c:Comment {id: $commentId})'),
        { userId, commentId }
      );
      expect(result).toBe(true);
    });
    it('should return false if not liked', async () => {
      const commentId = 'comment1';
      const userId = 'user1';
      // First call: check if like exists (returns empty)
      mockTransaction.run.mockResolvedValueOnce({ records: [] });
      const result = await commentService.unlikeComment(commentId, userId);
      expect(result).toBe(false);
    });
  });

  describe('deleteComment', () => {
    it('should delete a comment if owned by user', async () => {
      const commentId = 'comment1';
      const userId = 'user1';
      // First call: check if comment exists and is owned by user (returns a record)
      mockTransaction.run.mockResolvedValueOnce({ records: [{}] });
      // Second call: delete comment
      mockTransaction.run.mockResolvedValueOnce({});
      const result = await commentService.deleteComment(commentId, userId);
      expect(mockTransaction.run).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (u:User {id: $userId})-[:POSTED]->(c:Comment {id: $commentId})'),
        { userId, commentId }
      );
      expect(result).toBe(true);
    });
    it('should throw if comment does not exist or not owned by user', async () => {
      const commentId = 'comment1';
      const userId = 'user1';
      // First call: check if comment exists (returns empty)
      mockTransaction.run.mockResolvedValueOnce({ records: [] });
      await expect(commentService.deleteComment(commentId, userId)).rejects.toThrow(
        'Comment not found or not authorized'
      );
    });
  });
});
