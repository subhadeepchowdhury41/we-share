import { TweetResolver } from './tweet.resolver';
import { UserResolver } from './user.resolver';

export const resolvers = [UserResolver, TweetResolver] as const;