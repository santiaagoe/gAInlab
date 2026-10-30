/** Saves text as a file on the device. */
export function downloadText(text: string, filename: string, type = 'application/json') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // Some mobile browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function backupName(prefix = 'gainlab-respaldo'): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.json`
}
