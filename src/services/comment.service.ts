import { ApolloError } from 'apollo-server-core';
import { Inject, Service } from 'typedi';
import { Neo4jService }  from './neo4j.service';
import { Session, Record as Neo4jRecord, Transaction } from 'neo4j-driver';
import { Comment, CommentNode, UserNode, TweetNode } from '../models/comment.model';
import { User } from '../models/user.model';

type RelationshipType = 'LIKES_COMMENT' | 'POSTED' | 'COMMENTS_ON';

interface Neo4jResult {
  records: Neo4jRecord[];
}

@Service()
export class CommentService {
  private neo4jService: Neo4jService;

  constructor(
    @Inject() neo4jService: Neo4jService
  ) {
    this.neo4jService = neo4jService;
  }

  private async withSession<T>(
    operation: (session: Session) => Promise<T>
  ): Promise<T> {
    const session = this.neo4jService.getDriver().session();
    try {
      return await operation(session);
    } catch (error) {
      console.error('Error in Neo4j session:', error);
      throw new ApolloError('Failed to execute database operation');
    } finally {
      await session.close();
    }
  }

  private mapComment(commentNode: CommentNode, authorNode: UserNode, tweetNode: TweetNode): Comment {
    const comment = new Comment();
    comment.id = commentNode.id;
    comment.text = commentNode.text;
    comment.authorId = commentNode.authorId;
    comment.tweetId = commentNode.tweetId;
    comment.createdAt = commentNode.createdAt instanceof Date 
      ? commentNode.createdAt 
      : new Date(commentNode.createdAt);
    comment.updatedAt = commentNode.updatedAt instanceof Date 
      ? commentNode.updatedAt 
      : new Date(commentNode.updatedAt);
    comment.isLiked = commentNode.isLiked;
    comment.likesCount = commentNode.likesCount || 0;

    if (authorNode) {
      const author = new User();
      author.id = authorNode.id;
      author.username = authorNode.username;
      author.name = authorNode.name;
      author.email = authorNode.email;
      author.pfp = authorNode.pfp ?? '';
      author.bio = authorNode.bio ?? '';
      comment.author = author;
    }

    return comment;
  }

  async createComment(text: string, authorId: string, tweetId: string): Promise<Comment> {
    return this.withSession(async (session) => {
      return session.writeTransaction(async (tx: Transaction) => {
        // Create the comment
        const createCommentResult = await tx.run(
          `
          MATCH (u:User {id: $authorId}), (t:Tweet {id: $tweetId})
          CREATE (c:Comment {
            id: randomUUID(),
            text: $text,
            authorId: $authorId,
            tweetId: $tweetId,
            createdAt: datetime(),
            updatedAt: datetime()
          })
          CREATE (u)-[:POSTED]->(c)
          CREATE (c)-[:COMMENTS_ON]->(t)
          RETURN c, u, t
          `,
          { 
            text, 
            authorId, 
            tweetId 
          }
        );

        const commentNode = createCommentResult.records[0].get('c').properties as CommentNode;
        const authorNode = createCommentResult.records[0].get('u').properties as UserNode;
        const tweetNode = createCommentResult.records[0].get('t').properties as TweetNode;
        
        return this.mapComment(commentNode, authorNode, tweetNode);
      });
    });
  }

  async getCommentsForTweet(tweetId: string, userId?: string): Promise<Comment[]> {
    return this.withSession(async (session) => {
      return session.readTransaction(async (tx: Transaction) => {
        const commentsResult = await tx.run(
          `
          MATCH (c:Comment)-[:COMMENTS_ON]->(t:Tweet {id: $tweetId})
          MATCH (u:User)-[:POSTED]->(c)
          OPTIONAL MATCH (u2:User)-[l:LIKES_COMMENT]->(c)
          RETURN c, u, t, count(DISTINCT l) as likeCount, 
                 ${userId ? 'exists((:User {id: $userId})-[:LIKES_COMMENT]->(c))' : 'false'} as isLiked
          `,
          { tweetId, userId }
        );

        return commentsResult.records.map(record => {
          const commentNode = record.get('c').properties as CommentNode;
          const authorNode = record.get('u').properties as UserNode;
          const tweetNode = record.get('t').properties as TweetNode;
          const likesCount = record.get('likeCount').toNumber();
          const isLiked = record.get('isLiked');
          
          return this.mapComment(
            { ...commentNode, likesCount, isLiked },
            authorNode,
            tweetNode
          );
        });
      });
    });
  }

  async likeComment(commentId: string, userId: string): Promise<boolean> {
    return this.withSession(async (session) => {
      return session.writeTransaction(async (tx: Transaction) => {
        // Check if already liked
        const existingLike = await tx.run(
          `
          MATCH (u:User {id: $userId})-[r:LIKES_COMMENT]->(c:Comment {id: $commentId})
          RETURN r
          `,
          { userId, commentId }
        );

        if (existingLike.records.length > 0) {
          return false; // Already liked
        }

        // Create the like relationship
        await tx.run(
          `
          MATCH (u:User {id: $userId}), (c:Comment {id: $commentId})
          CREATE (u)-[r:LIKES_COMMENT]->(c)
          `,
          { userId, commentId }
        );
        
        return true;
      });
    });
  }

  async unlikeComment(commentId: string, userId: string): Promise<boolean> {
    return this.withSession(async (session) => {
      return session.writeTransaction(async (tx: Transaction) => {
        // Check if the like exists
        const existingLike = await tx.run(
          `
          MATCH (u:User {id: $userId})-[r:LIKES_COMMENT]->(c:Comment {id: $commentId})
          RETURN r
          `,
          { userId, commentId }
        );

        if (existingLike.records.length === 0) {
          return false; // Not liked
        }

        // Remove the like relationship
        await tx.run(
          `
          MATCH (u:User {id: $userId})-[r:LIKES_COMMENT]->(c:Comment {id: $commentId})
          DELETE r
          `,
          { userId, commentId }
        );
        
        return true;
      });
    });
  }

  async deleteComment(commentId: string, userId: string): Promise<boolean> {
    return this.withSession(async (session) => {
      return session.writeTransaction(async (tx: Transaction) => {
        // Check if the comment exists and is owned by the user
        const commentResult = await tx.run(
          `
          MATCH (u:User {id: $userId})-[:POSTED]->(c:Comment {id: $commentId})
          RETURN c
          `,
          { userId, commentId }
        );

        if (commentResult.records.length === 0) {
          throw new ApolloError('Comment not found or not authorized');
        }

        // Delete the comment and its relationships
        await tx.run(
          `
          MATCH (c:Comment {id: $commentId})
          DETACH DELETE c
          `,
          { commentId }
        );
        
        return true;
      });
    });
  }
}
