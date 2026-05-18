// .detoxrc.js
/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: { '$0':'jest', config:'e2e/jest.config.js' },
    jest: { setupTimeout: 120000 },
  },
  apps: {
    'ios.debug': {
      type:        'ios.app',
      binaryPath:  'ios/build/Build/Products/Debug-iphonesimulator/UsApp.app',
      build:       'xcodebuild -workspace ios/UsApp.xcworkspace -scheme UsApp -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: { type:'iPhone 17 Pro' },  // or 'iPhone 16 Pro' if 17 not available
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app:    'ios.debug',
    },
  },
};
