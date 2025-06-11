import { Neo4jService } from '../../src/services/neo4j.service';
import { Container } from 'typedi';
import { User } from '../../src/models/user.model';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

/**
 * Helper class for managing the test database
 */
export class TestDbHelper {
  private neo4jService: Neo4jService;

  constructor() {
    this.neo4jService = Container.get(Neo4jService);
  }

  /**
   * Clear all data from the test database
   */
  async clearDatabase(): Promise<void> {
    const session = await this.neo4jService.getSession();
    try {
      // Delete all nodes and relationships
      await session.run('MATCH (n) DETACH DELETE n');
    } finally {
      await session.close();
    }
  }

  /**
   * Create test users in the database
   * @returns Array of created test users
   */
  async createTestUsers(): Promise<User[]> {
    const users: User[] = [];
    const session = await this.neo4jService.getSession();
    
    try {
      // Create test users with hashed passwords
      const salt = await bcrypt.genSalt(10);
      const password = await bcrypt.hash('password123', salt);
      
      const testUsers = [
        {
          id: uuidv4(),
          username: 'testuser1',
          email: 'test1@example.com',
          password,
          name: 'Test User 1',
          bio: 'Test bio 1',
          pfp: null,
          isVerified: false
        },
        {
          id: uuidv4(),
          username: 'testuser2',
          email: 'test2@example.com',
          password,
          name: 'Test User 2',
          bio: 'Test bio 2',
          pfp: null,
          isVerified: true
        }
      ];
      
      for (const userData of testUsers) {
        const result = await session.run(
          `CREATE (u:User {
            id: $id,
            username: $username,
            email: $email,
            password: $password,
            name: $name,
            bio: $bio,
            pfp: $pfp,
            isVerified: $isVerified,
            createdAt: datetime(),
            updatedAt: datetime()
          }) RETURN u`,
          userData
        );
        
        const userNode = result.records[0].get('u').properties;
        users.push({
          id: userNode.id,
          username: userNode.username,
          email: userNode.email,
          name: userNode.name,
          bio: userNode.bio,
          pfp: userNode.pfp,
          isVerified: userNode.isVerified,
          createdAt: new Date(userNode.createdAt),
          updatedAt: new Date(userNode.updatedAt)
        } as User);
      }
      
      // Create FOLLOWS relationships between users
      await session.run(
        `MATCH (u1:User {username: 'testuser1'}), (u2:User {username: 'testuser2'})
         CREATE (u1)-[r:FOLLOWS {since: datetime()}]->(u2)
         RETURN r`
      );
      
      return users;
    } finally {
      await session.close();
    }
  }
  
  /**
   * Create test tweets in the database
   * @param userId User ID who created the tweets
   * @returns Array of created tweet IDs
   */
  async createTestTweets(userId: string): Promise<string[]> {
    const tweetIds: string[] = [];
    const session = await this.neo4jService.getSession();
    
    try {
      for (let i = 1; i <= 3; i++) {
        const tweetId = uuidv4();
        await session.run(
          `MATCH (u:User {id: $userId})
           CREATE (t:Tweet {
             id: $tweetId,
             text: $text,
             authorId: $userId,
             createdAt: datetime(),
             updatedAt: datetime()
           })
           CREATE (u)-[:POSTED]->(t)
           RETURN t`,
          {
            userId,
            tweetId,
            text: `Test tweet ${i} content`
          }
        );
        tweetIds.push(tweetId);
      }
      
      return tweetIds;
    } finally {
      await session.close();
    }
  }
  
  /**
   * Initialize the test database with common test data
   * @returns Object containing created test data references
   */
  async initializeTestData() {
    await this.clearDatabase();
    const users = await this.createTestUsers();
    const tweets = await this.createTestTweets(users[0].id);
    
    return {
      users,
      tweets
    };
  }
}
