import 'reflect-metadata';
import { Container } from 'typedi';
import { sign, verify } from 'jsonwebtoken';
import { User } from '../../src/models/user.model';

describe('JWT Service', () => {
  const testUser = {
    id: '123',
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com'
  };

  const jwtSecret = process.env.JWT_SECRET || 'test-secret';

  it('should sign a JWT token with user data', () => {
    // Create a token
    const token = sign({ id: testUser.id, username: testUser.username }, jwtSecret, {
      expiresIn: '1h'
    });

    // Token should be a string
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // Header, payload, signature
  });

  it('should verify a valid JWT token', () => {
    // Create a token
    const token = sign({ id: testUser.id, username: testUser.username }, jwtSecret, {
      expiresIn: '1h'
    });

    // Verify the token
    const decoded = verify(token, jwtSecret);
    
    // Check if decoded data contains user info
    expect(decoded).toHaveProperty('id', testUser.id);
    expect(decoded).toHaveProperty('username', testUser.username);
  });

  it('should throw an error for an invalid JWT token', () => {
    // Invalid token
    const invalidToken = 'invalid.token.string';

    // Verification should throw an error
    expect(() => {
      verify(invalidToken, jwtSecret);
    }).toThrow();
  });
});
