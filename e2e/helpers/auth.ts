import type { Page } from '@playwright/test'
import ja from '../../frontend/src/i18n/locales/ja'

export const CREDS = {
  admin: { username: 'admin', password: 'admin1234' },
  staff: { username: 'staff', password: 'staff1234' },
}

export async function loginAs(page: Page, role: 'admin' | 'staff', opts?: { host?: string }) {
  const { username, password } = CREDS[role]
  const url = opts?.host ? `${opts.host}/api/auth/login` : '/api/auth/login'
  await page.request.post(url, { data: { username, password } })
  await page.goto(opts?.host ?? '/')
  await page.waitForSelector(`text=${ja.nav.home}`, { timeout: 10000 })
}
