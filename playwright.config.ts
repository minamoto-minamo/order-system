import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

config({ path: './env/backend.env' })

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  maxFailures: 1,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'pnpm --filter backend dev',
      port: 3000,
      reuseExistingServer: true,
    },
    {
      command: 'pnpm --filter frontend dev',
      port: 5173,
      reuseExistingServer: true,
    },
  ],
})
