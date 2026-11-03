/**
 * Screens loaded on demand can fail after an update: the new version replaces the files while the open app
 * still asks for the old ones. In that case the page is reloaded once, which opens the new version.
 * A second failure in a row is passed on to the ErrorBoundary instead of reloading forever.
 */

const RELOAD_KEY = 'gainlab:reloaded-for-update'

function readFlag(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_KEY) === '1'
  } catch {
    return true
  }
}

function writeFlag(on: boolean) {
  try {
    if (on) sessionStorage.setItem(RELOAD_KEY, '1')
    else sessionStorage.removeItem(RELOAD_KEY)
  } catch {
    // Without sessionStorage we never reload, to avoid a loop.
  }
}

export function withReloadOnFail<T>(load: () => Promise<T>, reload: () => void = () => window.location.reload()): () => Promise<T> {
  return () =>
    load().then(
      (module) => {
        writeFlag(false)
        return module
      },
      (error: unknown) => {
        if (readFlag()) throw error
        writeFlag(true)
        reload()
        // Keep showing the loading state while the page reloads.
        return new Promise<T>(() => {})
      },
    )
}
