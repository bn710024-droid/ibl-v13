'use client'
import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import PageWrapper from '@/components/PageWrapper'
import { useToast } from '@/components/Toast'
import {
  loadData, saveData, genId, formatFCFA, formatDate,
  AppData, Depense, Camion, getMontantDepense, getCamionActif, getDepensesCamion
} from '@/lib/store'

export default function DepensesPage() {
  const [data, setData] = useState<AppData | null>(null)
  const [camionVue, setCamionVue] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editDepense, setEditDepense] = useState<Depense | null>(null)
  const [type, setType] = useState<'kg' | 'fixe'>('kg')
  const [desc, setDesc] = useState('')
  const [qteKg, setQteKg] = useState('')
  const [prixKg, setPrixKg] = useState('')
  const [montantFixe, setMontantFixe] = useState('')
  const [dateD, setDateD] = useState(new Date().toISOString().slice(0,10))
  const toast = useToast()

  useEffect(() => {
    setData(loadData())
    import('@/lib/syncFromSupabase').then(({ syncFromSupabase }) => {
      syncFromSupabase(remote => setData(remote))
    })
  }, [])
  if (!data) return null

  const camionActif = getCamionActif(data)
  const camionAffiche = camionVue ? data.camions.find(c => c.id === camionVue) || camionActif : camionActif
  const depenses = camionAffiche
    ? getDepensesCamion(camionAffiche.id, data).sort((a,b) => b.date.localeCompare(a.date))
    : []
  const totalDepenses = depenses.reduce((a, d) => a + getMontantDepense(d), 0)
  const totalGlobal = data.depenses.reduce((a, d) => a + getMontantDepense(d), 0)

  // Grouper par jour
  const parJour = depenses.reduce((acc, d) => {
    const key = d.date
    if (!acc[key]) acc[key] = []
    acc[key].push(d)
    return acc
  }, {} as Record<string, Depense[]>)

  const resetForm = () => {
    setDesc(''); setQteKg(''); setPrixKg(''); setMontantFixe('')
    setDateD(new Date().toISOString().slice(0,10)); setType('kg')
  }

  const ouvrirEdit = (d: Depense) => {
    setEditDepense(d)
    setDesc(d.description)
    setDateD(d.date)
    if (d.quantiteKg) { setType('kg'); setQteKg(d.quantiteKg.toString()); setPrixKg(d.prixParKg?.toString() || '') }
    else { setType('fixe'); setMontantFixe(d.montantFixe?.toString() || '') }
    setShowAdd(true)
  }

  const sauvegarder = () => {
    if (!desc.trim() || !camionAffiche) return
    // Pour dépense sync production, on peut juste modifier le prixKg
    if (editDepense?.isProductionSync) {
      const updated = {
        ...data,
        depenses: data.depenses.map(d => d.id === editDepense.id
          ? { ...d, prixParKg: prixKg ? parseFloat(prixKg) : undefined }
          : d)
      }
      setData(updated); saveData(updated)
      setShowAdd(false); setEditDepense(null); resetForm()
      toast('Prix mis à jour', 'success')
      return
    }

    const depenseData: Depense = {
      id: editDepense?.id || genId(),
      camionId: camionAffiche.id,
      date: dateD,
      description: desc.trim(),
      ...(type === 'kg'
        ? { quantiteKg: parseFloat(qteKg), prixParKg: prixKg ? parseFloat(prixKg) : undefined }
        : { montantFixe: parseFloat(montantFixe) })
    }

    const updated = {
      ...data,
      depenses: editDepense
        ? data.depenses.map(d => d.id === editDepense.id ? depenseData : d)
        : [...data.depenses, depenseData]
    }
    setData(updated); saveData(updated)
    setShowAdd(false); setEditDepense(null); resetForm()
    toast(editDepense ? 'Dépense modifiée' : 'Dépense ajoutée', 'success')
  }

  const supprimer = (d: Depense) => {
    if (d.isProductionSync) { toast('Cette dépense est liée à la production — supprimez la journée dans Production', 'error'); return }
    if (!confirm('Supprimer cette dépense ?')) return
    const updated = { ...data, depenses: data.depenses.filter(dep => dep.id !== d.id) }
    setData(updated); saveData(updated)
    toast('Dépense supprimée', 'info')
  }

  const statutColor = (s: Camion['statut']) => s === 'cloture' ? 'var(--gray-dim)' : 'var(--green)'
  const statutLabel = (s: Camion['statut']) => s === 'cloture' ? '✓ Clôturé' : '● En cours'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--forest-deep)' }}>
      <Navbar />
      <PageWrapper>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: 'var(--white)' }}>Dépenses</h1>
            <p style={{ color: 'var(--gray)', marginTop: 4, fontSize: 13 }}>Suivi financier par camion · par jour</p>
          </div>
          {camionAffiche && (
            <button className="btn-primary ripple" onClick={() => { setEditDepense(null); resetForm(); setShowAdd(true) }}
              style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13 }}>+ Dépense manuelle</button>
          )}
        </div>


        {/* Navigation camions */}
        {data.camions.length > 1 && (
          <div style={{ display: 'flex', gap: 7, marginBottom: 16, flexWrap: 'wrap' }}>
            {data.camions.map(c => {
              const active = camionVue ? camionVue === c.id : c.statut !== 'cloture'
              return (
                <button key={c.id} onClick={() => setCamionVue(c.statut === 'cloture' ? c.id : null)} style={{
                  padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600,
                  background: active ? 'var(--red)' : 'var(--forest-mid)',
                  color: active ? 'white' : 'var(--gray)',
                  border: active ? 'none' : '1px solid rgba(255,255,255,0.07)',
                  boxShadow: active ? '0 2px 10px rgba(232,49,42,0.3)' : 'none',
                  transition: 'all 0.18s'
                }}>
                  🚛 Camion {c.numero} · <span style={{ color: active ? 'rgba(255,255,255,0.75)' : statutColor(c.statut) }}>{statutLabel(c.statut)}</span>
                </button>
              )
            })}
          </div>
        )}

        {!camionAffiche ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--gray-dim)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
            <p>Aucun camion actif. Créez-en un depuis la page Production.</p>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: `Total Camion ${camionAffiche.numero}`, value: formatFCFA(totalDepenses), color: 'var(--red-bright)', stripe: 'stripe-red' },
                { label: 'Lignes dépenses', value: depenses.length.toString(), color: 'var(--white)', stripe: 'stripe-white' },
                { label: 'Total global', value: formatFCFA(totalGlobal), color: 'var(--green)', stripe: 'stripe-green' },
              ].map((k, i) => (
                <div key={i} className={`card ${k.stripe} fade-in`} style={{ padding: '16px', animationDelay: `${i*0.07}s` }}>
                  <div style={{ fontSize: 18, fontFamily: 'Playfair Display, serif', color: k.color, fontWeight: 700 }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-dim)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Dépenses groupées par jour */}
            {depenses.length === 0 ? (
              <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--gray-dim)', fontSize: 14 }}>
                Aucune dépense pour ce camion.<br/>
                <span style={{ fontSize: 12, marginTop: 6, display: 'block' }}>Les achats mangues apparaissent automatiquement depuis la page Production.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Object.entries(parJour).map(([date, deps]) => {
                  const totalJour = deps.reduce((a,d) => a + getMontantDepense(d), 0)
                  return (
                    <div key={date}>
                      {/* Header jour */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cream)' }}>{formatDate(date)}</span>
                        <span style={{ fontSize: 13, color: 'var(--red-bright)', fontWeight: 700 }}>{formatFCFA(totalJour)}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {deps.map(d => (
                          <div key={d.id} className="card stagger-item" style={{
                            padding: '12px 16px',
                            borderLeft: d.isProductionSync ? '3px solid var(--green)' : '3px solid transparent'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                  width: 32, height: 32, borderRadius: 8,
                                  background: d.isProductionSync ? 'rgba(61,176,106,0.15)' : d.quantiteKg ? 'rgba(61,176,106,0.1)' : 'rgba(232,49,42,0.1)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14
                                }}>{d.isProductionSync ? '🥭' : d.quantiteKg ? '⚖️' : '💸'}</div>
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--white)', fontSize: 13 }}>
                                    {d.description}
                                    {d.isProductionSync && <span style={{ fontSize: 10, color: 'var(--green)', marginLeft: 6, padding: '2px 6px', borderRadius: 4, background: 'rgba(61,176,106,0.1)' }}>Auto</span>}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--gray-dim)', marginTop: 1 }}>
                                    {d.quantiteKg && <span>{d.quantiteKg.toLocaleString()} kg</span>}
                                    {d.prixParKg
                                      ? <span style={{ color: 'var(--green)', marginLeft: 6 }}>× {formatFCFA(d.prixParKg)}/kg</span>
                                      : d.isProductionSync && <span style={{ color: 'var(--gold)', marginLeft: 6 }}>Prix à renseigner</span>
                                    }
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ textAlign: 'right' }}>
                                  {getMontantDepense(d) > 0
                                    ? <div style={{ color: 'var(--red-bright)', fontWeight: 700, fontSize: 14 }}>{formatFCFA(getMontantDepense(d))}</div>
                                    : <div style={{ color: 'var(--gold)', fontSize: 12 }}>—</div>
                                  }
                                </div>
                                <div style={{ display: 'flex', gap: 5 }}>
                                  <button onClick={() => ouvrirEdit(d)} style={{ background: 'var(--green-muted)', border: '1px solid rgba(61,176,106,0.3)', color: 'var(--green)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>
                                    {d.isProductionSync ? '💲 Prix' : '✏'}
                                  </button>
                                  {!d.isProductionSync && (
                                    <button onClick={() => supprimer(d)} style={{ background: 'var(--red-muted)', border: '1px solid var(--red-border)', color: 'var(--red-bright)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>✕</button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* Total camion */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Camion {camionAffiche.numero}</div>
                    <div style={{ fontSize: 22, color: 'var(--red-bright)', fontWeight: 700, fontFamily: 'Playfair Display, serif' }}>{formatFCFA(totalDepenses)}</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      </PageWrapper>

      {/* Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)' }}>
          <div className="card modal-card" style={{ padding: 28, width: 420 }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, marginBottom: 18, color: 'var(--white)' }}>
              {editDepense?.isProductionSync ? '💲 Renseigner le prix' : editDepense ? 'Modifier la dépense' : 'Nouvelle dépense'}
            </h3>

            {editDepense?.isProductionSync ? (
              /* Mode spécial sync — juste le prix */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--forest-mid)' }}>
                  <div style={{ fontSize: 13, color: 'var(--white)', fontWeight: 600 }}>{editDepense.description}</div>
                  <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 3 }}>{editDepense.quantiteKg?.toLocaleString()} kg · {formatDate(editDepense.date)}</div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Prix par kg (FCFA)</label>
                  <input type="number" value={prixKg} onChange={e => setPrixKg(e.target.value)} placeholder="ex: 75" style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} autoFocus />
                </div>
                {prixKg && editDepense.quantiteKg && (
                  <div style={{ padding: '10px', borderRadius: 8, background: 'var(--forest-mid)', textAlign: 'center' }}>
                    <span style={{ color: 'var(--red-bright)', fontWeight: 700, fontSize: 16 }}>{formatFCFA(editDepense.quantiteKg * parseFloat(prixKg))}</span>
                  </div>
                )}
              </div>
            ) : (
              /* Mode normal */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['kg', 'fixe'] as const).map(t => (
                    <button key={t} onClick={() => setType(t)} style={{
                      flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 12,
                      background: type === t ? 'var(--red)' : 'var(--forest-mid)',
                      color: type === t ? 'white' : 'var(--gray)',
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}>{t === 'kg' ? '⚖️ Achat produit (kg)' : '💸 Dépense fixe'}</button>
                  ))}
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Description</label>
                  <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Transport, Carburant..." style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} autoFocus />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Date</label>
                  <input type="date" value={dateD} onChange={e => setDateD(e.target.value)} style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} />
                </div>
                {type === 'kg' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Quantité (kg)</label>
                      <input type="number" value={qteKg} onChange={e => setQteKg(e.target.value)} placeholder="10000" style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Prix/kg (FCFA)</label>
                      <input type="number" value={prixKg} onChange={e => setPrixKg(e.target.value)} placeholder="75" style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} />
                    </div>
                    {qteKg && prixKg && (
                      <div style={{ gridColumn: '1/-1', padding: '10px', borderRadius: 8, background: 'var(--forest-mid)', textAlign: 'center' }}>
                        <span style={{ color: 'var(--red-bright)', fontWeight: 700, fontSize: 15 }}>= {formatFCFA(parseFloat(qteKg) * parseFloat(prixKg))}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Montant (FCFA)</label>
                    <input type="number" value={montantFixe} onChange={e => setMontantFixe(e.target.value)} placeholder="25000" style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} />
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => { setShowAdd(false); setEditDepense(null); resetForm() }} className="btn-ghost" style={{ padding: '9px 16px', borderRadius: 8 }}>Annuler</button>
              <button className="btn-primary ripple" onClick={sauvegarder} style={{ padding: '9px 18px', borderRadius: 8 }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
