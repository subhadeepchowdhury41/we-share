import { UserService } from "../services/user.service";
import { Container } from 'typedi';
import Context from "../types/context";

import { signJwt } from '../utils/jwt';
import { Resolver, Query, Mutation, Arg, ID, Int, Ctx, Authorized, ObjectType, Field } from 'type-graphql';
import { ApolloError } from 'apollo-server-core';
import { Service } from 'typedi';
import { User, LoginUserInput, UpdateUserInput, CreateUserInput, FollowUserInput, UnfollowUserInput } from "../models/user.model";
import { Tweet } from "../models/tweet.model";

export @ObjectType()
class RegisterResponse {
  @Field(() => User)
  user: User;

  @Field()
  token: string;

  constructor(user: User, token: string) {
    this.user = user;
    this.token = token;
  }
}

export @ObjectType()
class LoginResponse {
  @Field(() => User)
  user: User;

  @Field()
  token: string;

  constructor(user: User, token: string) {
    this.user = user;
    this.token = token;
  }
}

// Create a type that represents the UserService instance type
@Resolver(() => User)
@Service()
export class UserResolver {
    private userService: UserService;
  
  constructor() {
    this.userService = Container.get(UserService);
  }
  
  @Query(() => User, { nullable: true, description: 'Fetch a user by ID' })
  async fetchUser(@Arg('id', () => ID) id: string): Promise<User | null> {
    try {
      return await this.userService.findUserById(id);
    } catch (error) {
      throw new ApolloError(
        'Failed to fetch user',
        'FETCH_USER_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Mutation(() => LoginResponse, { description: 'Login a user' })
  async loginUser(
    @Arg('input', () => LoginUserInput) input: LoginUserInput,
    @Ctx() context: Context
  ): Promise<LoginResponse> {
    try {
      const user = await this.userService.validatePassword({
        username: input.username,
        password: input.password
      });

      if (!user) {
        throw new ApolloError('Invalid credentials', 'INVALID_CREDENTIALS');
      }

      const token = signJwt({ id: user.id });
      context.user = user;
      
      return new LoginResponse(user, token);
    } catch (error) {
      if (error instanceof ApolloError) throw error;
      throw new ApolloError(
        'Login failed',
        'LOGIN_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Query(() => [User], { description: 'List all users' })
  @Authorized()
  async listUsers(): Promise<User[]> {
    try {
      return await this.userService.getAllUsers();
    } catch (error) {
      throw new ApolloError(
        'Failed to fetch users',
        'FETCH_USERS_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Query(() => [User], { description: 'List users that a user is following' })
  @Authorized()
  async listFollowings(@Arg('userId', () => ID) userId: string): Promise<User[]> {
    try {
      return await this.userService.getFollowings(userId);
    } catch (error) {
      throw new ApolloError(
        'Failed to fetch followings',
        'FETCH_FOLLOWINGS_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Query(() => [User], { description: 'List users that are following a user' })
  @Authorized()
  async listFollowers(@Arg('userId', () => ID) userId: string): Promise<User[]> {
    try {
      return await this.userService.getFollowers(userId);
    } catch (error) {
      throw new ApolloError(
        'Failed to fetch followers',
        'FETCH_FOLLOWERS_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Query(() => [Tweet], { description: 'Get recommended tweets for a user' })
  @Authorized()
  async getRecommendedTweets(
    @Ctx() context: Context,
    @Arg('limit', () => Int, { nullable: true, defaultValue: 10 }) limit: number
  ): Promise<Tweet[]> {
    try {
      if (!context.user?.id) {
        throw new ApolloError('Authentication required', 'UNAUTHORIZED');
      }
      return await this.userService.getRecommendedTweets(context.user.id, limit);
    } catch (error) {
      throw new ApolloError(
        'Failed to fetch recommended tweets',
        'FETCH_RECOMMENDED_TWEETS_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Mutation(() => RegisterResponse, { description: 'Register a new user' })
  async registerUser(
    @Arg('input', () => CreateUserInput) input: CreateUserInput,
    @Ctx() context: Context
  ): Promise<RegisterResponse> {
    try {
      // Check if user already exists
      const existingUser = await this.userService.findUserByUsername(input.username);
      if (existingUser) {
        throw new ApolloError('Username already exists', 'USER_EXISTS');
      }

      // Create new user
      const user = await this.userService.createUser(input);
      
      // Generate0JWT token
      const token = signJwt({ id: user.user.id });
      context.user = user.user;
      
      return new RegisterResponse(user.user, token);
    } catch (error) {
      if (error instanceof ApolloError) throw error;
      console.error('Registration error:', error);
      throw new ApolloError(
        'Registration failed',
        'REGISTRATION_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Mutation(() => Boolean)
  async updateUser(
    @Ctx() context: Context,
    @Arg("input", () => UpdateUserInput) input: UpdateUserInput
  ): Promise<boolean> {
    try {
      const userId = context.user?.id;
      if (!userId) {
        throw new ApolloError("Authentication required", "UNAUTHORIZED");
      }

      const result = await this.userService.updateUser(userId, input);
      return result !== null;
    } catch (error) {
      throw new ApolloError(
        "Failed to update user",
        "USER_UPDATE_ERROR",
        { originalError: error }
      );
    }
  }

  @Mutation(() => Boolean)
  async followUser(
    @Ctx() context: Context,
    @Arg("input", () => FollowUserInput) input: FollowUserInput
  ): Promise<boolean> {
    try {
      const userId = context.user?.id;
      if (!userId) {
        throw new ApolloError("Authentication required", "UNAUTHORIZED");
      }

      if (userId === input.targetUserId) {
        throw new ApolloError("Cannot follow yourself", "INVALID_OPERATION");
      }

      // Check if already following
      const existingFollow = await this.userService.getFollowings(userId);
      const isFollowing = existingFollow.some(f => f.id === input.targetUserId);

      if (isFollowing) {
        throw new ApolloError("Already following this user", "ALREADY_FOLLOWING");
      }

      await this.userService.followUser(input.targetUserId, userId);

      return true;
    } catch (error) {
      throw new ApolloError(
        "Failed to follow user",
        "FOLLOW_ERROR",
        { originalError: error }
      );
    }
  }

  @Mutation(() => Boolean, { description: 'Unfollow a user' })
  @Authorized()
  async unfollowUser(
    @Ctx() context: Context,
    @Arg('input', () => UnfollowUserInput) input: UnfollowUserInput
  ): Promise<boolean> {
    try {
      const userId = context.user?.id;
      if (!userId) {
        throw new ApolloError('Authentication required', 'UNAUTHORIZED');
      }

      if (userId === input.targetUserId) {
        throw new ApolloError('Cannot unfollow yourself', 'INVALID_OPERATION');
      }

      await this.userService.unfollowUser(input.targetUserId, userId);
      return true;
    } catch (error) {
      throw new ApolloError(
        'Failed to unfollow user',
        'UNFOLLOW_USER_ERROR',
        { originalError: error as Error }
      );
    }
  }

  @Mutation(() => Boolean, { description: 'Delete a user account and all associated data' })
  @Authorized()
  async deleteUser(
    @Arg('userId', () => ID) userId: string,
    @Arg('password', () => String, { description: 'User password for confirmation' }) password: string,
    @Ctx() context: Context
  ): Promise<boolean> {
    try {
      // Get the current user from the context
      const currentUser = context.user;
      
      if (!currentUser) {
        throw new ApolloError('Authentication required', 'UNAUTHENTICATED');
      }

      // Verify the request is from the user themselves
      if (currentUser.id !== userId) {
        throw new ApolloError('You can only delete your own account', 'FORBIDDEN');
      }

      // Verify the provided password
      const user = await this.userService.validatePassword({
        username: currentUser.username,
        password
      });

      if (!user) {
        throw new ApolloError('Invalid password', 'INVALID_CREDENTIALS');
      }

      // Call the service to delete the user
      const result = await this.userService.deleteUser(userId);
      
      if (!result) {
        throw new ApolloError('User not found or could not be deleted', 'USER_DELETION_FAILED');
      }

      // Clear the user session
      context.res?.clearCookie('token');
      
      return true;
    } catch (error) {
      if (error instanceof ApolloError) throw error;
      
      console.error('Error in deleteUser resolver:', error);
      throw new ApolloError(
        'Failed to delete user account',
        'USER_DELETION_FAILED',
        { originalError: error as Error }
      );
    }
  }
}