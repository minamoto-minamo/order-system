import {
  ApiError,
  apiErrorMessage,
  ClientErrorCodes,
  invalidJsonApiError,
  networkApiError,
  timeoutApiError,
  toApiError,
} from '../lib/apiError'

describe('toApiError', () => {
  it('body の error.message を serverMessage と message に反映する', () => {
    const e = toApiError(409, 'Conflict', {
      error: {
        code: 'categories.delete.in_use',
        message: '使用中のカテゴリは削除できません',
        details: null,
      },
    })
    expect(e).toBeInstanceOf(ApiError)
    expect(e.status).toBe(409)
    expect(e.serverCode).toBe('categories.delete.in_use')
    expect(e.serverMessage).toBe('使用中のカテゴリは削除できません')
    expect(e.details).toBeNull()
    expect(e.message).toBe('使用中のカテゴリは削除できません')
  })

  it('body が null なら serverMessage は null、message は status + statusText', () => {
    const e = toApiError(500, 'Internal Server Error', null)
    expect(e.serverMessage).toBeNull()
    expect(e.message).toBe('500 Internal Server Error')
  })

  it('旧 Fastify 組み込みエラー body の error は serverMessage にしない', () => {
    const e = toApiError(400, 'Bad Request', {
      statusCode: 400,
      code: 'FST_ERR_VALIDATION',
      error: 'Bad Request',
      message: 'body/password must NOT have fewer than 8 characters',
    })
    expect(e.serverMessage).toBeNull()
    expect(e.message).toBe('400 Bad Request')
  })

  it('error.message が文字列以外なら serverMessage は null', () => {
    expect(toApiError(400, 'Bad Request', { error: 123 }).serverMessage).toBeNull()
    expect(toApiError(400, 'Bad Request', { message: 'x' }).serverMessage).toBeNull()
    expect(toApiError(400, 'Bad Request', { error: { message: 123 } }).serverMessage).toBeNull()
    expect(toApiError(400, 'Bad Request', 'text body').serverMessage).toBeNull()
  })
})

describe('client generated ApiError', () => {
  it('ネットワーク失敗用の ApiError を生成する', () => {
    const e = networkApiError()
    expect(e).toBeInstanceOf(ApiError)
    expect(e.status).toBe(0)
    expect(e.serverCode).toBe(ClientErrorCodes.NetworkUnreachable)
    expect(e.serverMessage).toBe('サーバーに接続できません')
  })

  it('JSON parse 失敗用の ApiError を生成する', () => {
    const e = invalidJsonApiError(200, 'OK')
    expect(e.status).toBe(200)
    expect(e.serverCode).toBe(ClientErrorCodes.InvalidJson)
    expect(e.serverMessage).toBe('サーバーから不正なレスポンスを受信しました')
  })

  it('timeout 用の ApiError を生成する', () => {
    const e = timeoutApiError()
    expect(e.status).toBe(0)
    expect(e.serverCode).toBe(ClientErrorCodes.NetworkTimeout)
    expect(e.serverMessage).toBe('リクエストがタイムアウトしました')
  })
})

describe('apiErrorMessage', () => {
  it('serverMessage を持つ ApiError ならそれを返す', () => {
    const e = new ApiError(422, '自分自身は削除できません')
    expect(apiErrorMessage(e, '削除できませんでした')).toBe('自分自身は削除できません')
  })

  it('serverMessage のない ApiError は fallback を返す', () => {
    const e = new ApiError(500, null, 'Internal Server Error')
    expect(apiErrorMessage(e, '操作に失敗しました')).toBe('操作に失敗しました')
  })

  it('ApiError 以外（Error・非 Error）は fallback を返す', () => {
    expect(apiErrorMessage(new Error('boom'), 'fallback')).toBe('fallback')
    expect(apiErrorMessage(undefined, 'fallback')).toBe('fallback')
    expect(apiErrorMessage('oops', 'fallback')).toBe('fallback')
  })
})
