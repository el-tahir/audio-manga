import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './', // Path to Next.js app
});

/** @type {import('jest').Config} */
const config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'], // if you have a setup file
  testEnvironment: 'node', // For API routes and server-side code
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1', // Adjust if your alias is different
  },
  // preset: 'ts-jest', // Rely on Next.js swc via createJestConfig
};

export default createJestConfig(config);
