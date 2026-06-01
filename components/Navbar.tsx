'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { loadData, saveData } from '@/lib/store'
import { useToast } from '@/components/Toast'

export default function Navbar() {
  const pathname = usePathname()
  const toast = useToast()

  const links = [
    { href: '/', label: 'Session' },
    { href: '/employes', label: 'Employés' },
    { href: '/stats', label: 'Statistiques' },
    { href: '/depenses', label: 'Dépenses' },
    { href: '/production', label: 'Production' },
  ]

  const exportData = () => {
    const data = loadData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ibl-primeurs-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('Données exportées', 'success')
  }

  const importData = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string)
          saveData(data)
          window.location.reload()
          toast('Données importées', 'success')
        } catch {
          toast('Fichier invalide', 'error')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  return (
    <nav style={{
      background: 'var(--forest-deep)',
      borderBottom: '2px solid var(--red)',
      position: 'sticky', top: 0, zIndex: 100,
      boxShadow: '0 2px 20px rgba(0,0,0,0.4)'
    }}>
      <div className="navbar-root" style={{
        maxWidth: 960, margin: '0 auto',
        padding: '0 20px', height: 62,
        display: 'flex', alignItems: 'center',
        gap: 16, overflow: 'hidden'
      }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'var(--red)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Playfair Display, serif', fontWeight: 700,
            color: 'white', fontSize: 16, flexShrink: 0
          }}>I</div>
          <div className="navbar-logo-text">
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 14, fontWeight: 700, color: 'var(--white)', lineHeight: 1.1 }}>IBL Primeurs</div>
            <div style={{ fontSize: 9, color: 'var(--green)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif' }}>Campagne Mangue</div>
          </div>
        </Link>

        {/* Nav links — scrollable on mobile */}
        <div className="navbar-links" style={{ flex: 1 }}>
          {links.map(l => {
            const active = pathname === l.href
            return (
              <Link key={l.href} href={l.href} className="nav-link" style={{
                padding: '8px 14px', borderRadius: 8,
                fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600,
                textDecoration: 'none', whiteSpace: 'nowrap',
                background: active ? 'var(--red)' : 'transparent',
                color: active ? 'white' : 'var(--gray)',
                transition: 'all 0.18s',
                boxShadow: active ? '0 2px 10px rgba(232,49,42,0.35)' : 'none'
              }}>{l.label}</Link>
            )
          })}
        </div>

        {/* Actions */}
        <div className="navbar-actions" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={importData} className="btn-import" style={{
            padding: '7px 12px', borderRadius: 7, cursor: 'pointer',
            background: 'var(--forest-mid)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--gray)', fontFamily: 'DM Sans, sans-serif', fontSize: 12,
            transition: 'all 0.18s'
          }}>↑ Importer</button>
          <button onClick={exportData} className="btn-export" style={{
            padding: '7px 12px', borderRadius: 7, cursor: 'pointer',
            background: 'var(--forest-mid)', border: '1px solid rgba(61,176,106,0.2)',
            color: 'var(--green)', fontFamily: 'DM Sans, sans-serif', fontSize: 12,
            transition: 'all 0.18s'
          }}>↓ Exporter</button>
        </div>
      </div>
    </nav>
  )
}
