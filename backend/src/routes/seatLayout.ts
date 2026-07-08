import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'
import { ErrorCodes, sendError } from '../lib/errors.js'
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

async function fetchLayout(storeId: number): Promise<SeatLayoutResponse> {
  const [setting, tables, seats] = await Promise.all([
    prisma.setting.findUnique({ where: { storeId } }),
    prisma.seatTable.findMany({ where: { storeId } }),
    prisma.seat.findMany({ where: { storeId } }),
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
  fastify.get('/', async (request) => fetchLayout(request.storeId))

  fastify.put('/', { schema: { body: putBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const { canvasCols, canvasRows, gridSize, tables, seats } = request.body as PutBody
    const { storeId } = request

    // Setting・削除対象を並列取得
    const [setting, dbSeats, dbTables] = await Promise.all([
      prisma.setting.findUnique({ where: { storeId } }),
      prisma.seat.findMany({ where: { storeId }, select: { id: true } }),
      prisma.seatTable.findMany({ where: { storeId }, select: { id: true } }),
    ])

    // DB の制約値でバリデーション
    const colsMin = setting?.canvasColsMin ?? 8
    const colsMax = setting?.canvasColsMax ?? 32
    const rowsMin = setting?.canvasRowsMin ?? 6
    const rowsMax = setting?.canvasRowsMax ?? 24
    const gsMin = setting?.gridSizeMin ?? 32
    const gsMax = setting?.gridSizeMax ?? 80
    if (canvasCols < colsMin || canvasCols > colsMax) {
      return sendError(reply, 400, ErrorCodes.SeatLayout.CanvasColsOutOfRange, `canvasCols は ${colsMin}〜${colsMax} の範囲で指定してください`, { min: colsMin, max: colsMax })
    }
    if (canvasRows < rowsMin || canvasRows > rowsMax) {
      return sendError(reply, 400, ErrorCodes.SeatLayout.CanvasRowsOutOfRange, `canvasRows は ${rowsMin}〜${rowsMax} の範囲で指定してください`, { min: rowsMin, max: rowsMax })
    }
    if (gridSize < gsMin || gridSize > gsMax) {
      return sendError(reply, 400, ErrorCodes.SeatLayout.GridSizeOutOfRange, `gridSize は ${gsMin}〜${gsMax} の範囲で指定してください`, { min: gsMin, max: gsMax })
    }

    // 自店舗が所有する ID のみを対象にする（他店舗 ID の注入防止）
    const dbTableIds = new Set(dbTables.map(t => t.id))
    const dbSeatIds = new Set(dbSeats.map(s => s.id))
    const ownedTables = tables.filter(t => t.id < 0 || dbTableIds.has(t.id))
    const ownedSeats = seats.filter(s => s.id < 0 || dbSeatIds.has(s.id))
    const invalidTableId = ownedSeats.find(s => s.tableId != null && s.tableId > 0 && !dbTableIds.has(s.tableId))?.tableId
    if (invalidTableId != null) {
      return sendError(reply, 422, ErrorCodes.SeatLayout.InvalidTableId, '無効なテーブルが含まれています', { tableId: invalidTableId })
    }

    // 削除対象の事前チェック（使用中席の保護）
    const reqSeatIds = new Set(ownedSeats.filter(s => s.id > 0).map(s => s.id))
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
        return sendError(reply, 409, ErrorCodes.SeatLayout.BusySeatsIncluded, '使用中の席が含まれています', {
          seatIds: busySeats.map(gs => gs.seatId),
        })
      }
    }

    await prisma.$transaction(async (tx) => {
      // Setting 更新
      await tx.setting.update({ where: { storeId }, data: { canvasCols, canvasRows, gridSize } })

      // SeatTable 削除
      const reqTableIds = new Set(ownedTables.filter(t => t.id > 0).map(t => t.id))
      const deleteTableIds = dbTables.map(t => t.id).filter(id => !reqTableIds.has(id))
      if (deleteTableIds.length > 0) {
        await tx.seatTable.deleteMany({ where: { id: { in: deleteTableIds } } })
      }

      // SeatTable 作成（仮ID → 実ID マップ構築）
      const idMap = new Map<number, number>()
      for (const t of ownedTables.filter(t => t.id < 0)) {
        const created = await tx.seatTable.create({ data: { label: t.label, x: t.x, y: t.y, w: t.w, h: t.h, storeId } })
        idMap.set(t.id, created.id)
      }

      // SeatTable 更新
      for (const t of ownedTables.filter(t => t.id > 0)) {
        await tx.seatTable.update({ where: { id: t.id }, data: { label: t.label, x: t.x, y: t.y, w: t.w, h: t.h } })
      }

      // Seat 削除
      if (deleteSeatIds.length > 0) {
        await tx.seat.deleteMany({ where: { id: { in: deleteSeatIds } } })
      }

      // Seat 作成
      for (const s of ownedSeats.filter(s => s.id < 0)) {
        const tid = s.tableId != null ? (idMap.get(s.tableId) ?? s.tableId) : null
        await tx.seat.create({ data: { label: s.label, type: tid != null ? 'table' : 'counter', x: s.x, y: s.y, tableId: tid, storeId } })
      }

      // Seat 更新
      for (const s of ownedSeats.filter(s => s.id > 0)) {
        const tid = s.tableId != null ? (idMap.get(s.tableId) ?? s.tableId) : null
        await tx.seat.update({ where: { id: s.id }, data: { label: s.label, type: tid != null ? 'table' : 'counter', x: s.x, y: s.y, tableId: tid } })
      }
    })

    const layout = await fetchLayout(storeId)
    fastify.io.to(`store:${request.storeId}`).emit('seatLayout:updated', layout)
    return layout
  })
}

export default seatLayoutRoutes
