import { Arg, ID, Mutation, Query, Resolver, Authorized, Ctx } from "type-graphql";
import { ApolloError } from 'apollo-server-core';
import { Service } from "typedi";
import { TweetService } from "../services/tweet.service";
import { Tweet } from "../models/tweet.model";
import Context from '../types/context';
import { 
  CreateTweetInput, 
  UpdateTweetInput, 
  LikeTweetInput,
  UnlikeTweetInput,
  DeleteTweetInput,
  CommentOnTweetInput
} from "../models/tweet.model";
import * as cloudinary from 'cloudinary';

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

@Service()
@Resolver(() => Tweet)
@Service()
export class TweetResolver {
  constructor(private readonly tweetService: TweetService) {}

  @Query(() => [Tweet], { 
    description: 'Get all tweets from all users',
    nullable: 'items' 
  })
  async listTweets(): Promise<Tweet[]> {
    try {
      return await this.tweetService.listTweets();
    } catch (error) {
      throw new ApolloError(
        'Failed to fetch tweets',
        'TWEET_FETCH_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Query(() => [Tweet], { 
    description: 'Get tweets posted by a specific user',
    nullable: 'items' 
  })
  async listUserTweets(
    @Arg("userId", () => ID) userId: string
  ): Promise<Tweet[]> {
    try {
      return await this.tweetService.listUserTweets(userId);
    } catch (error) {
      throw new ApolloError(
        'Failed to fetch user tweets',
        'USER_TWEETS_FETCH_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Query(() => [Tweet], { 
    description: 'Get tweets liked by a specific user',
    nullable: 'items' 
  })
  async listLikedTweets(
    @Arg("userId", () => ID) userId: string
  ): Promise<Tweet[]> {
    try {
      return await this.tweetService.listLikedTweets(userId);
    } catch (error) {
      throw new ApolloError(
        'Failed to fetch liked tweets',
        'LIKED_TWEETS_FETCH_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Query(() => [Tweet], { 
    description: 'Get timeline tweets for a user (tweets from users they follow)',
    nullable: 'items' 
  })
  @Authorized() // Requires authentication
  async listTimelineTweets(
    @Arg("userId", () => ID) userId: string,
  ): Promise<Tweet[]> {
    try {
      return await this.tweetService.listTimelineTweets(userId);
    } catch (error) {
      throw new ApolloError(
        'Failed to fetch timeline tweets',
        'TIMELINE_FETCH_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Mutation(() => Tweet, { 
    description: 'Create a new tweet',
    nullable: true 
  })
  @Authorized() // Requires authentication
  async createTweet(
    @Ctx() context: Context,
    @Arg("input", () => CreateTweetInput) input: CreateTweetInput
  ): Promise<Tweet | null> {
    try {
      if (!input.text.trim()) {
        throw new Error('Tweet text cannot be empty');
      }
      const authorId = context.user?.id;
      if (!authorId) {
        throw new ApolloError('Authentication required', 'UNAUTHORIZED');
      }

      // Create the tweet with the media URLs
      const tweet = await this.tweetService.createTweet(
        input.text,
        input.media || [],
        authorId
      );

      if (!tweet) {
        throw new ApolloError('Failed to create tweet', 'TWEET_CREATION_ERROR');
      }

      return tweet;
    } catch (error) {
      throw new ApolloError(
        'Failed to create tweet',
        'TWEET_CREATION_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Mutation(() => Tweet, { 
    description: 'Update an existing tweet',
    nullable: true 
  })
  @Authorized() // Requires authentication
  async updateTweet(
    @Arg("input", () => UpdateTweetInput) input: UpdateTweetInput
  ): Promise<Tweet | null> {
    try {
      if (!input.text?.trim() && !input.media?.length) {
        throw new Error('At least one field (text or media) must be provided for update');
      }
      const result = await this.tweetService.updateTweet(
        input.id, 
        input.text || '', 
        input.media || []
      );
      
      if (!result) {
        throw new Error('Tweet not found or update failed');
      }
      
      return result;
    } catch (error) {
      throw new ApolloError(
        'Failed to update tweet',
        'TWEET_UPDATE_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Mutation(() => Boolean, { 
    description: 'Like a tweet',
    nullable: true 
  })
  @Authorized() // Requires authentication
  async likeTweet(
    @Ctx() context: Context,
    @Arg("input", () => LikeTweetInput) input: LikeTweetInput
  ): Promise<boolean> {
    try {
      if (!context.user?.id) {
        throw new ApolloError('Authentication required', 'UNAUTHORIZED');
      }
      return await this.tweetService.likeTweet(input, context.user.id);
    } catch (error) {
      throw new ApolloError(
        'Failed to like tweet',
        'LIKE_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Mutation(() => Boolean, { 
    description: 'Unlike a tweet',
    nullable: true 
  })
  @Authorized() // Requires authentication
  async unlikeTweet(
    @Ctx() context: Context,
    @Arg("input", () => UnlikeTweetInput) input: UnlikeTweetInput
  ): Promise<boolean> {
    try {
      if (!context.user?.id) {
        throw new ApolloError('Authentication required', 'UNAUTHORIZED');
      }
      return await this.tweetService.unlikeTweet(input, context.user.id);
    } catch (error) {
      throw new ApolloError(
        'Failed to unlike tweet',
        'UNLIKE_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Query(() => Tweet, { 
    description: 'Get a single tweet by ID',
    nullable: true 
  })
  async fetchTweet(
    @Arg("id", () => ID) id: string
  ): Promise<Tweet | null> {
    try {
      return await this.tweetService.fetchTweet(id);
    } catch (error) {
      throw new ApolloError(
        'Failed to fetch tweet',
        'TWEET_FETCH_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Mutation(() => Boolean, { 
    description: 'Delete a tweet',
    nullable: true 
  })
  @Authorized()
  async deleteTweet(
    @Arg("input", () => DeleteTweetInput) input: DeleteTweetInput
  ): Promise<boolean> {
    try {
      // Verify the tweet exists and belongs to the user
      const tweet = await this.tweetService.fetchTweet(input.id);
      if (!tweet) {
        throw new Error('Tweet not found');
      }
      
      if (tweet.authorId !== input.authorId) {
        throw new Error('Unauthorized: You can only delete your own tweets');
      }
      
      // Delete the tweet
      await this.tweetService.deleteTweet(input.id);
      return true;
    } catch (error) {
      throw new ApolloError(
        'Failed to delete tweet',
        'TWEET_DELETION_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Mutation(() => Tweet, { 
    description: 'Comment on a tweet',
    nullable: true 
  })
  @Authorized()
  async commentOnTweet(
    @Ctx() context: Context,
    @Arg("input", () => CommentOnTweetInput) input: CommentOnTweetInput
  ): Promise<Tweet | null> {
    try {
      if (!context.user?.id) {
        throw new ApolloError('Authentication required', 'UNAUTHORIZED');
      }
      // Verify the tweet exists
      const tweet = await this.tweetService.fetchTweet(input.tweetId);
      if (!tweet) {
        throw new Error('Tweet not found');
      }
      
      // Create the comment
      const comment = await this.tweetService.commentOnTweet(
        input.text,
        context.user.id,
        input.tweetId
      );
      
      // Return the updated tweet with the new comment
      return await this.tweetService.fetchTweet(input.tweetId);
    } catch (error) {
      throw new ApolloError(
        'Failed to add comment',
        'COMMENT_ERROR',
        { originalError: error as Error }
      );
    }
  }
}