
import 'reflect-metadata';
import { config } from 'dotenv';
import path from 'path';
import { beforeAll, afterAll } from '@jest/globals';
import { Container } from 'typedi';
// Load environment variables from .env.test file
config({ path: path.resolve(process.cwd(), '.env.test') });

// Set default test environment variables if not set
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Global test setup can go here
const globalSetup = async () => {
  // Any global test setup logic
  Container.reset();
  console.log('Global test setup complete');
};

// Run the setup before all tests
beforeAll(async () => {
  await globalSetup();
});

// Cleanup after all tests
afterAll(async () => {
  // Any cleanup logic
  console.log('Tests completed');
});
