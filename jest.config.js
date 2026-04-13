module.exports = {
  projects: [
    {
      displayName: 'utils',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/utils/__tests__/**/*.test.ts'],
    },
    {
      displayName: 'hooks',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/hooks/__tests__/**/*.test.{ts,tsx}'],
    },
  ],
};
