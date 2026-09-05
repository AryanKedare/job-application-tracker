'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

interface Props {
  company?: string | null
  fallbackName: string
}

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

export default function CompanyAvatar({ company, fallbackName }: Props) {
  const companyName = company?.trim() ?? ''
  const fallback = companyName || fallbackName
  const { initials, color } = avatarDetails(fallback)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
  }, [companyName])

  return (
    <div className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] ring-1 ring-white/10 ${color}`}>
      <span className="text-xs font-bold tracking-wide text-white">{initials}</span>

      {companyName && !failed && (
        <span className={`absolute inset-0 flex items-center justify-center bg-white transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}>
          <Image
            src={`/api/company-icon?company=${encodeURIComponent(companyName)}`}
            alt={`${companyName} logo`}
            width={32}
            height={32}
            sizes="32px"
            className="h-8 w-8 object-contain"
            unoptimized
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        </span>
      )}
    </div>
  )
}
