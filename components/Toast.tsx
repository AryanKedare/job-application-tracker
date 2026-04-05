// components/Toast.tsx
// Lightweight inline toast — no extra dependency needed.
'use client'
import { useEffect } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

interface ToastProps {
  message: string
  type: 'success' | 'error'
  onDismiss: () => void
  duration?: number
}

export default function Toast({ message, type, onDismiss, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [onDismiss, duration])

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl text-sm font-medium ${
        type === 'success'
          ? 'bg-emerald-900/90 border-emerald-700 text-emerald-100'
          : 'bg-red-900/90 border-red-700 text-red-100'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
      ) : (
        <XCircle className="w-4 h-4 shrink-0 text-red-400" />
      )}
      <span>{message}</span>
      <button
        onClick={onDismiss}
        className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
