import { Neo4jService } from '../../src/services/neo4j.service';
import { Container } from 'typedi';
import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({ path: path.resolve(process.cwd(), '.env.test') });

describe('Neo4jService', () => {
  let neo4jService: Neo4jService;
  let session: any;

  beforeAll(() => {
    // Initialize the Neo4jService instance using typedi's container
    neo4jService = Container.get(Neo4jService);
  });

  afterAll(async () => {
    // Close any open sessions
    if (session) {
      await session.close();
    }
    // Close the driver
    await neo4jService.close();
  });

  describe('Database Connection', () => {
    it('should establish a successful connection to Neo4j', async () => {
      session = await neo4jService.getSession();
      const result = await session.run('RETURN 1 as test');
      expect(result.records[0].get('test').toNumber()).toBe(1);
      await session.close();
    });
  });

  describe('User Operations', () => {
    const testUserId = 'test-user-123';
    const testUser = {
      id: testUserId,
      username: 'testuser',
      email: 'test@example.com',
      password: 'testpass123',
      name: 'Test User'
    };

    beforeAll(async () => {
      session = await neo4jService.getSession();
      // Create a test user
      await session.run(
        `CREATE (u:User {
          id: $id,
          username: $username,
          email: $email,
          password: $password,
          name: $name,
          createdAt: datetime(),
          updatedAt: datetime()
        })`,
        testUser
      );
    });

    afterAll(async () => {
      // Clean up test data
      await session.run('MATCH (u:User {id: $id}) DETACH DELETE u', { id: testUserId });
      await session.close();
    });

    it('should retrieve a user by ID', async () => {
      const result = await session.run(
        'MATCH (u:User {id: $id}) RETURN u',
        { id: testUserId }
      );

      const user = result.records[0].get('u').properties;
      expect(user).toBeDefined();
      expect(user.username).toBe(testUser.username);
      expect(user.email).toBe(testUser.email);
    });
  });

  describe('Relationship Operations', () => {
    const user1 = { id: 'user1-123', username: 'user1' };
    const user2 = { id: 'user2-123', username: 'user2' };

    beforeAll(async () => {
      session = await neo4jService.getSession();
      // Create test users
      await session.run(
        `CREATE (u1:User {id: $id1, username: $username1}),
                (u2:User {id: $id2, username: $username2})`,
        {
          id1: user1.id,
          username1: user1.username,
          id2: user2.id,
          username2: user2.username
        }
      );
    });

    afterAll(async () => {
      // Clean up test data
      await session.run('MATCH (u:User) WHERE u.id IN [$id1, $id2] DETACH DELETE u', {
        id1: user1.id,
        id2: user2.id
      });
      await session.close();
    });

    it('should create a FOLLOWS relationship between users', async () => {
      await session.run(
        'MATCH (a:User {id: $followerId}), (b:User {id: $followingId}) ' +
        'CREATE (a)-[r:FOLLOWS {since: datetime()}]->(b) RETURN r',
        { followerId: user1.id, followingId: user2.id }
      );

      const result = await session.run(
        'MATCH (a:User {id: $followerId})-[r:FOLLOWS]->(b:User {id: $followingId}) ' +
        'RETURN r IS NOT NULL as hasRelationship',
        { followerId: user1.id, followingId: user2.id }
      );

      expect(result.records[0].get('hasRelationship')).toBe(true);
    });
  });
});
