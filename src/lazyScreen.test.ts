// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { withReloadOnFail } from './lazyScreen'

afterEach(() => {
  sessionStorage.clear()
})

describe('withReloadOnFail', () => {
  it('returns the screen when it loads', async () => {
    const reload = vi.fn()
    await expect(withReloadOnFail(() => Promise.resolve('ok'), reload)()).resolves.toBe('ok')
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads once when the file of an old version is gone', async () => {
    const reload = vi.fn()
    const load = withReloadOnFail(() => Promise.reject(new Error('Failed to fetch dynamically imported module')), reload)
    void load()
    await Promise.resolve()
    await Promise.resolve()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload again if it fails right after reloading', async () => {
    const reload = vi.fn()
    sessionStorage.setItem('gainlab:reloaded-for-update', '1')
    const load = withReloadOnFail(() => Promise.reject(new Error('sigue fallando')), reload)
    await expect(load()).rejects.toThrow('sigue fallando')
    expect(reload).not.toHaveBeenCalled()
  })

  it('a successful load allows reloading again on a later update', async () => {
    const reload = vi.fn()
    sessionStorage.setItem('gainlab:reloaded-for-update', '1')
    await withReloadOnFail(() => Promise.resolve('ok'), reload)()
    expect(sessionStorage.getItem('gainlab:reloaded-for-update')).toBeNull()
  })
})
