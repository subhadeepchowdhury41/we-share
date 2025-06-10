import { randomUUID } from 'crypto';
import { sign, verify, JwtPayload } from 'jsonwebtoken';
import config from 'config';
import { User } from '../models/user.model';

interface TokenPayload extends JwtPayload {
  userId: string;
  email: string;
}

export default class JwtService {
  private readonly jwtSecret: string;
  private readonly jwtExpiration: number;

  constructor() {
    this.jwtSecret = config.get<string>('jwtSecret');
    this.jwtExpiration = config.get<number>('jwtExpiration');
  }

  /**
   * Creates a JWT token for the given user
   */
  async createToken(user: User): Promise<string> {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
    };

    return sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiration,
      jwtid: randomUUID(),
    });
  }

  /**
   * Verifies a JWT token and returns its payload if valid
   */
  verifyToken(token: string): TokenPayload | null {
    try {
      return verify(token, this.jwtSecret) as TokenPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Creates a refresh token (can be stored in database if needed)
   */
  createRefreshToken(): string {
    return randomUUID();
  }

  /**
   * Extracts the user ID from a JWT token
   */
  getUserIdFromToken(token: string): string | null {
    const payload = this.verifyToken(token);
    return payload?.userId || null;
  }

  /**
   * Checks if a token is expired
   */
  isTokenExpired(token: string): boolean {
    const payload = this.verifyToken(token);
    if (!payload?.exp) return true;
    return payload.exp * 1000 < Date.now();
  }
}