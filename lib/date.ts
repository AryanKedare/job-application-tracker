export type DateValue = string | number | Date | null | undefined

const pad = (value: number) => String(value).padStart(2, '0')

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
  if (!date) return ''
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

export function formatLocalDateTime(value: DateValue): string {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return formatLocalDate(value)
  }

  const date = parseDate(value)
  if (!date) return ''

  const hours24 = date.getHours()
  const hours12 = hours24 % 12 || 12
  const period = hours24 >= 12 ? 'PM' : 'AM'
  return `${pad(hours12)}:${pad(date.getMinutes())} ${period} ${formatLocalDate(date)}`
}
