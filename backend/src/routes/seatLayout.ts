import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'
import type { SeatLayoutResponse } from '@order-system/shared'

const putBodySchema = {
  type: 'object',
  required: ['canvasCols', 'canvasRows', 'gridSize', 'tables', 'seats'],
  properties: {
    canvasCols: { type: 'integer' },
    canvasRows:  { type: 'integer' },
    gridSize:    { type: 'integer', minimum: 32, maximum: 80 },
    tables: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'label', 'x', 'y', 'w', 'h'],
        properties: {
          id:    { type: 'integer' },
          label: { type: 'string', minLength: 1 },
          x: { type: 'number' }, y: { type: 'number' },
          w: { type: 'number', minimum: 1 }, h: { type: 'number', minimum: 1 },
        },
        additionalProperties: false,
      },
    },
    seats: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'label', 'x', 'y'],
        properties: {
          id:      { type: 'integer' },
          label:   { type: 'string', minLength: 1 },
          x: { type: 'number' }, y: { type: 'number' },
          tableId: { type: ['integer', 'null'] },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const

type PutBody = {
  canvasCols: number
  canvasRows: number
  gridSize: number
  tables: Array<{ id: number; label: string; x: number; y: number; w: number; h: number }>
  seats: Array<{ id: number; label: string; x: number; y: number; tableId?: number | null }>
}

async function fetchLayout(): Promise<SeatLayoutResponse> {
  const [setting, tables, seats] = await Promise.all([
    prisma.setting.findUnique({ where: { id: 1 } }),
    prisma.seatTable.findMany(),
    prisma.seat.findMany(),
  ])
  return {
    canvasCols:    setting?.canvasCols    ?? 16,
    canvasRows:    setting?.canvasRows    ?? 12,
    canvasColsMin: setting?.canvasColsMin ?? 8,
    canvasColsMax: setting?.canvasColsMax ?? 32,
    canvasRowsMin: setting?.canvasRowsMin ?? 6,
    canvasRowsMax: setting?.canvasRowsMax ?? 24,
    gridSize:      setting?.gridSize      ?? 48,
    gridSizeMin:   setting?.gridSizeMin   ?? 32,
    gridSizeMax:   setting?.gridSizeMax   ?? 80,
    tables,
    seats,
  }
}

const seatLayoutRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => fetchLayout())

  fastify.put('/', { schema: { body: putBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const { canvasCols, canvasRows, gridSize, tables, seats } = request.body as PutBody

    // Setting・削除対象を並列取得
    const [setting, dbSeats, dbTables] = await Promise.all([
      prisma.setting.findUnique({ where: { id: 1 } }),
      prisma.seat.findMany({ select: { id: true } }),
      prisma.seatTable.findMany({ select: { id: true } }),
    ])

    // DB の制約値でバリデーション
    const colsMin = setting?.canvasColsMin ?? 8
    const colsMax = setting?.canvasColsMax ?? 32
    const rowsMin = setting?.canvasRowsMin ?? 6
    const rowsMax = setting?.canvasRowsMax ?? 24
    const gsMin = setting?.gridSizeMin ?? 32
    const gsMax = setting?.gridSizeMax ?? 80
    if (canvasCols < colsMin || canvasCols > colsMax) {
      return reply.status(400).send({ error: `canvasCols は ${colsMin}〜${colsMax} の範囲で指定してください` })
    }
    if (canvasRows < rowsMin || canvasRows > rowsMax) {
      return reply.status(400).send({ error: `canvasRows は ${rowsMin}〜${rowsMax} の範囲で指定してください` })
    }
    if (gridSize < gsMin || gridSize > gsMax) {
      return reply.status(400).send({ error: `gridSize は ${gsMin}〜${gsMax} の範囲で指定してください` })
    }

    // 削除対象の事前チェック（使用中席の保護）
    const reqSeatIds = new Set(seats.filter(s => s.id > 0).map(s => s.id))
    const deleteSeatIds = dbSeats.map(s => s.id).filter(id => !reqSeatIds.has(id))

    if (deleteSeatIds.length > 0) {
      const busySeats = await prisma.groupSeat.findMany({
        where: {
          seatId: { in: deleteSeatIds },
          group: { status: { in: ['active', 'bill_requested'] } },
        },
        select: { seatId: true },
      })
      if (busySeats.length > 0) {
        return reply.status(409).send({
          error: '使用中の席が含まれています',
          seatIds: busySeats.map(gs => gs.seatId),
        })
      }
    }

    await prisma.$transaction(async (tx) => {
      // Setting 更新
      await tx.setting.update({ where: { id: 1 }, data: { canvasCols, canvasRows, gridSize } })

      // SeatTable 削除
      const reqTableIds = new Set(tables.filter(t => t.id > 0).map(t => t.id))
      const deleteTableIds = dbTables.map(t => t.id).filter(id => !reqTableIds.has(id))
      if (deleteTableIds.length > 0) {
        await tx.seatTable.deleteMany({ where: { id: { in: deleteTableIds } } })
      }

      // SeatTable 作成（仮ID → 実ID マップ構築）
      const idMap = new Map<number, number>()
      for (const t of tables.filter(t => t.id < 0)) {
        const created = await tx.seatTable.create({ data: { label: t.label, x: t.x, y: t.y, w: t.w, h: t.h } })
        idMap.set(t.id, created.id)
      }

      // SeatTable 更新
      for (const t of tables.filter(t => t.id > 0)) {
        await tx.seatTable.update({ where: { id: t.id }, data: { label: t.label, x: t.x, y: t.y, w: t.w, h: t.h } })
      }

      // Seat 削除
      if (deleteSeatIds.length > 0) {
        await tx.seat.deleteMany({ where: { id: { in: deleteSeatIds } } })
      }

      // Seat 作成
      for (const s of seats.filter(s => s.id < 0)) {
        const tid = s.tableId != null ? (idMap.get(s.tableId) ?? s.tableId) : null
        await tx.seat.create({ data: { label: s.label, type: tid != null ? 'table' : 'counter', x: s.x, y: s.y, tableId: tid } })
      }

      // Seat 更新
      for (const s of seats.filter(s => s.id > 0)) {
        const tid = s.tableId != null ? (idMap.get(s.tableId) ?? s.tableId) : null
        await tx.seat.update({ where: { id: s.id }, data: { label: s.label, type: tid != null ? 'table' : 'counter', x: s.x, y: s.y, tableId: tid } })
      }
    })

    return fetchLayout()
  })
}

export default seatLayoutRoutes
