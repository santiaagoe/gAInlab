import { Component, type ErrorInfo, type ReactNode } from 'react'
import { backupName, downloadText } from '../download'
import { actions, rawSavedData } from '../store'

interface State {
  error: Error | null
  confirmReset: boolean
}

/**
 * Last line of defence: if a screen fails to render, show a way out instead of a blank page.
 * The saved data is never touched unless the user asks for it.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, confirmReset: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('gAInlab no pudo mostrar la pantalla', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    const reload = () => window.location.reload()
    const hasPrevious = actions.hasPrevious()

    return (
      <main className="app no-nav">
        <section className="section" role="alert">
          <h1 className="h2">Algo salió mal</h1>
          <p className="lede">
            La app no pudo mostrar esta pantalla. Tus datos siguen guardados en este celular. Descarga una copia antes de probar
            otra opción.
          </p>
          <div className="stack" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => downloadText(rawSavedData(), backupName('gainlab-mis-datos'))}>
              Descargar mis datos
            </button>
            <button className="btn btn-ghost" onClick={reload}>
              Volver a intentar
            </button>
            {hasPrevious && (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  if (actions.restorePrevious()) reload()
                }}
              >
                Restaurar copia anterior
              </button>
            )}
            {this.state.confirmReset ? (
              <div className="stack">
                <p className="small" style={{ margin: 0 }}>
                  Se borrarán tu plan y tus sesiones de este celular. Guardamos una copia que podrás restaurar desde aquí.
                </p>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    actions.resetAll()
                    reload()
                  }}
                >
                  Empezar de cero
                </button>
                <button className="btn btn-ghost" onClick={() => this.setState({ confirmReset: false })}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button className="btn btn-danger" onClick={() => this.setState({ confirmReset: true })}>
                Empezar de cero
              </button>
            )}
          </div>
          <p className="small muted" style={{ marginTop: 16 }}>
            Detalle: {this.state.error.message}
          </p>
        </section>
      </main>
    )
  }
}
