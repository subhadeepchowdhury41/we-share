import { Field, ObjectType, InputType, ID, registerEnumType } from 'type-graphql';
import { IUser, RelationshipType } from './base';
import { Tweet } from './tweet.model';
import { BaseUser } from './shared.types';
import { IsEmail, IsNotEmpty, IsOptional, MaxLength, MinLength } from 'class-validator';

registerEnumType(RelationshipType, {
  name: 'RelationshipType',
  description: 'Type of relationship between nodes'
});

@ObjectType()
export class User extends BaseUser implements IUser {
  // Required by IUser but not exposed via GraphQL
  // We use a private field to store the password internally
  private _password: string;

  // Public getter that's not exposed via GraphQL
  get password(): string {
    return this._password;
  }

  // Required by IUser
  set password(value: string) {
    this._password = value;
  }

  // Override fields from BaseUser to ensure they're included in GraphQL schema
  @Field(() => ID, { name: 'id' })
  override id: string;

  @Field(() => Date, { name: 'createdAt' })
  override createdAt: Date;

  @Field(() => Date, { name: 'updatedAt' })
  override updatedAt: Date;

  @Field(() => String, { name: 'username' })
  override username: string;

  @Field(() => String, { name: 'name' })
  override name: string;

  @Field(() => String, { name: 'email', nullable: true })
  override email: string;

  @Field(() => String, { name: 'bio', nullable: true })
  override bio: string;

  @Field(() => String, { name: 'pfp', nullable: true })
  override pfp: string;

  @Field(() => String, { name: 'coverPhoto', nullable: true })
  override coverPhoto?: string;

  @Field(() => Boolean, { name: 'isVerified', defaultValue: false })
  override isVerified: boolean;

  @Field(() => [Tweet], { nullable: true })
  tweets?: Tweet[];

  @Field(() => [Tweet], { nullable: true })
  likedTweets?: Tweet[];
}

@InputType()
export class CreateUserInput {
  @Field(() => String)
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(30, { message: 'Username must not be longer than 30 characters' })
  username: string;

  @Field(() => String)
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @Field(() => String)
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MaxLength(50, { message: 'Name must not be longer than 50 characters' })
  name?: string;
}

@InputType()
export class LoginUserInput {
  @Field(() => String)
  @IsNotEmpty({ message: 'Username is required' })
  username: string;

  @Field(() => String)
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}

@InputType()
export class UpdateUserInput {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  bio?: string;

  @Field(() => String, { nullable: true })
  pfp?: string;
}

@InputType()
export class FollowUserInput {
  @Field(() => String)
  @IsNotEmpty({ message: 'Target user ID is required' })
  targetUserId: string;
}

@InputType()
export class UnfollowUserInput {
  @Field(() => String)
  @IsNotEmpty({ message: 'Target user ID is required' })
  targetUserId: string;
}
