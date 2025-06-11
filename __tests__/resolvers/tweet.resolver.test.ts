import 'reflect-metadata';
import { ApolloServer, gql } from 'apollo-server';
import { Container } from 'typedi';
import { TestDbHelper } from '../helpers/test-db.helper';
import { User } from '../../src/models/user.model';
import { Neo4jService } from '../../src/services/neo4j.service';
import { TweetService } from '../../src/services/tweet.service';
import { TweetResolver } from '../../src/resolvers/tweet.resolver';
import { buildSchema } from 'type-graphql';
import Context from '../../src/types/context';
import { TEST_JWT_SECRET, verifyJwt } from '../mocks/jwt.mock';
import * as jwtUtils from '../../src/utils/jwt';
import { Tweet } from '../../src/models/tweet.model';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a test Apollo server for testing tweet resolvers
 */
async function createTestServer(context: Partial<Context> = {}) {
  // Build the GraphQL schema
  const schema = await buildSchema({
    resolvers: [TweetResolver],
    container: Container,
    validate: false,
    authChecker: ({ context }, roles) => {
      // Check if user exists in context
      return !!context.user;
    },
  });

  // Create the Apollo server
  return new ApolloServer({
    schema,
    context: () => context,
  });
}

describe('TweetResolver', () => {
  let testServer: ApolloServer;
  let authenticatedServer: ApolloServer;
  let testDbHelper: TestDbHelper;
  let testUsers: User[];
  let testTweets: string[];
  let neo4jService: Neo4jService;

  beforeAll(async () => {
    // Initialize test database helper
    testDbHelper = new TestDbHelper();
    
    // Clear database and create test data
    const testData = await testDbHelper.initializeTestData();
    testUsers = testData.users;
    testTweets = testData.tweets;
    
    // Create test servers
    testServer = await createTestServer();
    authenticatedServer = await createTestServer({
      user: testUsers[0],
      req: {} as any,
      res: {} as any
    });
    
    // Get Neo4j service instance
    neo4jService = Container.get(Neo4jService);
    
    // Create additional test tweets with proper structure
    const session = await neo4jService.getSession();
    try {
      // Create test tweets with the correct structure
      for (let i = 1; i <= 3; i++) {
        const tweetId = uuidv4();
        await session.run(
          `MATCH (u:User {id: $userId})
           CREATE (t:Tweet {
             id: $tweetId,
             text: $text,
             media: $media,
             authorId: $userId,
             likesCount: 0,
             commentsCount: 0,
             retweetsCount: 0,
             createdAt: datetime(),
             updatedAt: datetime()
           })
           CREATE (u)-[:POSTED]->(t)
           RETURN t`,
          {
            userId: testUsers[0].id,
            tweetId,
            text: `Test tweet ${i} content`,
            media: []
          }
        );
        testTweets.push(tweetId);
      }
      
      // Create a like relationship for testing
      await session.run(
        `MATCH (u:User {id: $userId}), (t:Tweet {id: $tweetId})
         CREATE (u)-[:LIKES {createdAt: datetime()}]->(t)
         SET t.likesCount = 1
         RETURN t`,
        {
          userId: testUsers[1].id,
          tweetId: testTweets[0]
        }
      );
    } finally {
      await session.close();
    }
  });

  afterAll(async () => {
    // Clean up test data
    await testDbHelper.clearDatabase();
    
    // Close Neo4j connection
    await neo4jService.close();
  });

  describe('Queries', () => {
    it('should fetch all tweets', async () => {
      const LIST_TWEETS_QUERY = gql`
        query ListTweets {
          listTweets {
            id
            text
            authorId
            likesCount
            commentsCount
            retweetsCount
          }
        }
      `;

      const response = await testServer.executeOperation({
        query: LIST_TWEETS_QUERY,
      });

      expect(response.errors).toBeUndefined();
      expect(response.data?.listTweets).toBeDefined();
      expect(Array.isArray(response.data?.listTweets)).toBe(true);
      expect(response.data?.listTweets.length).toBeGreaterThanOrEqual(3);
    });

    it('should fetch a tweet by ID', async () => {
      const FETCH_TWEET_QUERY = gql`
        query FetchTweet($id: ID!) {
          fetchTweet(id: $id) {
            id
            text
            authorId
            likesCount
            commentsCount
            retweetsCount
          }
        }
      `;

      const response = await testServer.executeOperation({
        query: FETCH_TWEET_QUERY,
        variables: { id: testTweets[0] },
      });

      expect(response.errors).toBeUndefined();
      expect(response.data?.fetchTweet).toBeDefined();
      expect(response.data?.fetchTweet.id).toBe(testTweets[0]);
    });

    it('should return null for non-existent tweet ID', async () => {
      const FETCH_TWEET_QUERY = gql`
        query FetchTweet($id: ID!) {
          fetchTweet(id: $id) {
            id
            text
          }
        }
      `;

      const response = await testServer.executeOperation({
        query: FETCH_TWEET_QUERY,
        variables: { id: 'non-existent-id' },
      });

      expect(response.errors).toBeUndefined();
      expect(response.data?.fetchTweet).toBeNull();
    });

    it('should fetch tweets by a specific user', async () => {
      const LIST_USER_TWEETS_QUERY = gql`
        query ListUserTweets($userId: ID!) {
          listUserTweets(userId: $userId) {
            id
            text
            authorId
          }
        }
      `;

      const response = await testServer.executeOperation({
        query: LIST_USER_TWEETS_QUERY,
        variables: { userId: testUsers[0].id },
      });

      expect(response.errors).toBeUndefined();
      expect(response.data?.listUserTweets).toBeDefined();
      expect(Array.isArray(response.data?.listUserTweets)).toBe(true);
      
      // All tweets should belong to the specified user
      response.data?.listUserTweets.forEach((tweet: any) => {
        expect(tweet.authorId).toBe(testUsers[0].id);
      });
    });

    it('should fetch tweets liked by a specific user', async () => {
      const LIST_LIKED_TWEETS_QUERY = gql`
        query ListLikedTweets($userId: ID!) {
          listLikedTweets(userId: $userId) {
            id
            text
            authorId
            likesCount
          }
        }
      `;

      const response = await testServer.executeOperation({
        query: LIST_LIKED_TWEETS_QUERY,
        variables: { userId: testUsers[1].id },
      });

      expect(response.errors).toBeUndefined();
      expect(response.data?.listLikedTweets).toBeDefined();
      expect(Array.isArray(response.data?.listLikedTweets)).toBe(true);
      expect(response.data?.listLikedTweets.length).toBeGreaterThanOrEqual(1);
      
      // The first tweet should be liked by the second user
      const likedTweetIds = response.data?.listLikedTweets.map((t: any) => t.id);
      expect(likedTweetIds).toContain(testTweets[0]);
    });

    it('should fetch timeline tweets for an authenticated user', async () => {
      const LIST_TIMELINE_TWEETS_QUERY = gql`
        query ListTimelineTweets($userId: ID!) {
          listTimelineTweets(userId: $userId) {
            id
            text
            authorId
          }
        }
      `;

      const response = await authenticatedServer.executeOperation({
        query: LIST_TIMELINE_TWEETS_QUERY,
        variables: { userId: testUsers[0].id },
      });

      expect(response.errors).toBeUndefined();
      expect(response.data?.listTimelineTweets).toBeDefined();
      expect(Array.isArray(response.data?.listTimelineTweets)).toBe(true);
    });

    it('should not allow unauthenticated access to timeline tweets', async () => {
      const LIST_TIMELINE_TWEETS_QUERY = gql`
        query ListTimelineTweets($userId: ID!) {
          listTimelineTweets(userId: $userId) {
            id
            text
          }
        }
      `;

      const response = await testServer.executeOperation({
        query: LIST_TIMELINE_TWEETS_QUERY,
        variables: { userId: testUsers[0].id },
      });

      expect(response.errors).toBeDefined();
      expect(response.errors?.[0].message).toContain('Access denied');
    });
  });

  describe('Mutations', () => {
    it('should create a new tweet when authenticated', async () => {
      const CREATE_TWEET_MUTATION = gql`
        mutation CreateTweet($input: CreateTweetInput!) {
          createTweet(input: $input) {
            id
            text
            media
            authorId
            author {
              id
              username
            }
          }
        }
      `;

      const response = await authenticatedServer.executeOperation({
        query: CREATE_TWEET_MUTATION,
        variables: { 
          input: { 
            text: 'This is a test tweet',
            media: ['https://example.com/image.jpg'] 
          } 
        },
      });

      expect(response.errors).toBeUndefined();
      expect(response.data?.createTweet).toBeDefined();
      expect(response.data?.createTweet.text).toBe('This is a test tweet');
      expect(response.data?.createTweet.media).toEqual(['https://example.com/image.jpg']);
      expect(response.data?.createTweet.authorId).toBe(testUsers[0].id);
      expect(response.data?.createTweet.author.id).toBe(testUsers[0].id);
    });

    it('should not create a tweet when unauthenticated', async () => {
      const CREATE_TWEET_MUTATION = gql`
        mutation CreateTweet($input: CreateTweetInput!) {
          createTweet(input: $input) {
            id
            text
          }
        }
      `;

      const response = await testServer.executeOperation({
        query: CREATE_TWEET_MUTATION,
        variables: { 
          input: { 
            text: 'This should fail',
            media: [] 
          } 
        },
      });

      expect(response.errors).toBeDefined();
      expect(response.errors?.[0].message).toContain('Access denied');
    });

    it('should update a tweet when authenticated', async () => {
      // First create a tweet to update
      const CREATE_TWEET_MUTATION = gql`
        mutation CreateTweet($input: CreateTweetInput!) {
          createTweet(input: $input) {
            id
            text
          }
        }
      `;

      const createResponse = await authenticatedServer.executeOperation({
        query: CREATE_TWEET_MUTATION,
        variables: { 
          input: { 
            text: 'Original tweet text',
            media: [] 
          } 
        },
      });

      const tweetId = createResponse.data?.createTweet.id;

      // Now update the tweet
      const UPDATE_TWEET_MUTATION = gql`
        mutation UpdateTweet($input: UpdateTweetInput!) {
          updateTweet(input: $input) {
            id
            text
            media
            updatedAt
          }
        }
      `;

      const updateResponse = await authenticatedServer.executeOperation({
        query: UPDATE_TWEET_MUTATION,
        variables: { 
          input: { 
            id: tweetId,
            text: 'Updated tweet text',
            media: ['https://example.com/updated.jpg'] 
          } 
        },
      });

      expect(updateResponse.errors).toBeUndefined();
      expect(updateResponse.data?.updateTweet).toBeDefined();
      expect(updateResponse.data?.updateTweet.id).toBe(tweetId);
      expect(updateResponse.data?.updateTweet.text).toBe('Updated tweet text');
      expect(updateResponse.data?.updateTweet.media).toEqual(['https://example.com/updated.jpg']);
    });

    it('should like a tweet when authenticated', async () => {
      const LIKE_TWEET_MUTATION = gql`
        mutation LikeTweet($input: LikeTweetInput!) {
          likeTweet(input: $input)
        }
      `;

      const response = await authenticatedServer.executeOperation({
        query: LIKE_TWEET_MUTATION,
        variables: { 
          input: { 
            tweetId: testTweets[1]
          } 
        },
      });

      expect(response.errors).toBeUndefined();
      expect(response.data?.likeTweet).toBe(true);

      // Verify the like relationship was created
      const session = await neo4jService.getSession();
      try {
        const result = await session.run(
          `MATCH (u:User {id: $userId})-[r:LIKES]->(t:Tweet {id: $tweetId})
           RETURN r IS NOT NULL as relationshipExists`,
          { userId: testUsers[0].id, tweetId: testTweets[1] }
        );
        expect(result.records[0].get('relationshipExists')).toBe(true);
      } finally {
        await session.close();
      }
    });

    it('should unlike a tweet when authenticated', async () => {
      // First like a tweet
      const LIKE_TWEET_MUTATION = gql`
        mutation LikeTweet($input: LikeTweetInput!) {
          likeTweet(input: $input)
        }
      `;

      await authenticatedServer.executeOperation({
        query: LIKE_TWEET_MUTATION,
        variables: { 
          input: { 
            tweetId: testTweets[2]
          } 
        },
      });

      // Now unlike it
      const UNLIKE_TWEET_MUTATION = gql`
        mutation UnlikeTweet($input: UnlikeTweetInput!) {
          unlikeTweet(input: $input)
        }
      `;

      const response = await authenticatedServer.executeOperation({
        query: UNLIKE_TWEET_MUTATION,
        variables: { 
          input: { 
            tweetId: testTweets[2]
          } 
        },
      });

      expect(response.errors).toBeUndefined();
      expect(response.data?.unlikeTweet).toBe(true);

      // Verify the like relationship was removed
      const session = await neo4jService.getSession();
      try {
        const result = await session.run(
          `MATCH (u:User {id: $userId})-[r:LIKES]->(t:Tweet {id: $tweetId})
           RETURN r IS NOT NULL as relationshipExists`,
          { userId: testUsers[0].id, tweetId: testTweets[2] }
        );
        expect(result.records.length).toBe(0);
      } finally {
        await session.close();
      }
    });

    it('should delete a tweet when authenticated and authorized', async () => {
      // First create a tweet to delete
      const CREATE_TWEET_MUTATION = gql`
        mutation CreateTweet($input: CreateTweetInput!) {
          createTweet(input: $input) {
            id
            text
            authorId
          }
        }
      `;

      const createResponse = await authenticatedServer.executeOperation({
        query: CREATE_TWEET_MUTATION,
        variables: { 
          input: { 
            text: 'Tweet to be deleted',
            media: [] 
          } 
        },
      });

      const tweetId = createResponse.data?.createTweet.id;
      const authorId = createResponse.data?.createTweet.authorId;

      // Now delete the tweet
      const DELETE_TWEET_MUTATION = gql`
        mutation DeleteTweet($input: DeleteTweetInput!) {
          deleteTweet(input: $input)
        }
      `;

      const deleteResponse = await authenticatedServer.executeOperation({
        query: DELETE_TWEET_MUTATION,
        variables: { 
          input: { 
            id: tweetId,
            authorId: authorId
          } 
        },
      });

      expect(deleteResponse.errors).toBeUndefined();
      expect(deleteResponse.data?.deleteTweet).toBe(true);

      // Verify the tweet was deleted
      const FETCH_TWEET_QUERY = gql`
        query FetchTweet($id: ID!) {
          fetchTweet(id: $id) {
            id
          }
        }
      `;

      const fetchResponse = await testServer.executeOperation({
        query: FETCH_TWEET_QUERY,
        variables: { id: tweetId },
      });

      // Since UserService now throws ApolloError for non-existent resources,
      // we should expect an error instead of null
      expect(fetchResponse.errors).toBeDefined();
      expect(fetchResponse.data?.fetchTweet).toBeNull();
    });

    it('should comment on a tweet when authenticated', async () => {
      const COMMENT_ON_TWEET_MUTATION = gql`
        mutation CommentOnTweet($input: CommentOnTweetInput!) {
          commentOnTweet(input: $input) {
            id
            text
            commentsCount
          }
        }
      `;

      const response = await authenticatedServer.executeOperation({
        query: COMMENT_ON_TWEET_MUTATION,
        variables: { 
          input: { 
            tweetId: testTweets[0],
            text: 'This is a test comment'
          } 
        },
      });

      expect(response.errors).toBeUndefined();
      expect(response.data?.commentOnTweet).toBeDefined();
      expect(response.data?.commentOnTweet.id).toBe(testTweets[0]);
      expect(response.data?.commentOnTweet.commentsCount).toBeGreaterThanOrEqual(1);
    });
  });
});
