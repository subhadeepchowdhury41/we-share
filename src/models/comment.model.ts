import { Field, ObjectType, InputType, ID, Int } from 'type-graphql';
import { IComment, IUser, ITweet } from './base';
import { User } from './user.model';

// Interfaces for Neo4j nodes
export interface CommentNode extends Omit<IComment, 'createdAt' | 'updatedAt'> {
  id: string;
  text: string;
  authorId: string;
  tweetId: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  isLiked?: boolean;
  likesCount?: number;
}

export interface UserNode extends Omit<IUser, 'createdAt' | 'updatedAt' | 'pfp' | 'bio' | 'website' | 'location'> {
  id: string;
  username: string;
  name: string;
  email: string;
  pfp: string | null;
  bio: string | null;
  website: string | null;
  location: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface TweetNode extends ITweet {
  id: string;
  text: string;
  authorId: string;
}

@ObjectType()
export class Comment implements CommentNode {
  @Field(() => ID)
  id: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => String)
  text: string;

  @Field(() => String)
  authorId: string;

  @Field(() => String)
  tweetId: string;
  
  @Field(() => Boolean, { nullable: true })
  isLiked?: boolean;

  @Field(() => Int, { defaultValue: 0 })
  likesCount: number;

  @Field(() => User, { nullable: true })
  author?: User;
}

@InputType()
export class CreateCommentInput {
  @Field(() => String)
  text: string;

  @Field(() => String)
  authorId: string;

  @Field(() => String)
  tweetId: string;
}

@InputType()
export class LikeCommentInput {
  @Field(() => String)
  commentId: string;

  @Field(() => String)
  userId: string;
}

  @Field(() => String)
  userId: string;
}

  @Field(() => String)
  userId: string;
}

  @Field(() => String)
  userId: string;
}

  @Field(() => String)
  userId: string;
}

  @Field(() => String)
  userId: string;
}

  @Field(() => String)
  userId: string;
}

  @Field(() => String)
  userId: string;
}

  @Field(() => String)
  userId: string;
}

  @Field(() => String)
  userId: string;
}

  @Field(() => String)
  userId: string;
}
