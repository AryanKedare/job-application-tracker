export type GroqMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GroqResponse {
  choices?: Array<{ message?: { content?: string } }>
}

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODELS = ['openai/gpt-oss-20b', 'llama-3.3-70b-versatile']
const RETRYABLE_STATUSES = new Set([400, 404, 408, 422, 429, 500, 502, 503, 504])

function modelsToTry() {
  const configured = process.env.GROQ_MODEL?.trim()
  return [...new Set([configured, ...DEFAULT_MODELS].filter((value): value is string => Boolean(value)))]
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

export async function groqJson<T>(
  messages: GroqMessage[],
  options?: { timeoutMs?: number; temperature?: number },
): Promise<{ data: T; model: string } | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) return null

  const timeoutMs = options?.timeoutMs ?? 12_000

  for (const model of modelsToTry()) {
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
      if (data) return { data, model }
    } catch {
      // Try the next configured production model.
    }
  }

  return null
}

export async function groqWebJson<T>(
  messages: GroqMessage[],
  options?: { timeoutMs?: number },
): Promise<{ data: T; model: string } | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) return null

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
        model: 'groq/compound',
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
    return data ? { data, model: 'groq/compound' } : null
  } catch {
    return null
  }
}
