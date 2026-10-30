import { backupName, downloadText } from '../download'
import { actions, corruptData, exportData, useStoreStatus } from '../store'

/** Warns when data could not be saved or could not be read in full. Shown on every screen. */
export function StatusBanner() {
  const { persistError, loadIssue } = useStoreStatus()

  if (persistError) {
    return (
      <div className="banner warn" role="alert">
        <span>
          No pudimos guardar en este celular (la memoria puede estar llena o el navegador en modo privado). Lo que anotes se
          perderá al cerrar la app.
        </span>
        <div className="banner-actions">
          <button onClick={() => downloadText(exportData(), backupName())}>Descargar respaldo</button>
        </div>
      </div>
    )
  }

  if (loadIssue) {
    const original = corruptData()
    return (
      <div className="banner warn" role="alert">
        <span>
          {loadIssue === 'corrupt'
            ? 'No pudimos leer tus datos guardados, así que la app empezó de cero. Guardamos una copia del original.'
            : 'Algunos datos guardados estaban dañados y los dejamos fuera. Guardamos una copia del original.'}
        </span>
        <div className="banner-actions">
          {original && <button onClick={() => downloadText(original, backupName('gainlab-datos-originales'))}>Descargar copia</button>}
          <button onClick={() => actions.dismissLoadIssue()}>Entendido</button>
        </div>
      </div>
    )
  }

  return null
}
