// e2e/jest.config.js
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir:           '..',
  testMatch:         ['<rootDir>/e2e/**/*.test.js'],
  testTimeout:       120000,
  maxWorkers:        1,          // Detox must run serially
  globalSetup:       'detox/runners/jest/globalSetup',
  globalTeardown:    'detox/runners/jest/globalTeardown',
  reporters:         ['detox/runners/jest/reporter'],
  testEnvironment:   'detox/runners/jest/testEnvironment',
  verbose:           true,
};
