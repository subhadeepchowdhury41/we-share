import { Field, ObjectType, InputType, ID } from 'type-graphql';
import { ITweet } from './base';
import { BaseUser } from './shared.types';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

@ObjectType()
export class Tweet implements ITweet {
  @Field(() => ID)
  id: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => String)
  text: string;

  @Field(() => [String], { defaultValue: [] })
  media: string[];

  @Field(() => String)
  authorId: string;

  @Field(() => Number, { defaultValue: 0 })
  likesCount: number;

  @Field(() => Number, { defaultValue: 0 })
  commentsCount: number;

  @Field(() => Number, { defaultValue: 0 })
  retweetsCount: number;

  @Field(() => Boolean, { defaultValue: false })
  isLiked: boolean;

  @Field(() => BaseUser, { nullable: true })
  author?: BaseUser;
}

@InputType()
export class CreateTweetInput {
  @Field(() => String)
  @IsNotEmpty({ message: 'Tweet text is required' })
  text: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  media?: string[];
}

@InputType()
export class UpdateTweetInput {
  @Field(() => String)
  id: string;

  @Field(() => String, { nullable: true })
  text?: string;

  @Field(() => [String], { nullable: true })
  media?: string[];
}

@InputType()
export class LikeTweetInput {
  @Field(() => String)
  @IsUUID()
  tweetId: string;
}

@InputType()
export class UnlikeTweetInput {
  @Field(() => String)
  @IsUUID()
  tweetId: string;
}

@InputType()
export class CommentOnTweetInput {
  @Field(() => String)
  tweetId: string;

  @Field(() => String)
  text: string;
}

@InputType()
export class DeleteTweetInput {
  @Field(() => String)
  id: string;

  @Field(() => String)
  authorId: string;
}

@ObjectType()
export class TweetStats {
  @Field(() => Number)
  likesCount: number;

  @Field(() => Number)
  commentsCount: number;

  @Field(() => Number)
  retweetsCount: number;

  @Field(() => Boolean)
  isLiked: boolean;
}

@ObjectType()
export class TweetResponse {
  @Field(() => Tweet)
  tweet: Tweet;

  @Field(() => TweetStats)
  stats: TweetStats;
}

export interface TweetNode {
  id: string;
  text: string;
  media?: string[];
  authorId: string;
  likesCount?: number;
  commentsCount?: number;
  retweetsCount?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface UserNode {
  id: string;
  username: string;
  name: string;
  email?: string;
  bio?: string;
  pfp?: string;
  coverPhoto?: string;
  isVerified?: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}
