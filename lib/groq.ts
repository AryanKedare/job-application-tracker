import { readCompanyLogoCache, writeCompanyLogoCache } from '@/lib/company-logo-cache'

export type GroqMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GroqResponse {
  choices?: Array<{ message?: { content?: string } }>
}

export type GroqReasoningEffort = 'low' | 'medium' | 'high'

export interface GroqJsonOptions {
  timeoutMs?: number
  temperature?: number
  models?: string[]
  reasoningEffort?: GroqReasoningEffort
  maxCompletionTokens?: number
}

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODELS = ['openai/gpt-oss-20b', 'llama-3.3-70b-versatile']
const RETRYABLE_STATUSES = new Set([400, 404, 408, 422, 429, 500, 502, 503, 504])
const POSITIVE_LOGO_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const NEGATIVE_LOGO_CACHE_TTL_MS = 12 * 60 * 60 * 1000

function modelsToTry(overrides?: string[]) {
  const configured = process.env.GROQ_MODEL?.trim()
  const requested = overrides?.map((value) => value.trim()).filter(Boolean) ?? []
  const fallback = requested.length ? [] : [configured, ...DEFAULT_MODELS]
  return [...new Set([...requested, ...fallback].filter((value): value is string => Boolean(value)))]
}

function parseJsonContent<T>(content: string): T | null {
  try {
    return JSON.parse(content) as T
  } catch {
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      return JSON.parse(content.slice(start, end + 1)) as T
    } catch {
      return null
    }
  }
}

function companyNameFromMessages(messages: GroqMessage[]) {
  const userMessage = [...messages].reverse().find((message) => message.role === 'user')?.content ?? ''
  const match = userMessage.match(/Untrusted company name:\s*([^\n]+)/i)
  return match?.[1]?.trim().slice(0, 200) ?? ''
}

function companyCacheKey(company: string) {
  return company.toLowerCase().replace(/\s+/g, ' ').trim()
}

function isCompanyDomainLookup(messages: GroqMessage[]) {
  return messages.some((message) =>
    message.role === 'system' && message.content.includes('official public website domain for the supplied company name'),
  )
}

function isCompanyWebLogoLookup(messages: GroqMessage[]) {
  return messages.some((message) =>
    message.role === 'system' && message.content.includes('official website and an official raster logo for the supplied company'),
  )
}

function isJobImportLookup(messages: GroqMessage[]) {
  return messages.some((message) =>
    message.role === 'system' && message.content.includes('Extract factual details from the supplied job posting.'),
  )
}

function importModels() {
  const configured = process.env.GROQ_IMPORT_MODEL?.trim()
  const fallback = process.env.GROQ_MODEL?.trim()
  return [...new Set([configured, fallback, 'openai/gpt-oss-20b'].filter((value): value is string => Boolean(value)))]
}

function logoDomainModels() {
  const configured = process.env.GROQ_LOGO_MODEL?.trim()
  return [...new Set([configured, 'llama-3.1-8b-instant', 'openai/gpt-oss-20b'].filter((value): value is string => Boolean(value)))]
}

function logoWebModel(): 'groq/compound' | 'groq/compound-mini' {
  return process.env.GROQ_LOGO_WEB_MODEL?.trim() === 'groq/compound'
    ? 'groq/compound'
    : 'groq/compound-mini'
}

export async function groqJson<T>(
  messages: GroqMessage[],
  options?: GroqJsonOptions,
): Promise<{ data: T; model: string } | null> {
  const logoDomainLookup = isCompanyDomainLookup(messages)
  const jobImportLookup = isJobImportLookup(messages)
  const company = logoDomainLookup ? companyNameFromMessages(messages) : ''
  const cacheKey = company ? companyCacheKey(company) : ''

  if (cacheKey) {
    const cached = await readCompanyLogoCache(cacheKey)
    if (cached) {
      return {
        data: { domain: cached.domain ?? '' } as T,
        model: cached.resolverModel ? `cache:${cached.resolverModel}` : 'cache',
      }
    }
  }

  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) return null

  const timeoutMs = options?.timeoutMs ?? 12_000
  const requestedModels = options?.models
    ?? (logoDomainLookup ? logoDomainModels() : jobImportLookup ? importModels() : undefined)

  for (const model of modelsToTry(requestedModels)) {
    try {
      const response = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model,
          temperature: options?.temperature ?? 0,
          response_format: { type: 'json_object' },
          messages,
          ...(options?.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
          ...(options?.maxCompletionTokens ? { max_completion_tokens: options.maxCompletionTokens } : {}),
        }),
      })

      if (!response.ok) {
        if (RETRYABLE_STATUSES.has(response.status)) continue
        return null
      }

      const payload = await response.json() as GroqResponse
      const content = payload.choices?.[0]?.message?.content?.trim()
      if (!content) continue

      const data = parseJsonContent<T>(content)
      if (!data) continue

      if (cacheKey) {
        const domain = typeof (data as Record<string, unknown>).domain === 'string'
          ? String((data as Record<string, unknown>).domain).trim() || null
          : null
        await writeCompanyLogoCache({
          companyKey: cacheKey,
          domain,
          resolverModel: model,
          ttlMs: domain ? POSITIVE_LOGO_CACHE_TTL_MS : NEGATIVE_LOGO_CACHE_TTL_MS,
        })
      }

      return { data, model }
    } catch {
      // Try the next configured production model.
    }
  }

  return null
}

export async function groqWebJson<T>(
  messages: GroqMessage[],
  options?: { timeoutMs?: number; model?: 'groq/compound' | 'groq/compound-mini' },
): Promise<{ data: T; model: string } | null> {
  const logoLookup = isCompanyWebLogoLookup(messages)
  const company = logoLookup ? companyNameFromMessages(messages) : ''
  const cacheKey = company ? companyCacheKey(company) : ''

  if (cacheKey) {
    const cached = await readCompanyLogoCache(cacheKey)
    if (cached?.resolverModel?.startsWith('groq/compound')) {
      return {
        data: {
          official_url: cached.officialUrl ?? '',
          logo_url: cached.logoUrl ?? '',
        } as T,
        model: `cache:${cached.resolverModel}`,
      }
    }
  }

  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) return null

  const model = options?.model ?? (logoLookup ? logoWebModel() : 'groq/compound-mini')

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Groq-Model-Version': 'latest',
      },
      signal: AbortSignal.timeout(options?.timeoutMs ?? 20_000),
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages,
        compound_custom: {
          tools: {
            enabled_tools: ['web_search', 'visit_website'],
          },
        },
      }),
    })

    if (!response.ok) return null

    const payload = await response.json() as GroqResponse
    const content = payload.choices?.[0]?.message?.content?.trim()
    if (!content) return null

    const data = parseJsonContent<T>(content)
    if (!data) return null

    if (cacheKey) {
      const object = data as Record<string, unknown>
      const officialUrl = typeof object.official_url === 'string' ? object.official_url.trim() || null : null
      const logoUrl = typeof object.logo_url === 'string' ? object.logo_url.trim() || null : null
      await writeCompanyLogoCache({
        companyKey: cacheKey,
        officialUrl,
        logoUrl,
        resolverModel: model,
        ttlMs: officialUrl || logoUrl ? POSITIVE_LOGO_CACHE_TTL_MS : NEGATIVE_LOGO_CACHE_TTL_MS,
      })
    }

    return { data, model }
  } catch {
    return null
  }
}
