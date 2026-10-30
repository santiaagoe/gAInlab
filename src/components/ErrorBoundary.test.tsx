// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

function Broken(): never {
  throw new Error('Ejercicio desconocido')
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('ErrorBoundary', () => {
  it('shows the app when nothing fails', () => {
    act(() =>
      root.render(
        <ErrorBoundary>
          <p>Hoy toca</p>
        </ErrorBoundary>,
      ),
    )
    expect(container.textContent).toBe('Hoy toca')
  })

  it('replaces a blank screen with ways out', () => {
    act(() =>
      root.render(
        <ErrorBoundary>
          <Broken />
        </ErrorBoundary>,
      ),
    )
    const text = container.textContent ?? ''
    expect(text).toMatch(/Algo salió mal/)
    expect(text).toMatch(/Descargar mis datos/)
    expect(text).toMatch(/Volver a intentar/)
    expect(text).toMatch(/Empezar de cero/)
    // Without a previous copy there is nothing to restore.
    expect(text).not.toMatch(/Restaurar copia anterior/)
  })

  it('offers the previous copy when there is one, and asks before resetting', () => {
    localStorage.setItem('gainlab:v1:prev', JSON.stringify({ version: 1, sessions: [] }))
    act(() =>
      root.render(
        <ErrorBoundary>
          <Broken />
        </ErrorBoundary>,
      ),
    )
    expect(container.textContent).toMatch(/Restaurar copia anterior/)
    const reset = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Empezar de cero')!
    act(() => reset.click())
    expect(container.textContent).toMatch(/Se borrarán tu plan y tus sesiones/)
  })
})
