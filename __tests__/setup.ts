
import 'reflect-metadata';
import { config } from 'dotenv';
import path from 'path';
import { beforeAll, afterAll } from '@jest/globals';
import { Container } from 'typedi';
import { Neo4jService } from '../src/services/neo4j.service';
import { UserService } from '../src/services/user.service';
import { TestDbHelper } from './helpers/test-db.helper';
import { TweetService } from '../src/services/tweet.service';

// Load environment variables from .env.test file
config({ path: path.resolve(process.cwd(), '.env.test') });

// Set default test environment variables if not set
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Global test setup
const globalSetup = async () => {
  // Reset container to ensure clean dependency injection for each test run
  Container.reset();
  
  // Register services in the container
  Container.set(Neo4jService, new Neo4jService());
  Container.set(UserService, new UserService(Container.get(Neo4jService), Container.get(TweetService)));
  
  console.log('Global test setup complete');
};

// Run the setup before all tests
beforeAll(async () => {
  await globalSetup();
});

// Cleanup after all tests
afterAll(async () => {
  try {
    // Get Neo4j service and close connections
    const neo4jService = Container.get(Neo4jService);
    
    // Check if neo4jService has a close method
    if (neo4jService && typeof neo4jService.close === 'function') {
      await neo4jService.close();
      console.log('Neo4j connections closed');
    } else {
      // Try to get the driver and close it directly
      if (neo4jService && typeof neo4jService.getDriver === 'function') {
        const driver = neo4jService.getDriver();
        if (driver && typeof driver.close === 'function') {
          await driver.close();
          console.log('Neo4j driver closed directly');
        }
      }
    }
  } catch (error) {
    console.error('Error during test cleanup:', error);
  }
  
  console.log('Tests completed');
});

// Make test helpers available globally
export { TestDbHelper };
