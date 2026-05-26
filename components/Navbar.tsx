'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { loadData, saveData, AppData } from '@/lib/store'
import { useToast } from './Toast'
import { useRef } from 'react'

const links = [
  { href: '/', label: 'Session' },
  { href: '/employes', label: 'Employés' },
  { href: '/depenses', label: 'Dépenses' },
  { href: '/production', label: 'Production' },
]

export default function Navbar() {
  const path = usePathname()
  const toast = useToast()
  const importRef = useRef<HTMLInputElement>(null)

  const exportData = () => {
    const data = loadData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ibl-primeurs-backup-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('Données exportées', 'success')
  }

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as AppData
        saveData(parsed)
        toast('Importé — rechargement...', 'success')
        setTimeout(() => window.location.reload(), 1000)
      } catch { toast('Fichier invalide', 'error') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <nav style={{
      background: 'var(--forest-deep)', borderBottom: '2px solid var(--red)',
      padding: '0 20px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', height: 60, position: 'sticky', top: 0, zIndex: 100,
      boxShadow: '0 2px 20px rgba(0,0,0,0.4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <div style={{ marginRight: 28, display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: 'white', fontFamily: 'Playfair Display, serif', boxShadow: '0 2px 12px rgba(232,49,42,0.45)' }}>I</div>
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: 13, color: 'var(--white)', lineHeight: 1.1 }}>IBL Primeurs</div>
            <div style={{ fontSize: 9, color: 'var(--green)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>Campagne Mangue</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {links.map(l => {
            const active = path === l.href
            return (
              <Link key={l.href} href={l.href} style={{
                padding: '6px 14px', borderRadius: 7, textDecoration: 'none',
                fontWeight: active ? 600 : 400, fontSize: 13,
                color: active ? 'white' : 'var(--gray)',
                background: active ? 'var(--red)' : 'transparent',
                transition: 'all 0.2s', boxShadow: active ? '0 2px 10px rgba(232,49,42,0.3)' : 'none',
              }}>{l.label}</Link>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
        <input ref={importRef} type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
        <button onClick={() => importRef.current?.click()} style={{ padding: '6px 12px', borderRadius: 7, cursor: 'pointer', background: 'var(--forest-mid)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--gray)', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>↑ Importer</button>
        <button onClick={exportData} style={{ padding: '6px 12px', borderRadius: 7, cursor: 'pointer', background: 'var(--forest-mid)', border: '1px solid rgba(61,176,106,0.25)', color: 'var(--green)', fontSize: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>↓ Exporter</button>
      </div>
    </nav>
  )
}
