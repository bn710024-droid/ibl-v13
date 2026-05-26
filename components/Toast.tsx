'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info'
interface ToastItem { id: number; message: string; type: ToastType }

const ToastContext = createContext<(msg: string, type?: ToastType) => void>(() => {})

export function useToast() { return useContext(ToastContext) }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  let counter = 0

  const show = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counter + Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200)
  }, [])

  const colors = {
    success: { bg: 'var(--green)', icon: '✓' },
    error:   { bg: 'var(--red)', icon: '✕' },
    info:    { bg: '#4a90d9', icon: 'ℹ' },
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px', borderRadius: 10,
            background: 'var(--forest)',
            border: `1px solid ${colors[t.type].bg}`,
            boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px ${colors[t.type].bg}22`,
            animation: 'toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
            minWidth: 240, maxWidth: 340,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: colors[t.type].bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: 'white', fontWeight: 700, flexShrink: 0
            }}>{colors[t.type].icon}</div>
            <span style={{ fontSize: 13, color: 'var(--cream)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.4 }}>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
