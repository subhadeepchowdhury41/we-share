import jwt from 'jsonwebtoken';

// Test JWT secret
export const TEST_JWT_SECRET = 'test-jwt-secret';

// Mock JWT functions for testing
export function signJwt(object: Object, options?: jwt.SignOptions | undefined) {
  return jwt.sign(object, TEST_JWT_SECRET, {
    ...(options && options),
    expiresIn: '1h'
  });
}

export function verifyJwt<T>(token: string): T | null {
  try {
    // First try with our test secret
    const decoded = jwt.verify(token, TEST_JWT_SECRET) as T;
    return decoded;
  } catch (e) {
    try {
      // If that fails, try with the environment variable
      if (process.env.JWT_SECRET) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as T;
        return decoded;
      }
    } catch (innerError) {
      // Both verification attempts failed
      console.error('JWT verification failed:', innerError);
    }
    return null;
  }
}

// Mock the original JWT module for tests
export const mockJwtModule = () => {
  jest.mock('../../src/utils/jwt', () => ({
    signJwt,
    verifyJwt
  }));
};
