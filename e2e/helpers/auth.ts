import type { Page } from '@playwright/test'
import ja from '../../frontend/src/i18n/locales/ja'

export const CREDS = {
  admin: { username: 'admin', password: 'admin1234' },
  staff: { username: 'staff', password: 'staff1234' },
}

export async function loginAs(page: Page, role: 'admin' | 'staff') {
  const { username, password } = CREDS[role]
  await page.request.post('/api/auth/login', { data: { username, password } })
  await page.goto('/')
  await page.waitForSelector(`text=${ja.nav.home}`, { timeout: 10000 })
}
