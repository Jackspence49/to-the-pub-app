// Minimal react-native mock for the utils (ts-jest / node) test project.
// Only needs the surface area used by utility functions.
module.exports = {
  Linking: {
    openURL: jest.fn(),
    canOpenURL: jest.fn(() => Promise.resolve(true)),
  },
  Platform: {
    OS: 'ios',
    select: (specifics) => specifics['ios'] ?? specifics['default'],
  },
};
