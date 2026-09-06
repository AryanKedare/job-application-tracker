import type { ApplicationAnalysisSnapshot } from '@/lib/application-analysis'

export interface AnalysisInsights {
  executiveSummary: string
  strengths: string[]
  bottlenecks: string[]
  patterns: string[]
  recommendations: string[]
  next7Days: string[]
}

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 48
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2)

function cleanText(value: unknown) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7e\n]/g, ' ')
    .replace(/[ \t]+/g, ' ')
}

function pdfEscape(value: string) {
  return cleanText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function wrapText(text: string, fontSize: number, width: number) {
  const maxCharacters = Math.max(12, Math.floor(width / (fontSize * 0.52)))
  const lines: string[] = []

  for (const paragraph of cleanText(text).split(/\n+/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean)
    if (!words.length) {
      lines.push('')
      continue
    }

    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (candidate.length > maxCharacters && line) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    if (line) lines.push(line)
  }

  return lines
}

function formatPercent(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`
}

export function buildApplicationAnalysisPdf(options: {
  snapshot: ApplicationAnalysisSnapshot
  insights: AnalysisInsights
  generatedAt: Date
}) {
  const { snapshot, insights, generatedAt } = options
  const pages: string[] = []
  let operations: string[] = []
  let y = PAGE_HEIGHT - MARGIN

  const drawText = (
    text: string,
    x: number,
    textY: number,
    size = 10,
    bold = false,
    color = '0.12 0.16 0.22',
  ) => {
    operations.push(
      `BT ${color} rg /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${textY.toFixed(1)} Tm (${pdfEscape(text)}) Tj ET`,
    )
  }

  const startNewPage = () => {
    if (operations.length) pages.push(operations.join('\n'))
    operations = []
    y = PAGE_HEIGHT - MARGIN
    drawText('JOB TRACKER - APPLICATION ANALYSIS', MARGIN, y, 8, true, '0.38 0.45 0.55')
    operations.push(`0.88 0.91 0.94 RG ${MARGIN} ${(y - 8).toFixed(1)} m ${(PAGE_WIDTH - MARGIN).toFixed(1)} ${(y - 8).toFixed(1)} l S`)
    y -= 28
  }

  const ensureSpace = (required: number) => {
    if (y - required < 58) startNewPage()
  }

  const line = (
    text: string,
    size = 10,
    bold = false,
    indent = 0,
    color?: string,
  ) => {
    ensureSpace(size * 1.7)
    drawText(text, MARGIN + indent, y, size, bold, color)
    y -= size * 1.45
  }

  const paragraph = (text: string, size = 10, indent = 0) => {
    const lines = wrapText(text, size, CONTENT_WIDTH - indent)
    for (const wrappedLine of lines) line(wrappedLine, size, false, indent)
    y -= 4
  }

  const heading = (text: string) => {
    ensureSpace(44)
    y -= 4
    line(text, 14, true, 0, '0.04 0.37 0.64')
    y -= 4
  }

  const bullet = (text: string) => {
    const lines = wrapText(text, 10, CONTENT_WIDTH - 18)
    ensureSpace((lines.length * 14.5) + 8)
    drawText('-', MARGIN, y, 10, true)
    for (let index = 0; index < lines.length; index += 1) {
      drawText(lines[index], MARGIN + 14, y - (index * 14.5), 10)
    }
    y -= (lines.length * 14.5) + 4
  }

  // Cover/header block.
  operations.push(`0.95 0.97 0.99 rg ${MARGIN} ${(PAGE_HEIGHT - 125).toFixed(1)} ${CONTENT_WIDTH} 77 re f`)
  drawText('JOB TRACKER', MARGIN, PAGE_HEIGHT - 62, 10, true, '0.04 0.37 0.64')
  drawText('Application Analysis Report', MARGIN, PAGE_HEIGHT - 87, 24, true)
  drawText(
    `Generated ${generatedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}`,
    MARGIN,
    PAGE_HEIGHT - 106,
    9,
    false,
    '0.38 0.45 0.55',
  )
  y = PAGE_HEIGHT - 145

  heading('Snapshot')
  const cards: Array<[string, string | number]> = [
    ['Applications', snapshot.totalApplications],
    ['Interview activity', snapshot.interviewActivity],
    ['Offers', snapshot.offers],
    ['Stale', snapshot.staleApplications],
  ]
  const gap = 8
  const cardWidth = (CONTENT_WIDTH - (gap * 3)) / 4
  const cardY = y - 54
  cards.forEach(([label, value], index) => {
    const x = MARGIN + (index * (cardWidth + gap))
    operations.push(`0.97 0.98 0.99 rg ${x.toFixed(1)} ${cardY.toFixed(1)} ${cardWidth.toFixed(1)} 50 re f`)
    drawText(String(value), x + 10, cardY + 27, 18, true)
    drawText(label, x + 10, cardY + 11, 7.5, false, '0.38 0.45 0.55')
  })
  y = cardY - 18

  paragraph(
    `${snapshot.applicationsLast30Days} applications were added in the last 30 days. `
      + `Interview activity rate: ${formatPercent(snapshot.interviewActivityRate)}. `
      + `Offer conversion from interview-active applications: ${formatPercent(snapshot.offerFromInterviewRate)}.`,
    9,
  )

  heading('Executive summary')
  paragraph(insights.executiveSummary, 10.5)

  heading('Status breakdown')
  const statusEntries = Object.entries(snapshot.statusCounts)
  const maxStatus = Math.max(...statusEntries.map(([, value]) => value), 1)
  for (const [status, count] of statusEntries) {
    ensureSpace(24)
    drawText(status, MARGIN, y, 9, true)
    const backgroundX = MARGIN + 110
    const barWidth = 300
    const fillWidth = barWidth * (count / maxStatus)
    operations.push(`0.88 0.92 0.96 rg ${backgroundX.toFixed(1)} ${(y - 2).toFixed(1)} ${barWidth} 10 re f`)
    operations.push(`0.05 0.45 0.72 rg ${backgroundX.toFixed(1)} ${(y - 2).toFixed(1)} ${fillWidth.toFixed(1)} 10 re f`)
    drawText(String(count), MARGIN + 420, y, 9, true)
    y -= 20
  }
  y -= 4

  if (snapshot.monthlyActivity.some((row) => row.applications > 0)) {
    heading('Recent application activity')
    const maxMonth = Math.max(...snapshot.monthlyActivity.map((row) => row.applications), 1)
    for (const row of snapshot.monthlyActivity) {
      ensureSpace(22)
      drawText(row.month, MARGIN, y, 9, true)
      const backgroundX = MARGIN + 90
      const barWidth = 260
      const fillWidth = barWidth * (row.applications / maxMonth)
      operations.push(`0.91 0.94 0.97 rg ${backgroundX.toFixed(1)} ${(y - 2).toFixed(1)} ${barWidth} 9 re f`)
      operations.push(`0.22 0.55 0.78 rg ${backgroundX.toFixed(1)} ${(y - 2).toFixed(1)} ${fillWidth.toFixed(1)} 9 re f`)
      drawText(String(row.applications), MARGIN + 365, y, 9, true)
      y -= 19
    }
  }

  if (snapshot.sourcePerformance.length) {
    heading('Source performance')
    snapshot.sourcePerformance.slice(0, 6).forEach((row) => {
      bullet(
        `${row.source}: ${row.total} application${row.total === 1 ? '' : 's'}, `
          + `${row.interviewActivity} with interview activity, ${row.offers} offer${row.offers === 1 ? '' : 's'}.`,
      )
    })
  }

  if (snapshot.rejectionStages.length) {
    heading('Rejection-stage signals')
    snapshot.rejectionStages.slice(0, 6).forEach((row) => {
      bullet(`${row.stage}: ${row.count} rejection${row.count === 1 ? '' : 's'} recorded at this stage.`)
    })
  }

  heading('What is working')
  insights.strengths.forEach(bullet)

  heading('Bottlenecks')
  insights.bottlenecks.forEach(bullet)

  heading('Patterns')
  insights.patterns.forEach(bullet)

  heading('Recommended actions')
  insights.recommendations.forEach(bullet)

  heading('Next 7 days')
  insights.next7Days.forEach(bullet)

  y -= 6
  paragraph(
    'This report is generated from application and lifecycle data stored in Job Tracker. '
      + 'AI-generated observations are directional and should be reviewed alongside your own context. '
      + 'Resume files, job-description text, and private notes are not sent to the analysis model.',
    8.5,
  )

  if (operations.length) pages.push(operations.join('\n'))

  const pageStreams = pages.map((page, index) => {
    const footer = `BT 0.45 0.50 0.58 rg /F1 8 Tf 1 0 0 1 ${MARGIN} 28 Tm (Job Tracker - Page ${index + 1} of ${pages.length}) Tj ET`
    return `${page}\n${footer}`
  })

  const objects: Array<string | undefined> = []
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'

  const pageReferences: string[] = []
  let objectId = 5
  for (const stream of pageStreams) {
    const pageObject = objectId
    const contentObject = objectId + 1
    objectId += 2
    pageReferences.push(`${pageObject} 0 R`)

    const length = Buffer.byteLength(stream, 'latin1')
    objects[contentObject] = `<< /Length ${length} >>\nstream\n${stream}\nendstream`
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`
  }

  objects[2] = `<< /Type /Pages /Kids [${pageReferences.join(' ')}] /Count ${pageStreams.length} >>`

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (let index = 1; index < objects.length; index += 1) {
    const object = objects[index]
    if (!object) throw new Error(`Missing PDF object ${index}`)
    offsets[index] = Buffer.byteLength(pdf, 'latin1')
    pdf += `${index} 0 obj\n${object}\nendobj\n`
  }

  const xrefOffset = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, 'latin1')
}
