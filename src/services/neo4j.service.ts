import neo4j, { Driver, Session, Result, Record as Neo4jRecord, Transaction } from 'neo4j-driver';
import { config } from 'dotenv';
import { RelationshipType, IUser } from '../models/base';
import { Service } from 'typedi';

// Helper type to extract properties from Neo4j nodes
interface NodeProperties<T> {
  properties: T;
  identity: {
    low: number;
    high: number;
  };
  labels: string[];
}

// Helper type for Neo4j query results with a single node
type NodeRecord<T> = {
  get: (key: string) => NodeProperties<T>;
  [key: number]: any;
  keys: string[];
  length: number;
  has: (key: string) => boolean;
  forEach: (visitor: (values: any[], key: string, record: Neo4jRecord) => void) => void;
  toObject: () => Record<string, any>;
};

config();

@Service({ global: true })
export class Neo4jService {
  private driver: Driver;

  constructor() {
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'password';

    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }

  public async getSession(): Promise<Session> {
    return this.driver.session();
  }

  public async close(): Promise<void> {
    try {
      await this.driver.close();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error closing Neo4j driver:', errorMessage);
      throw new Error(`Failed to close Neo4j driver: ${errorMessage}`);
    }
  }

  public getDriver(): Driver {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized');
    }
    return this.driver;
  }

  // User methods
  public async createUser(userData: {
    id?: string;
    username: string;
    email: string;
    password: string;
    name?: string;
    bio?: string;
    pfp?: string;
  }): Promise<IUser> {
    console.log('Creating user with data:', JSON.stringify(userData, null, 2));
    const session = this.driver.session();
    try {
      const result = await session.writeTransaction(async (tx) => {
        // First create the user with the generated ID
        const createQuery = `
          CREATE (u:User {
            id: randomUUID(),
            username: $username,
            email: $email,
            password: $password,
            name: $name,
            bio: $bio,
            pfp: $pfp,
            isVerified: false,
            createdAt: datetime(),
            updatedAt: datetime()
          })
          RETURN u, u.id as userId, u.username as username
        `;
        
        // Create parameters object with proper typing
        const queryParams: Record<string, any> = {
          ...userData,
          name: userData.name || null,
          bio: userData.bio || null,
          pfp: userData.pfp || null
        };
        
        console.log('Executing query with params:', JSON.stringify(queryParams, null, 2));
        
        // Execute the query with proper typing
        const createResult = await tx.run<{
          u: NodeProperties<IUser>;
          userId: string;
          username: string;
        }>(createQuery, queryParams);
        
        console.log('Query result:', JSON.stringify({
          records: createResult.records.map((r: Neo4jRecord) => r.toObject()),
          summary: createResult.summary
        }, null, 2));

        if (createResult.records.length === 0) {
          throw new Error('Failed to create user: No records returned');
        }

        // Get the created user's data with proper typing
        const record = createResult.records[0];
        const userNode = record.get('u');
        const userId = record.get('userId');
        const username = record.get('username');
        
        console.log('Created user node:', JSON.stringify(userNode, null, 2));
        console.log('User ID:', userId);
        console.log('Username:', username);
        
        if (!userNode?.properties) {
          throw new Error('Invalid user node structure');
        }
        
        const userProps = userNode.properties;
        
        // Ensure we have all required fields
        if (!userProps.id) {
          throw new Error('User ID is missing from created node');
        }
        
        // Return the complete user data with proper typing
        const createdUserData: IUser = {
          id: String(userProps.id),
          username: String(userProps.username),
          email: String(userProps.email),
          name: userProps.name ? String(userProps.name) : null,
          bio: userProps.bio ? String(userProps.bio) : null,
          pfp: userProps.pfp ? String(userProps.pfp) : null,
          isVerified: Boolean(userProps.isVerified),
          createdAt: userProps.createdAt ? new Date(String(userProps.createdAt)) : new Date(),
          updatedAt: userProps.updatedAt ? new Date(String(userProps.updatedAt)) : new Date(),
          password: String(userProps.password) // This is hashed
        };
        
        console.log('Returning user data:', JSON.stringify(createdUserData, null, 2));
        return createdUserData;
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating user:', errorMessage);
      throw new Error(`Failed to create user: ${errorMessage}`);
    } finally {
      await session.close();
    }
  }

  public async findUserById(id: string): Promise<IUser | null> {
    const session = this.driver.session();
    try {
      const result = await session.readTransaction(async (tx) => {
        const queryResult = await tx.run(
          'MATCH (u:User {id: $id}) RETURN u',
          { id }
        );
        
        if (queryResult.records.length === 0) {
          return null;
        }
        
        const record = queryResult.records[0] as unknown as NodeRecord<IUser>;
        const userNode = record.get('u');
        return userNode.properties;
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error finding user by ID:', errorMessage);
      throw new Error(`Failed to find user: ${errorMessage}`);
    } finally {
      await session.close();
    }
  }

  public async findUserByUsername(username: string): Promise<IUser | null> {
    const session = this.driver.session();
    try {
      const result = await session.readTransaction(async (tx) => {
        const queryResult = await tx.run(
          'MATCH (u:User {username: $username}) RETURN u',
          { username }
        );
        
        if (queryResult.records.length === 0) {
          return null;
        }
        
        const record = queryResult.records[0] as unknown as NodeRecord<IUser>;
        const userNode = record.get('u');
        return userNode.properties;
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error finding user by username:', errorMessage);
      throw new Error(`Failed to find user: ${errorMessage}`);
    } finally {
      await session.close();
    }
  }

  // Relationship methods
  public async createRelationship(
    fromId: string,
    toId: string,
    relType: RelationshipType,
    properties: Record<string, any> = {}
  ): Promise<Result<Record<string, any>>> {
    const session = this.driver.session();
    try {
      return await session.writeTransaction((tx) =>
        tx.run(
          `
          MATCH (a), (b)
          WHERE a.id = $fromId AND b.id = $toId
          CREATE (a)-[r:${relType} $props]->(b)
          RETURN r
        `,
          {
            fromId,
            toId,
            props: {
              ...properties,
              createdAt: new Date().toISOString(),
            },
          }
        )
      );
    } finally {
      await session.close();
    }
  }

  public async deleteRelationship(
    fromId: string,
    toId: string,
    relType: RelationshipType
  ): Promise<void> {
    const session = this.driver.session();
    try {
      await session.writeTransaction((tx) =>
        tx.run(
          `
          MATCH (a {id: $fromId})-[r:${relType}]->(b {id: $toId})
          DELETE r
        `,
          { fromId, toId }
        )
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error deleting relationship:', errorMessage);
      throw new Error(`Failed to delete relationship: ${errorMessage}`);
    } finally {
      await session.close();
    }
  }

  // Generic query method
  public async executeQuery<T = any>(
    query: string,
    params: Record<string, any> = {}
  ): Promise<Result<Record<string, any>>> {
    const session = this.driver.session();
    try {
      return await session.run(query, params);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error executing query:', errorMessage);
      throw new Error(`Failed to execute query: ${errorMessage}`);
    } finally {
      await session.close();
    }
  }
}

export default new Neo4jService();