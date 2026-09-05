'use client'

import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'

interface Props {
  company?: string | null
  fallbackName: string
}

const iconCache = new Map<string, string>()
const pendingIcons = new Map<string, Promise<string | null>>()

function avatarDetails(name: string) {
  const safeName = name.trim() || '?'
  const initials = safeName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
  const palettes = ['bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-500', 'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600']
  const color = palettes[safeName.charCodeAt(0) % palettes.length]
  return { initials, color }
}

function companyCacheKey(company: string) {
  return company.toLowerCase().replace(/\s+/g, ' ').trim()
}

async function fetchCompanyIcon(company: string): Promise<string | null> {
  const cacheKey = companyCacheKey(company)
  const cached = iconCache.get(cacheKey)
  if (cached) return cached

  const pending = pendingIcons.get(cacheKey)
  if (pending) return pending

  const request = (async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) return null

    try {
      const response = await fetch(`/api/company-icon?company=${encodeURIComponent(company)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (!response.ok) return null

      const blob = await response.blob()
      if (!blob.size || !blob.type.startsWith('image/')) return null

      const objectUrl = URL.createObjectURL(blob)
      iconCache.set(cacheKey, objectUrl)
      return objectUrl
    } catch {
      return null
    }
  })()

  pendingIcons.set(cacheKey, request)
  try {
    return await request
  } finally {
    pendingIcons.delete(cacheKey)
  }
}

export default function CompanyAvatar({ company, fallbackName }: Props) {
  const companyName = company?.trim() ?? ''
  const fallback = companyName || fallbackName
  const { initials, color } = avatarDetails(fallback)
  const cacheKey = companyName ? companyCacheKey(companyName) : ''
  const [iconSrc, setIconSrc] = useState<string | null>(() => cacheKey ? iconCache.get(cacheKey) ?? null : null)

  useEffect(() => {
    let cancelled = false
    const cached = cacheKey ? iconCache.get(cacheKey) ?? null : null
    setIconSrc(cached)

    if (!companyName || cached) return () => { cancelled = true }

    void fetchCompanyIcon(companyName).then((src) => {
      if (!cancelled && src) setIconSrc(src)
    })

    return () => { cancelled = true }
  }, [cacheKey, companyName])

  const handleImageError = () => {
    if (cacheKey) {
      const cached = iconCache.get(cacheKey)
      if (cached) URL.revokeObjectURL(cached)
      iconCache.delete(cacheKey)
    }
    setIconSrc(null)
  }

  return (
    <div className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] ring-1 ring-white/10 ${color}`}>
      <span className="text-xs font-bold tracking-wide text-white">{initials}</span>

      {iconSrc && (
        <span className="absolute inset-0 flex items-center justify-center bg-white">
          {/* The source is an authenticated same-origin fetch converted to a local blob URL. */}
          <img
            src={iconSrc}
            alt={`${companyName} logo`}
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={handleImageError}
          />
        </span>
      )}
    </div>
  )
}
