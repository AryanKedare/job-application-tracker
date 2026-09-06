import { getAdminSupabase } from '@/lib/admin-supabase'

export interface CompanyLogoCacheValue {
  companyKey: string
  domain: string | null
  officialUrl: string | null
  logoUrl: string | null
  resolverModel: string | null
  expiresAt: string
}

const TABLE = 'company_logo_cache'

export async function readCompanyLogoCache(companyKey: string): Promise<CompanyLogoCacheValue | null> {
  try {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase
      .from(TABLE)
      .select('company_key,domain,official_url,logo_url,resolver_model,expires_at')
      .eq('company_key', companyKey)
      .maybeSingle()

    if (error || !data) return null
    if (!data.expires_at || new Date(data.expires_at).getTime() <= Date.now()) return null

    return {
      companyKey: data.company_key,
      domain: data.domain ?? null,
      officialUrl: data.official_url ?? null,
      logoUrl: data.logo_url ?? null,
      resolverModel: data.resolver_model ?? null,
      expiresAt: data.expires_at,
    }
  } catch {
    // Cache availability must never break company-avatar rendering.
    return null
  }
}

export async function writeCompanyLogoCache(options: {
  companyKey: string
  domain?: string | null
  officialUrl?: string | null
  logoUrl?: string | null
  resolverModel?: string | null
  ttlMs: number
}) {
  try {
    const supabase = getAdminSupabase()
    const existing = await readCompanyLogoCache(options.companyKey)

    const domain = 'domain' in options ? options.domain ?? null : existing?.domain ?? null
    const officialUrl = 'officialUrl' in options ? options.officialUrl ?? null : existing?.officialUrl ?? null
    const logoUrl = 'logoUrl' in options ? options.logoUrl ?? null : existing?.logoUrl ?? null
    const resolverModel = 'resolverModel' in options ? options.resolverModel ?? null : existing?.resolverModel ?? null

    await supabase.from(TABLE).upsert({
      company_key: options.companyKey,
      domain,
      official_url: officialUrl,
      logo_url: logoUrl,
      resolver_model: resolverModel,
      resolved_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + options.ttlMs).toISOString(),
    }, {
      onConflict: 'company_key',
    })
  } catch {
    // Cache writes are best-effort and must never break logo rendering.
  }
}
