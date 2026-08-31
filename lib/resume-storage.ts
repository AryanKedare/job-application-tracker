const PUBLIC_RESUME_MARKER = '/storage/v1/object/public/resumes/'
const SIGNED_RESUME_MARKER = '/storage/v1/object/sign/resumes/'

export function resumeStoragePath(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null

  if (!raw.includes('://')) return raw.replace(/^\/+/, '') || null

  try {
    const url = new URL(raw)
    const marker = url.pathname.includes(PUBLIC_RESUME_MARKER)
      ? PUBLIC_RESUME_MARKER
      : url.pathname.includes(SIGNED_RESUME_MARKER)
        ? SIGNED_RESUME_MARKER
        : null

    if (!marker) return null
    const encodedPath = url.pathname.slice(url.pathname.indexOf(marker) + marker.length)
    return encodedPath ? decodeURIComponent(encodedPath) : null
  } catch {
    return null
  }
}

export function spreadsheetSafe(value: string): string {
  return /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value
}
