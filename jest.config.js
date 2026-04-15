module.exports = {
  projects: [
    {
      displayName: 'utils',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/utils/__tests__/**/*.test.ts'],
      moduleNameMapper: {
        '^react-native$': '<rootDir>/__mocks__/react-native-node.js',
      },
    },
    {
      displayName: 'hooks',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/hooks/__tests__/**/*.test.{ts,tsx}'],
      setupFiles: ['<rootDir>/hooks/__tests__/setup-env.ts'],
    },
    {
      displayName: 'components',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/components/__tests__/**/*.test.{ts,tsx}'],
      setupFiles: ['<rootDir>/hooks/__tests__/setup-env.ts'],
    },
  ],
};
