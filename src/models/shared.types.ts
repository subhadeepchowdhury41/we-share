import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class BaseUser {
  @Field(() => String)
  id: string;

  @Field(() => String)
  username: string;

  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  bio?: string;

  @Field(() => String, { nullable: true })
  pfp?: string;

  @Field(() => String, { nullable: true })
  coverPhoto?: string;

  @Field(() => Boolean, { defaultValue: false })
  isVerified: boolean;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

export interface PaginationInput {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}
