import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@order-system/shared$': '<rootDir>/../shared/types/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          rootDir: '.',
          module: 'ESNext',
          moduleResolution: 'bundler',
        },
      },
    ],
  },
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
}

export default config
