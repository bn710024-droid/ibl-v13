'use client'
import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import PageWrapper from '@/components/PageWrapper'
import { useToast } from '@/components/Toast'
import {
  loadData, saveData, genId, formatDate,
  AppData, JourneeProduction, getStatsProduction
} from '@/lib/store'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const CAMION_DEFAULT = 'prod-global'

export default function ProductionPage() {
  const [data, setData] = useState<AppData | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editJournee, setEditJournee] = useState<JourneeProduction | null>(null)
  const [dateJ, setDateJ] = useState(new Date().toISOString().slice(0, 10))
  const [volumeRecu, setVolumeRecu] = useState('')
  const [volumeEcart, setVolumeEcart] = useState('')
  const [produit, setProduit] = useState('')
  const toast = useToast()

  useEffect(() => {
    setData(loadData())
    import('@/lib/syncFromSupabase').then(({ syncFromSupabase }) => {
      syncFromSupabase(remote => setData(remote))
    })
  }, [])

  if (!data) return null

  const journees = [...data.journeesProduction]
    .sort((a, b) => a.date.localeCompare(b.date))

  const stats = getStatsProduction(journees)

  const chartData = journees.map(j => ({
    date: j.date.slice(5),
    recu: j.volumeRecuKg,
    exportable: j.volumeRecuKg - j.volumeEcartKg,
    pctEcart: j.volumeRecuKg > 0 ? Math.round((j.volumeEcartKg / j.volumeRecuKg) * 1000) / 10 : 0,
  }))

  const ouvrirModal = (j?: JourneeProduction) => {
    setEditJournee(j || null)
    setDateJ(j?.date || new Date().toISOString().slice(0, 10))
    setVolumeRecu(j?.volumeRecuKg.toString() || '')
    setVolumeEcart(j?.volumeEcartKg.toString() || '')
    setProduit(j?.produit || '')
    setShowModal(true)
  }

  const sauvegarder = () => {
    if (!volumeRecu) return
    const recu = parseFloat(volumeRecu)
    const ecart = parseFloat(volumeEcart) || 0
    if (ecart > recu) { toast('Écart ne peut pas dépasser le volume reçu', 'error'); return }

    // S'assurer qu'un camion par défaut existe
    let updatedData = { ...data }
    if (!updatedData.camions.find(c => c.id === CAMION_DEFAULT)) {
      updatedData.camions = [...updatedData.camions, {
        id: CAMION_DEFAULT, numero: 1,
        dateDebut: new Date().toISOString().slice(0, 10),
        objectifKg: data.config.objectifCamionKg,
        statut: 'en_cours' as const
      }]
    }

    const journeeData: JourneeProduction = {
      id: editJournee?.id || genId(),
      camionId: editJournee?.camionId || updatedData.camions[0]?.id || CAMION_DEFAULT,
      date: dateJ,
      volumeRecuKg: recu,
      volumeEcartKg: ecart,
      produit: produit.trim() || undefined
    }

    updatedData = {
      ...updatedData,
      journeesProduction: editJournee
        ? updatedData.journeesProduction.map(j => j.id === editJournee.id ? journeeData : j)
        : [...updatedData.journeesProduction, journeeData]
    }

    setData(updatedData); saveData(updatedData)
    setShowModal(false); setEditJournee(null)
    setVolumeRecu(''); setVolumeEcart(''); setProduit('')
    toast(editJournee ? 'Journée modifiée' : 'Journée enregistrée', 'success')
  }

  const supprimerJournee = (id: string) => {
    if (!confirm('Supprimer cette journée de production ?')) return
    const updated = { ...data, journeesProduction: data.journeesProduction.filter(j => j.id !== id) }
    setData(updated); saveData(updated)
    toast('Journée supprimée', 'info')
  }

  const tooltipStyle = {
    contentStyle: { background: 'var(--forest)', border: '1px solid rgba(232,49,42,0.2)', borderRadius: 8, color: 'var(--cream)', fontSize: 11 }
  }

  const recu = parseFloat(volumeRecu) || 0
  const ecart = parseFloat(volumeEcart) || 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--forest-deep)' }}>
      <Navbar />
      <PageWrapper>
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: 'var(--white)' }}>Production</h1>
          <button onClick={() => ouvrirModal()} className="btn-primary ripple" style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13 }}>
            + Journée
          </button>
        </div>

        {journees.length === 0 ? (
          <div className="card" style={{ padding: 50, textAlign: 'center', color: 'var(--gray-dim)' }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>📦</div>
            <p style={{ fontSize: 15, marginBottom: 20 }}>Aucune journée de production enregistrée.</p>
            <button className="btn-primary ripple" onClick={() => ouvrirModal()} style={{ padding: '11px 24px', borderRadius: 9, fontSize: 14 }}>
              Ajouter la première journée
            </button>
          </div>
        ) : (
          <>
            {/* KPIs totaux */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Total reçu', value: `${stats.totalRecu.toLocaleString()} kg`, color: 'var(--white)', stripe: 'stripe-white' },
                { label: 'Total exportable', value: `${stats.totalExportable.toLocaleString()} kg`, color: 'var(--green)', stripe: 'stripe-green' },
                { label: 'Total écarts', value: `${stats.totalEcart.toLocaleString()} kg`, color: 'var(--red-bright)', stripe: 'stripe-red' },
                { label: '% Écart moyen', value: `${stats.pctEcart}%`, color: stats.pctEcart > 20 ? 'var(--red-bright)' : 'var(--gold)', stripe: 'stripe-white' },
              ].map((k, i) => (
                <div key={i} className={`card ${k.stripe} fade-in`} style={{ padding: '16px', textAlign: 'center', animationDelay: `${i * 0.06}s` }}>
                  <div style={{ fontSize: 18, fontFamily: 'Playfair Display, serif', color: k.color, fontWeight: 700 }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--gray-dim)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Graphiques */}
            {chartData.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  { title: 'Kg reçus / jour', dataKey: 'recu', color: '#4a90d9', unit: ' kg' },
                  { title: 'Kg exportables / jour', dataKey: 'exportable', color: '#3db06a', unit: ' kg' },
                  { title: '% Écart / jour', dataKey: 'pctEcart', color: '#E8312A', unit: '%' },
                ].map(({ title, dataKey, color, unit }) => (
                  <div key={dataKey} className="card" style={{ padding: '14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>{title}</div>
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="date" tick={{ fill: 'rgba(240,237,232,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'rgba(240,237,232,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} unit={unit === '%' ? '%' : ''} />
                        <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${v}${unit}`, title]} />
                        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            )}

            {/* Tableau journées */}
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: 11, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                Journées de production — {journees.length} jour(s)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[...journees].reverse().map(j => {
                  const exportable = j.volumeRecuKg - j.volumeEcartKg
                  const pct = j.volumeRecuKg > 0 ? Math.round((j.volumeEcartKg / j.volumeRecuKg) * 1000) / 10 : 0
                  return (
                    <div key={j.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px', borderRadius: 9, background: 'var(--forest-mid)',
                      flexWrap: 'wrap', gap: 8
                    }}>
                      <div style={{ minWidth: 120 }}>
                        <span style={{ fontSize: 14, color: 'var(--cream)', fontWeight: 600 }}>{formatDate(j.date)}</span>
                        {j.produit && <span style={{ fontSize: 11, color: 'var(--gold)', marginLeft: 8 }}>🥭 {j.produit}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, color: 'var(--white)', fontWeight: 700 }}>{j.volumeRecuKg.toLocaleString()} kg</div>
                          <div style={{ fontSize: 10, color: 'var(--gray-dim)' }}>Brut reçu</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, color: 'var(--red-bright)', fontWeight: 600 }}>{j.volumeEcartKg.toLocaleString()} kg <span style={{ fontSize: 11 }}>({pct}%)</span></div>
                          <div style={{ fontSize: 10, color: 'var(--gray-dim)' }}>Écarts</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, color: 'var(--green)', fontWeight: 700 }}>{exportable.toLocaleString()} kg</div>
                          <div style={{ fontSize: 10, color: 'var(--gray-dim)' }}>Net export</div>
                        </div>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => ouvrirModal(j)} style={{ background: 'var(--green-muted)', border: '1px solid rgba(61,176,106,0.3)', color: 'var(--green)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>✏</button>
                          <button onClick={() => supprimerJournee(j.id)} style={{ background: 'var(--red-muted)', border: '1px solid var(--red-border)', color: 'var(--red-bright)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Ligne totaux */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px', borderRadius: 9, background: 'rgba(61,176,106,0.08)',
                  border: '1px solid rgba(61,176,106,0.2)', marginTop: 4, flexWrap: 'wrap', gap: 8
                }}>
                  <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    TOTAL — {journees.length} jours
                  </div>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, color: 'var(--white)', fontWeight: 700 }}>{stats.totalRecu.toLocaleString()} kg</div>
                      <div style={{ fontSize: 10, color: 'var(--gray-dim)' }}>Brut reçu</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, color: 'var(--red-bright)', fontWeight: 700 }}>{stats.totalEcart.toLocaleString()} kg <span style={{ fontSize: 11 }}>({stats.pctEcart}%)</span></div>
                      <div style={{ fontSize: 10, color: 'var(--gray-dim)' }}>Écarts</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, color: 'var(--green)', fontWeight: 800 }}>{stats.totalExportable.toLocaleString()} kg</div>
                      <div style={{ fontSize: 10, color: 'var(--gray-dim)' }}>Net export</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      </PageWrapper>

      {/* Modal ajouter / modifier journée */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)' }}>
          <div className="card modal-card" style={{ padding: 28, width: 400 }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, marginBottom: 18, color: 'var(--white)' }}>
              {editJournee ? 'Modifier la journée' : 'Nouvelle journée de production'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Date</label>
                <input type="date" value={dateJ} onChange={e => setDateJ(e.target.value)} style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Produit (variété)</label>
                <input type="text" value={produit} onChange={e => setProduit(e.target.value)} placeholder="ex: Kent, Keitt, Boukodiékhal…" style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Volume brut reçu (kg)</label>
                <input type="number" min="0" value={volumeRecu} onChange={e => setVolumeRecu(e.target.value)} placeholder="ex: 17208" style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Écarts (kg)</label>
                <input type="number" min="0" value={volumeEcart} onChange={e => setVolumeEcart(e.target.value)} placeholder="ex: 2325" style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} />
              </div>
              {recu > 0 && (
                <div style={{ padding: '12px', borderRadius: 8, background: 'var(--forest-mid)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: 15, color: 'var(--green)', fontWeight: 700 }}>{(recu - ecart).toLocaleString()} kg</div>
                    <div style={{ fontSize: 10, color: 'var(--gray-dim)' }}>Net export</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, color: 'var(--red-bright)', fontWeight: 700 }}>{ecart.toLocaleString()} kg</div>
                    <div style={{ fontSize: 10, color: 'var(--gray-dim)' }}>Écarts</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, color: 'var(--gold)', fontWeight: 700 }}>{Math.round((ecart / recu) * 1000) / 10}%</div>
                    <div style={{ fontSize: 10, color: 'var(--gray-dim)' }}>% écart</div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => { setShowModal(false); setEditJournee(null) }} className="btn-ghost" style={{ padding: '9px 16px', borderRadius: 8 }}>Annuler</button>
              <button className="btn-primary ripple" onClick={sauvegarder} style={{ padding: '9px 18px', borderRadius: 8 }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
