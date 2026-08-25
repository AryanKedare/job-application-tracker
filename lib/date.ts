export type DateValue = string | number | Date | null | undefined

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

function normalizePostgresTimestamp(value: string) {
  return value.replace(/(\.\d{3})\d+(?=(?:Z|[+-]\d{2}:?\d{2})$)/, '$1')
}

function parseDate(value: DateValue): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const normalized = typeof value === 'string' ? normalizePostgresTimestamp(value.trim()) : value
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatLocalDate(value: DateValue): string {
  if (!value) return ''
  if (typeof value === 'string') {
    const dateOnly = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`
  }

  const date = parseDate(value)
  return date ? DATE_FORMATTER.format(date) : ''
}

export function formatLocalDateTime(value: DateValue): string {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return formatLocalDate(value)
  }

  const date = parseDate(value)
  return date ? `${TIME_FORMATTER.format(date)} ${DATE_FORMATTER.format(date)}` : ''
}
