import { prisma } from './prisma.js'

export class SettingNotFoundError extends Error {}

export async function getTaxSettingOrThrow(storeId: number) {
  const setting = await prisma.setting.findUnique({ where: { storeId } })
  if (!setting) throw new SettingNotFoundError()
  return setting
}
