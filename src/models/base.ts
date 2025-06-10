import { v4 as uuidv4 } from 'uuid';

export class BaseNode {
  id: string;
  createdAt: Date;
  updatedAt: Date;

  constructor() {
    this.id = uuidv4();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

// Base interface for user data in the database
export interface IUser extends BaseNode {
  username: string;
  email: string;
  password: string; // Required in database
  name: string | null;
  bio: string | null;
  pfp: string | null;
  coverPhoto?: string;
  isVerified: boolean;
}

// Type for user data that can be safely exposed via GraphQL
export type PublicUserData = Omit<IUser, 'password'>;

export interface ITweet extends BaseNode {
  text: string;
  media: string[];
}

export interface IComment extends BaseNode {
  text: string;
}

// Relationship types
export enum RelationshipType {
  FOLLOWS = 'FOLLOWS',
  LIKES_TWEET = 'LIKES_TWEET',
  LIKES_COMMENT = 'LIKES_COMMENT',
  POSTED = 'POSTED',
  COMMENTS_ON = 'COMMENTS_ON',
  HAS_COMMENT = 'HAS_COMMENT'
}
