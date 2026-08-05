import { NextRequest, NextResponse } from 'next/server'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export const runtime = 'nodejs'

const REQUEST_TIMEOUT_MS = 6_000
const MAX_REDIRECTS = 3
const MAX_HTML_BYTES = 750_000
const MAX_LOGO_BYTES = 1_000_000

interface ImageResult {
  bytes: ArrayBuffer
  contentType: string
}

interface WikidataSearchResult {
  id?: string
  label?: string
  description?: string
}

interface WikidataSearchResponse {
  search?: WikidataSearchResult[]
}

interface WikidataEntityResponse {
  entities?: Record<string, {
    claims?: {
      P154?: Array<{
        mainsnak?: {
          datavalue?: {
            value?: unknown
          }
        }
      }>
    }
  }>
}

const DOMAIN_ALIASES: Record<string, string[]> = {
  ing: ['ing.com'],
  inggroup: ['ing.com'],
  ey: ['ey.com'],
  ernstyoung: ['ey.com'],
  ernstandyoung: ['ey.com'],
  kerry: ['kerry.com', 'kerrygroup.com'],
  kerrygroup: ['kerry.com', 'kerrygroup.com'],
  nostra: ['nostra.ie'],
}

function normalizeCompany(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(limited|ltd|incorporated|inc|corporation|corp|plc|llc|group|holdings?|company|co)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function isPrivateIp(rawAddress: string): boolean {
  const address = rawAddress.toLowerCase()

  if (address === '::' || address === '::1' || address === '0.0.0.0') return true
  if (address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:')) return true

  const mappedIpv4 = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  const ipv4 = mappedIpv4 ?? (isIP(address) === 4 ? address : null)
  if (!ipv4) return false

  const parts = ipv4.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }

  const [a, b] = parts
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
}

async function assertPublicUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Unsupported URL')
  }
  if (url.hostname.toLowerCase() === 'localhost') throw new Error('Private host')

  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true })

  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error('Private address')
  }

  return url
}

async function fetchPublic(rawUrl: string, accept: string): Promise<Response> {
  let current = await assertPublicUrl(rawUrl)

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: accept,
        'User-Agent': 'JobApplicationTracker/1.0 (+company-logo-fetch)',
      },
      next: { revalidate: 60 * 60 * 24 * 7 },
    })

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location || redirectCount === MAX_REDIRECTS) throw new Error('Too many redirects')
      current = await assertPublicUrl(new URL(location, current).toString())
      continue
    }

    return response
  }

  throw new Error('Unable to fetch resource')
}

async function fetchImage(rawUrl: string): Promise<ImageResult | null> {
  try {
    const response = await fetchPublic(rawUrl, 'image/svg+xml,image/png,image/webp,image/jpeg;q=0.9')
    if (!response.ok) return null

    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (!contentType.startsWith('image/')) return null

    const declaredSize = Number(response.headers.get('content-length') ?? 0)
    if (declaredSize > MAX_LOGO_BYTES) return null

    const bytes = await response.arrayBuffer()
    if (!bytes.byteLength || bytes.byteLength > MAX_LOGO_BYTES) return null

    return { bytes, contentType }
  } catch {
    return null
  }
}

function scoreWikidataResult(company: string, result: WikidataSearchResult): number {
  const target = normalizeCompany(company)
  const label = normalizeCompany(result.label ?? '')
  const description = (result.description ?? '').toLowerCase()
  let score = 0

  if (label === target) score += 100
  else if (label.startsWith(target) || target.startsWith(label)) score += 45

  if (/company|business|bank|firm|corporation|organisation|organization|enterprise|manufacturer|provider/.test(description)) {
    score += 25
  }
  if (/film|song|album|book|person|given name|surname|village|municipality/.test(description)) {
    score -= 30
  }

  return score
}

async function findWikimediaLogo(company: string): Promise<ImageResult | null> {
  try {
    const searchUrl = new URL('https://www.wikidata.org/w/api.php')
    searchUrl.searchParams.set('action', 'wbsearchentities')
    searchUrl.searchParams.set('search', company)
    searchUrl.searchParams.set('language', 'en')
    searchUrl.searchParams.set('format', 'json')
    searchUrl.searchParams.set('limit', '8')
    searchUrl.searchParams.set('type', 'item')

    const searchResponse = await fetch(searchUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: 'application/json', 'User-Agent': 'JobApplicationTracker/1.0' },
      next: { revalidate: 60 * 60 * 24 * 7 },
    })
    if (!searchResponse.ok) return null

    const searchData = await searchResponse.json() as WikidataSearchResponse
    const results = [...(searchData.search ?? [])]
      .filter((result): result is WikidataSearchResult & { id: string } => typeof result.id === 'string')
      .sort((a, b) => scoreWikidataResult(company, b) - scoreWikidataResult(company, a))
      .slice(0, 6)

    if (!results.length) return null

    const entityUrl = new URL('https://www.wikidata.org/w/api.php')
    entityUrl.searchParams.set('action', 'wbgetentities')
    entityUrl.searchParams.set('ids', results.map((result) => result.id).join('|'))
    entityUrl.searchParams.set('props', 'claims')
    entityUrl.searchParams.set('format', 'json')

    const entityResponse = await fetch(entityUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: 'application/json', 'User-Agent': 'JobApplicationTracker/1.0' },
      next: { revalidate: 60 * 60 * 24 * 7 },
    })
    if (!entityResponse.ok) return null

    const entityData = await entityResponse.json() as WikidataEntityResponse
    for (const result of results) {
      const claims = entityData.entities?.[result.id]?.claims?.P154 ?? []
      for (const claim of claims) {
        const filename = claim.mainsnak?.datavalue?.value
        if (typeof filename !== 'string' || !filename.trim()) continue

        const commonsUrl = `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename)}?width=256`
        const image = await fetchImage(commonsUrl)
        if (image) return image
      }
    }
  } catch {
    // Fall through to official-site discovery.
  }

  return null
}

function readAttribute(tag: string, attribute: string): string {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']+)["']`, 'i'))
  return match?.[1]?.trim() ?? ''
}

function logoFromJson(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const logo = logoFromJson(item)
      if (logo) return logo
    }
    return ''
  }
  if (typeof value !== 'object') return ''

  const object = value as Record<string, unknown>
  if (object.logo) {
    const logo = logoFromJson(object.logo)
    if (logo) return logo
  }
  if (typeof object.url === 'string' && /logo/i.test(String(object['@type'] ?? ''))) {
    return object.url
  }
  if (object['@graph']) {
    const logo = logoFromJson(object['@graph'])
    if (logo) return logo
  }

  for (const nested of Object.values(object)) {
    const logo = logoFromJson(nested)
    if (logo) return logo
  }
  return ''
}

function extractLogoUrl(html: string, baseUrl: string): string {
  const jsonLdBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  for (const block of jsonLdBlocks) {
    try {
      const logo = logoFromJson(JSON.parse(block[1]))
      if (logo) return new URL(logo, baseUrl).toString()
    } catch {
      // Ignore malformed JSON-LD.
    }
  }

  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? []
  for (const tag of metaTags) {
    const key = readAttribute(tag, 'property') || readAttribute(tag, 'name') || readAttribute(tag, 'itemprop')
    if (!/^(og:logo|logo)$/i.test(key)) continue
    const content = readAttribute(tag, 'content')
    if (content) return new URL(content, baseUrl).toString()
  }

  const imageTags = html.match(/<img\b[^>]*>/gi) ?? []
  const ranked = imageTags
    .map((tag) => {
      const description = [readAttribute(tag, 'alt'), readAttribute(tag, 'class'), readAttribute(tag, 'id'), readAttribute(tag, 'data-testid')].join(' ')
      const source = readAttribute(tag, 'src') || readAttribute(tag, 'data-src') || readAttribute(tag, 'data-lazy-src')
      return { source, score: /\blogo\b/i.test(description) ? 10 : 0 }
    })
    .filter((item) => item.source && item.score > 0 && !item.source.startsWith('data:'))
    .sort((a, b) => b.score - a.score)

  return ranked[0]?.source ? new URL(ranked[0].source, baseUrl).toString() : ''
}

function domainCandidates(company: string): string[] {
  const normalized = normalizeCompany(company)
  const aliases = DOMAIN_ALIASES[normalized] ?? []
  const generated = normalized.length >= 2
    ? [`${normalized}.com`, `${normalized}.ie`, `${normalized}.co.uk`]
    : []
  return [...new Set([...aliases, ...generated])].slice(0, 5)
}

async function findOfficialSiteLogo(company: string): Promise<ImageResult | null> {
  for (const domain of domainCandidates(company)) {
    try {
      const response = await fetchPublic(`https://${domain}`, 'text/html,application/xhtml+xml')
      if (!response.ok) continue

      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) continue

      const declaredSize = Number(response.headers.get('content-length') ?? 0)
      if (declaredSize > MAX_HTML_BYTES) continue

      const html = (await response.text()).slice(0, MAX_HTML_BYTES)
      const logoUrl = extractLogoUrl(html, response.url || `https://${domain}`)
      if (!logoUrl) continue

      const image = await fetchImage(logoUrl)
      if (image) return image
    } catch {
      // Try the next candidate domain.
    }
  }

  return null
}

async function findLogoDevLogo(company: string): Promise<ImageResult | null> {
  const token = process.env.LOGO_DEV_PUBLISHABLE_KEY?.trim()
  if (!token) return null

  const url = `https://img.logo.dev/name/${encodeURIComponent(company)}?token=${encodeURIComponent(token)}&size=256&format=png&fallback=404`
  return fetchImage(url)
}

function imageResponse(image: ImageResult): NextResponse {
  return new NextResponse(image.bytes, {
    headers: {
      'Content-Type': image.contentType,
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function missingResponse(status = 404): NextResponse {
  return new NextResponse(null, {
    status,
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function GET(request: NextRequest) {
  const company = request.nextUrl.searchParams.get('company')?.trim() ?? ''
  if (!company || company.length > 200) return missingResponse(400)

  const logoDev = await findLogoDevLogo(company)
  if (logoDev) return imageResponse(logoDev)

  const wikimedia = await findWikimediaLogo(company)
  if (wikimedia) return imageResponse(wikimedia)

  const officialSite = await findOfficialSiteLogo(company)
  if (officialSite) return imageResponse(officialSite)

  return missingResponse()
}
