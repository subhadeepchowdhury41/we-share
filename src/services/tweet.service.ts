import { ApolloError } from 'apollo-server-core';
import { Inject, Service } from 'typedi';
import { 
  Tweet, 
  LikeTweetInput,
  UnlikeTweetInput,
  TweetNode as ModelTweetNode, 
  UserNode as ModelUserNode,
} from '../models/tweet.model';
import { Neo4jService } from './neo4j.service';
import { Session, Record as Neo4jRecord, Transaction } from 'neo4j-driver';

// Extend the model interfaces with service-specific properties
interface TweetNode extends ModelTweetNode {
  isLiked?: boolean;
}

interface UserNode extends ModelUserNode {
  // Add any service-specific user properties here
}

interface Neo4jResult {
  records: Neo4jRecord[];
}

@Service()
export class TweetService {

  private neo4jService: Neo4jService;

  constructor(
    @Inject() neo4jService: Neo4jService
  ) {
    this.neo4jService = neo4jService;
  }

  private safeParseDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    
    // Handle Neo4j DateTime objects
    if (dateValue.year && dateValue.month && dateValue.day) {
      return new Date(
        dateValue.year.toNumber(),
        dateValue.month.toNumber() - 1, // JavaScript months are 0-indexed
        dateValue.day.toNumber(),
        dateValue.hour?.toNumber() || 0,
        dateValue.minute?.toNumber() || 0,
        dateValue.second?.toNumber() || 0,
        dateValue.nanosecond?.toNumber() / 1000000 || 0
      );
    }
    
    // Handle string timestamps
    const timestamp = Date.parse(dateValue);
    return isNaN(timestamp) ? new Date() : new Date(timestamp);
  }

  private mapTweet(tweetNode: TweetNode, authorNode: UserNode): Tweet {
    const tweet: Tweet = {
      id: tweetNode.id,
      text: tweetNode.text,
      media: tweetNode.media || [],
      authorId: tweetNode.authorId,
      createdAt: this.safeParseDate(tweetNode.createdAt),
      updatedAt: this.safeParseDate(tweetNode.updatedAt),
      likesCount: tweetNode.likesCount ?? 0,
      commentsCount: tweetNode.commentsCount ?? 0,
      retweetsCount: tweetNode.retweetsCount ?? 0,
      isLiked: tweetNode.isLiked ?? false,
      author: {
        id: authorNode.id,
        username: authorNode.username,
        name: authorNode.name,
        email: authorNode.email ?? '',
        bio: authorNode.bio ?? '',
        pfp: authorNode.pfp ?? 'https://i.imgur.com/HeIi0wU.png',
        coverPhoto: authorNode.coverPhoto ?? '',
        isVerified: authorNode.isVerified ?? false,
        createdAt: this.safeParseDate(authorNode.createdAt),
        updatedAt: this.safeParseDate(authorNode.updatedAt)
      }
    };
    return tweet;
  }

  private async withSession<T>(
    operation: (session: Session) => Promise<T>
  ): Promise<T> {
    const session = this.neo4jService.getDriver().session();
    try {
      return await operation(session);
    } catch (error) {
      console.error('Error in Neo4j session:', error);
      throw new ApolloError('Failed to execute database operation', 'DATABASE_ERROR', { originalError: error });
    } finally {
      await session.close();
    }
  }

  async createTweet(text: string, media: string[], authorId: string): Promise<Tweet> {
    if (!text.trim()) {
      throw new ApolloError('Tweet text cannot be empty', 'INVALID_INPUT');
    }

    return this.withSession(async (session) => {
      return await session.executeWrite(async (tx) => {
        const createTweetResult = await tx.run(
          `
          MATCH (u:User {id: $authorId})
          CREATE (t:Tweet {
            id: randomUUID(),
            text: $text,
            media: $media,
            createdAt: datetime(),
            updatedAt: datetime(),
            authorId: $authorId
          })
          CREATE (u)-[:POSTED]->(t)
          RETURN t, u
          `,
          { 
            text,
            media,
            authorId
          }
        );

        if (!createTweetResult.records.length) {
          throw new ApolloError('Failed to create tweet', 'TWEET_CREATION_ERROR');
        }

        const tweetNode = createTweetResult.records[0].get('t').properties as TweetNode;
        const authorNode = createTweetResult.records[0].get('u').properties as UserNode;
        return this.mapTweet(tweetNode, authorNode);
      });
    });
  } catch (error: unknown) {
    throw new ApolloError('Failed to create tweet', 'TWEET_CREATION_ERROR', { originalError: error });
  }

  async fetchTweet(id: string): Promise<Tweet | null> {
    return this.withSession(async (session) => {
      const result = await session.run(
        `
        MATCH (t:Tweet {id: $id})<-[r:POSTED]-(u:User)
        RETURN t, u
        `,
        { id }
      );

      if (result.records.length === 0) {
        return null;
      }

      const tweetNode = result.records[0].get('t').properties as TweetNode;
      const author = result.records[0].get('u').properties as UserNode;
      
      return this.mapTweet(tweetNode, author);
    });
  }



  async listTweets(): Promise<Tweet[]> {
    return this.withSession(async (session) => {
      const result: Neo4jResult = await session.run(
        `
        MATCH (t:Tweet)<-[:POSTED]-(u:User)
        RETURN t, u
        ORDER BY t.createdAt DESC
        `
      );

      return result.records.map((record: Neo4jRecord) => {
        const tweetNode = record.get('t').properties as TweetNode;
        const author = record.get('u').properties as UserNode;
        
        return {
          id: tweetNode.id,
          text: tweetNode.text,
          media: tweetNode.media || [],
          authorId: author.id,
          author: {
            id: author.id,
            username: author.username,
            email: author.email,
            name: author.name,
            bio: author.bio || '',
            pfp: author.pfp || 'https://i.imgur.com/HeIi0wU.png',
            createdAt: new Date(author.createdAt),
            updatedAt: new Date(author.updatedAt)
          },
          createdAt: new Date(tweetNode.createdAt),
          updatedAt: new Date(tweetNode.updatedAt)
        } as Tweet;
      });
    });
  }

  async listUserTweets(userId: string): Promise<Tweet[]> {
    return this.withSession(async (session) => {
      const result: Neo4jResult = await session.run(
        `
        MATCH (u:User {id: $userId})-[:POSTED]->(t:Tweet)
        RETURN t, u
        ORDER BY t.createdAt DESC
        `,
        { userId }
      );

      return result.records.map((record: Neo4jRecord) => {
        const tweetNode = record.get('t').properties as TweetNode;
        const author = record.get('u').properties as UserNode;
        
        return {
          id: tweetNode.id,
          text: tweetNode.text,
          media: tweetNode.media || [],
          authorId: author.id,
          author: {
            id: author.id,
            username: author.username,
            email: author.email,
            name: author.name,
            bio: author.bio || '',
            pfp: author.pfp || 'https://i.imgur.com/HeIi0wU.png',
            createdAt: new Date(author.createdAt),
            updatedAt: new Date(author.updatedAt)
          },
          createdAt: new Date(tweetNode.createdAt),
          updatedAt: new Date(tweetNode.updatedAt)
        } as Tweet;
      });
    });
  }

  async likeTweet(input: LikeTweetInput, userId: string): Promise<boolean> {
    return this.withSession(async (session) => {
      await session.writeTransaction(async (tx: Transaction) => {
        // Check if already liked
        const existingLike = await tx.run(
          `
          MATCH (u:User {id: $userId})-[r:LIKES_TWEET]->(t:Tweet {id: $tweetId})
          RETURN r
          `,
          {
            userId,
            tweetId: input.tweetId,
          }
        );

        if (existingLike.records.length > 0) {
          throw new Error('Tweet already liked');
        }

        // Create the like relationship
        await tx.run(
          `
          MATCH (u:User {id: $userId}), (t:Tweet {id: $tweetId})
          CREATE (u)-[r:LIKES_TWEET { createdAt: datetime() }]->(t)
          RETURN r
          `,
          {
            userId: userId,
            tweetId: input.tweetId,
          }
        );
      });
      return true;
    });
  }

  async listLikedTweets(userId: string): Promise<Tweet[]> {
    return this.withSession(async (session) => {
      const result: Neo4jResult = await session.run(
        `
        MATCH (u:User {id: $userId})-[r:LIKES_TWEET]->(t:Tweet)<-[:POSTED]-(author:User)
        RETURN t, author
        ORDER BY r.createdAt DESC
        `,
        { userId }
      );

      return result.records.map((record: Neo4jRecord) => {
        const tweetNode = record.get('t').properties as TweetNode;
        const author = record.get('author').properties as UserNode;
        
        return {
          id: tweetNode.id,
          text: tweetNode.text,
          media: tweetNode.media || [],
          authorId: author.id,
          author: {
            id: author.id,
            username: author.username,
            email: author.email,
            name: author.name,
            bio: author.bio || '',
            pfp: author.pfp || 'https://i.imgur.com/HeIi0wU.png',
            createdAt: new Date(author.createdAt),
            updatedAt: new Date(author.updatedAt)
          },
          createdAt: new Date(tweetNode.createdAt),
          updatedAt: new Date(tweetNode.updatedAt)
        } as Tweet;
      });
    });
  }

  async unlikeTweet(input: UnlikeTweetInput, userId: string): Promise<boolean> {
    return this.withSession(async (session) => {
      try {
        await session.run(
          `
          MATCH (u:User {id: $userId})-[r:LIKES_TWEET]->(t:Tweet {id: $tweetId})
          DELETE r
          `,
           { userId, tweetId: input.tweetId }
        );
        return true;
      } catch (error) {
        console.error('Error unliking tweet:', error);
        return false;
      }
    });
  }

  async deleteTweet(tweetId: string): Promise<boolean> {
    return this.withSession(async (session) => {
      try {
        // Delete all relationships and the tweet node in a single transaction
        await session.writeTransaction(async (tx) => {
          // Delete all relationships first to avoid constraint violations
          await tx.run(
            `
            MATCH (t:Tweet {id: $tweetId})<-[r]-(n)
            DELETE r
            `,
            { tweetId }
          );

          // Delete the tweet node
          await tx.run(
            `
            MATCH (t:Tweet {id: $tweetId})
            DELETE t
            `,
            { tweetId }
          );
        });
        return true;
      } catch (error) {
        console.error('Error deleting tweet:', error);
        throw new ApolloError(
          'Failed to delete tweet',
          'TWEET_DELETION_ERROR',
          { originalError: error as Error }
        );
      }
    });
  }

  async updateTweet(id: string, text: string, media: string[] = []): Promise<Tweet | null> {
    return this.withSession(async (session) => {
      try {
        const result = await session.writeTransaction(async (tx) => {
          // First, check if the tweet exists
          const existingTweet = await tx.run(
            `
            MATCH (t:Tweet {id: $id})
            RETURN t
            `,
            { id }
          );

          if (existingTweet.records.length === 0) {
            return null;
          }

          // Update the tweet
          const updateResult = await tx.run(
            `
            MATCH (t:Tweet {id: $id})
            SET t.text = $text,
                t.media = $media,
                t.updatedAt = datetime()
            RETURN t, (t)<-[:POSTED]-(u:User) as author
            `,
            { id, text, media }
          );

          if (updateResult.records.length === 0) {
            return null;
          }

          const tweetNode = updateResult.records[0].get('t').properties as TweetNode;
          const authorNode = updateResult.records[0].get('author').properties as UserNode;
          
          return this.mapTweet(tweetNode, authorNode);
        });

        return result;
      } catch (error) {
        console.error('Error updating tweet:', error);
        throw new ApolloError(
          'Failed to update tweet',
          'TWEET_UPDATE_ERROR',
          { originalError: error as Error }
        );
      }
    });
  }

  async commentOnTweet(text: string, authorId: string, tweetId: string): Promise<Tweet> {
    return this.withSession(async (session) => {
      try {
        // First, verify the tweet exists
        const tweet = await this.fetchTweet(tweetId);
        if (!tweet) {
          throw new Error('Tweet not found');
        }

        // Create the comment and relationship in a single transaction
        const result = await session.writeTransaction(async (tx) => {
          // Create the comment
          const createCommentResult = await tx.run(
            `
            MATCH (u:User {id: $authorId}), (t:Tweet {id: $tweetId})
            CREATE (c:Comment {
              id: randomUUID(),
              text: $text,
              authorId: $authorId,
              createdAt: datetime(),
              updatedAt: datetime()
            })
            CREATE (u)-[:POSTED]->(c)
            CREATE (c)-[:COMMENTS_ON]->(t)
            RETURN c, u, t
            `,
            { text, authorId, tweetId }
          );

          // Update the tweet's comment count
          await tx.run(
            `
            MATCH (t:Tweet {id: $tweetId})
            SET t.commentsCount = COALESCE(t.commentsCount, 0) + 1
            `,
            { tweetId }
          );

          return createCommentResult.records[0];
        });

        // Return the updated tweet with the new comment
        return this.fetchTweet(tweetId) as Promise<Tweet>;
      } catch (error) {
        console.error('Error creating comment:', error);
        throw new ApolloError(
          'Failed to create comment',
          'COMMENT_CREATION_ERROR',
          { originalError: error as Error }
        );
      }
    });
  }

  async listTimelineTweets(userId: string): Promise<Tweet[]> {
    return this.withSession(async (session) => {
      const result: Neo4jResult = await session.run(
        `
        // Get all users that the current user follows
        MATCH (me:User {id: $userId})-[:FOLLOWS]->(following:User)
        // Get all tweets from those users or from the current user
        MATCH (t:Tweet)<-[:POSTED]-(poster:User)
        WHERE (poster.id IN following.id OR poster.id = $userId)
        RETURN t, poster
        ORDER BY t.createdAt DESC
        `,
        { userId }
      );

      return result.records.map((record: Neo4jRecord) => {
        const tweetNode = record.get('t').properties as TweetNode;
        const author = record.get('poster').properties as UserNode;
        
        return {
          id: tweetNode.id,
          text: tweetNode.text,
          media: tweetNode.media || [],
          authorId: author.id,
          author: {
            id: author.id,
            username: author.username,
            email: author.email,
            name: author.name,
            bio: author.bio || '',
            pfp: author.pfp || 'https://i.imgur.com/HeIi0wU.png',
            createdAt: new Date(author.createdAt),
            updatedAt: new Date(author.updatedAt)
          },
          createdAt: new Date(tweetNode.createdAt),
          updatedAt: new Date(tweetNode.updatedAt)
        } as Tweet;
      });
    });
  }
}