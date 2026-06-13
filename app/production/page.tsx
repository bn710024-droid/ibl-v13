'use client'
import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import PageWrapper from '@/components/PageWrapper'
import { useToast } from '@/components/Toast'
import {
  loadData, saveData, genId, formatFCFA, formatDate,
  AppData, Camion, JourneeProduction, getCamionActif,
  getJourneesCamion, getStatsProduction, getDepensesCamion,
  getMontantDepense, syncDepenseProduction
} from '@/lib/store'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function ProductionPage() {
  const [data, setData] = useState<AppData | null>(null)
  const [camionVue, setCamionVue] = useState<string | null>(null)
  const [showAddJournee, setShowAddJournee] = useState(false)
  const [editJournee, setEditJournee] = useState<JourneeProduction | null>(null)
  const [dateJ, setDateJ] = useState(new Date().toISOString().slice(0,10))
  const [volumeRecu, setVolumeRecu] = useState('')
  const [volumeEcart, setVolumeEcart] = useState('')
  // Suppression camion
  const [deleteCamionModal, setDeleteCamionModal] = useState<Camion | null>(null)
  const [deleteCamionPin, setDeleteCamionPin] = useState('')
  const [deleteCamionPinErr, setDeleteCamionPinErr] = useState('')
  // Nouveau camion
  const [showNewCamionModal, setShowNewCamionModal] = useState(false)
  const [newCamionObjectif, setNewCamionObjectif] = useState('')
  // Config objectif camion auto-créé (après surplus)
  const [configCamionModal, setConfigCamionModal] = useState<string | null>(null)
  const [configCamionObjectif, setConfigCamionObjectif] = useState('')
  const toast = useToast()

  useEffect(() => {
    setData(loadData())
    import('@/lib/syncFromSupabase').then(({ syncFromSupabase }) => {
      syncFromSupabase(remote => setData(remote))
    })
  }, [])
  if (!data) return null

  const camionActif = getCamionActif(data)
  const camionAffiche = camionVue
    ? data.camions.find(c => c.id === camionVue) || camionActif
    : camionActif
  const journees = camionAffiche
    ? getJourneesCamion(camionAffiche.id, data).sort((a,b) => a.date.localeCompare(b.date))
    : []
  const stats = getStatsProduction(journees)
  const depenses = camionAffiche ? getDepensesCamion(camionAffiche.id, data) : []
  const totalDepenses = depenses.reduce((a,d) => a + getMontantDepense(d), 0)
  const progression = camionAffiche ? Math.min((stats.totalExportable / camionAffiche.objectifKg) * 100, 100) : 0
  const kgRestants = camionAffiche ? Math.max(camionAffiche.objectifKg - stats.totalExportable, 0) : 0
  const statsGlobal = getStatsProduction(data.journeesProduction)

  const creerCamion = (numero?: number, objectifKg?: number): Camion => ({
    id: genId(),
    numero: numero || data.camions.length + 1,
    dateDebut: new Date().toISOString().slice(0,10),
    objectifKg: objectifKg ?? data.config.objectifCamionKg,
    statut: 'en_cours'
  })

  const creerCamionAvecObjectif = () => {
    const objectif = parseFloat(newCamionObjectif) || data.config.objectifCamionKg
    const c = creerCamion(undefined, objectif)
    const updated = { ...data, camions: [...data.camions, c] }
    setData(updated); saveData(updated)
    setShowNewCamionModal(false); setNewCamionObjectif('')
    toast(`Camion ${c.numero} créé — objectif ${objectif.toLocaleString()} kg`, 'success')
  }

  const mettreAJourObjectifCamion = () => {
    if (!configCamionModal || !data) return
    const objectif = parseFloat(configCamionObjectif) || data.config.objectifCamionKg
    const updated = {
      ...data,
      camions: data.camions.map(c => c.id === configCamionModal ? { ...c, objectifKg: objectif } : c)
    }
    setData(updated); saveData(updated)
    setConfigCamionModal(null)
    toast(`Objectif Camion ${data.camions.find(c=>c.id===configCamionModal)?.numero} : ${objectif.toLocaleString()} kg`, 'success')
  }

  const ouvrirEditJournee = (j: JourneeProduction) => {
    setEditJournee(j)
    setDateJ(j.date)
    setVolumeRecu(j.volumeRecuKg.toString())
    setVolumeEcart(j.volumeEcartKg.toString())
    setShowAddJournee(true)
  }

  const sauvegarderJournee = () => {
    if (!camionAffiche || !volumeRecu) return
    const recu = parseFloat(volumeRecu)
    const ecart = parseFloat(volumeEcart) || 0
    if (ecart > recu) { toast('Écart ne peut pas dépasser le volume reçu', 'error'); return }
    const exportable = recu - ecart

    // Calcul cumul avant cette journée
    const journeesExistantes = getJourneesCamion(camionAffiche.id, data)
      .filter(j => editJournee ? j.id !== editJournee.id : true)
    const statsAvant = getStatsProduction(journeesExistantes)
    const cumulAvant = statsAvant.totalExportable

    const objectif = camionAffiche.objectifKg
    const nouveauCumul = cumulAvant + exportable

    let updated = { ...data }

    if (nouveauCumul > objectif && camionAffiche.statut !== 'cloture') {
      // Surplus → split automatique
      const pourCamion1 = objectif - cumulAvant
      const surplus = exportable - pourCamion1
      // Ratio pour calculer les écarts proportionnels
      const ratio1 = pourCamion1 / exportable
      const ecart1 = Math.round(ecart * ratio1)
      const recu1 = pourCamion1 + ecart1

      const journee1: JourneeProduction = {
        id: editJournee?.id || genId(),
        camionId: camionAffiche.id,
        date: dateJ,
        volumeRecuKg: recu1,
        volumeEcartKg: ecart1
      }

      // Clôture camion 1
      updated = {
        ...updated,
        camions: updated.camions.map(c =>
          c.id === camionAffiche.id
            ? { ...c, statut: 'cloture' as const, dateFin: dateJ }
            : c
        ),
        journeesProduction: editJournee
          ? updated.journeesProduction.map(j => j.id === editJournee.id ? journee1 : j)
          : [...updated.journeesProduction, journee1]
      }
      updated = syncDepenseProduction(updated, journee1, camionAffiche.id)

      // Création camion 2 avec surplus
      if (surplus > 0) {
        const nouveauCamion = creerCamion(data.camions.length + 1)
        const ecart2 = ecart - ecart1
        const recu2 = surplus + ecart2
        const journee2: JourneeProduction = {
          id: genId(),
          camionId: nouveauCamion.id,
          date: dateJ,
          volumeRecuKg: recu2,
          volumeEcartKg: ecart2
        }
        updated = {
          ...updated,
          camions: [...updated.camions, nouveauCamion],
          journeesProduction: [...updated.journeesProduction, journee2]
        }
        updated = syncDepenseProduction(updated, journee2, nouveauCamion.id)
        toast(`Camion ${camionAffiche.numero} cloture ! Surplus ${surplus.toLocaleString()} kg -> Camion ${nouveauCamion.numero}`, 'success')
        // Ouvrir le modal de config objectif pour le nouveau camion
        setConfigCamionObjectif(data.config.objectifCamionKg.toString())
        setConfigCamionModal(nouveauCamion.id)
      } else {
        toast(`Camion ${camionAffiche.numero} cloture automatiquement !`, 'success')
      }

    } else {
      // Journée normale
      const journeeData: JourneeProduction = {
        id: editJournee?.id || genId(),
        camionId: camionAffiche.id,
        date: dateJ,
        volumeRecuKg: recu,
        volumeEcartKg: ecart
      }
      updated = {
        ...updated,
        journeesProduction: editJournee
          ? updated.journeesProduction.map(j => j.id === editJournee.id ? journeeData : j)
          : [...updated.journeesProduction, journeeData]
      }
      updated = syncDepenseProduction(updated, journeeData, camionAffiche.id)

      // Vérif si objectif exact atteint
      if (nouveauCumul >= objectif && camionAffiche.statut === 'en_cours') {
        updated = {
          ...updated,
          camions: updated.camions.map(c =>
            c.id === camionAffiche.id ? { ...c, statut: 'cloture' as const, dateFin: dateJ } : c
          )
        }
        toast(`🚛 Camion ${camionAffiche.numero} clôturé — objectif atteint !`, 'success')
      } else {
        toast(editJournee ? 'Journée modifiée' : 'Journée enregistrée', 'success')
      }
    }

    setData(updated); saveData(updated)
    setShowAddJournee(false); setEditJournee(null)
    setVolumeRecu(''); setVolumeEcart('')
    setDateJ(new Date().toISOString().slice(0,10))
  }

  // ── SUPPRIMER CAMION ──
  const confirmerSuppressionCamion = () => {
    if (!deleteCamionModal) return
    if (deleteCamionPin !== data.config.pin) {
      setDeleteCamionPinErr('Code PIN incorrect')
      return
    }
    const idC = deleteCamionModal.id
    const updated = {
      ...data,
      camions: data.camions.filter(c => c.id !== idC),
      journeesProduction: data.journeesProduction.filter(j => j.camionId !== idC),
      depenses: data.depenses.filter(d => d.camionId !== idC),
    }
    setData(updated); saveData(updated)
    setDeleteCamionModal(null); setDeleteCamionPin(''); setDeleteCamionPinErr('')
    setCamionVue(null)
    toast(`Camion ${deleteCamionModal.numero} supprimé`, 'info')
  }

  const supprimerJournee = (id: string) => {
    if (!confirm('Supprimer cette journée de production ?')) return
    const updated = {
      ...data,
      journeesProduction: data.journeesProduction.filter(j => j.id !== id),
      depenses: data.depenses.filter(d => d.productionJourneeId !== id)
    }
    setData(updated); saveData(updated)
    toast('Journée supprimée', 'info')
  }

  const tooltipStyle = {
    contentStyle: { background: 'var(--forest)', border: '1px solid rgba(232,49,42,0.2)', borderRadius: 8, color: 'var(--cream)', fontSize: 11 }
  }

  const chartData = journees.map(j => ({
    date: j.date.slice(5),
    recu: j.volumeRecuKg,
    exportable: j.volumeRecuKg - j.volumeEcartKg,
    pctEcart: j.volumeRecuKg > 0 ? Math.round((j.volumeEcartKg / j.volumeRecuKg) * 1000) / 10 : 0,
  }))

  const depensesChart = journees.map(j => ({
    date: j.date.slice(5),
    depenses: depenses.filter(d => d.date <= j.date).reduce((a,d) => a + getMontantDepense(d), 0)
  }))

  const statutLabel = (s: Camion['statut']) =>
    s === 'cloture' ? '✓ Clôturé' : '● En cours'
  const statutColor = (s: Camion['statut']) =>
    s === 'cloture' ? 'var(--gray-dim)' : 'var(--green)'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--forest-deep)' }}>
      <Navbar />
      <PageWrapper>
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: 'var(--white)' }}>Production</h1>
            <p style={{ color: 'var(--gray)', marginTop: 4, fontSize: 13 }}>
              Objectif par camion : {data.config.objectifCamionKg.toLocaleString()} kg exportables
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!camionActif && (
              <button className="btn-primary ripple" onClick={() => {
                setNewCamionObjectif(data.config.objectifCamionKg.toString())
                setShowNewCamionModal(true)
              }} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13 }}>🚛 Nouveau camion</button>
            )}
            {camionActif && (
              <button onClick={() => { setEditJournee(null); setVolumeRecu(''); setVolumeEcart(''); setDateJ(new Date().toISOString().slice(0,10)); setShowAddJournee(true) }}
                className="btn-primary ripple" style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13 }}>+ Journée</button>
            )}
          </div>
        </div>


        {/* Navigation camions */}
        {data.camions.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {data.camions.length > 1 && (
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gray-dim)', fontWeight: 600, marginBottom: 8 }}>
                Camions
              </div>
            )}
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {data.camions.map(c => {
                const active = camionVue ? camionVue === c.id : c.statut !== 'cloture'
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => setCamionVue(c.statut === 'cloture' ? c.id : null)} style={{
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
                    <button
                      onClick={() => { setDeleteCamionModal(c); setDeleteCamionPin(''); setDeleteCamionPinErr('') }}
                      title={`Supprimer Camion ${c.numero}`}
                      style={{
                        width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', border: 'none',
                        background: 'var(--red-muted)', color: 'var(--red-bright)',
                        fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s', lineHeight: 1
                      }}>
                      🗑
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!camionAffiche ? (
          <div className="card" style={{ padding: 50, textAlign: 'center', color: 'var(--gray-dim)' }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>🚛</div>
            <p style={{ fontSize: 15, marginBottom: 20 }}>Aucun camion actif.</p>
            <button className="btn-primary ripple" onClick={() => {
              setNewCamionObjectif(data.config.objectifCamionKg.toString())
              setShowNewCamionModal(true)
            }} style={{ padding: '11px 24px', borderRadius: 9, fontSize: 14 }}>Créer le premier camion</button>
          </div>
        ) : (
          <>
            {/* Barre progression */}
            <div className="card stripe-red" style={{ padding: '16px 20px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--white)' }}>
                  🚛 Camion {camionAffiche.numero} — <span style={{ color: statutColor(camionAffiche.statut) }}>{statutLabel(camionAffiche.statut)}</span>
                </span>
                <span style={{ fontSize: 13, color: 'var(--gray)' }}>
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>{stats.totalExportable.toLocaleString()}</span> / {camionAffiche.objectifKg.toLocaleString()} kg
                  {kgRestants > 0 && <span style={{ color: 'var(--gray-dim)', marginLeft: 8 }}>· {kgRestants.toLocaleString()} kg restants</span>}
                </span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: 'var(--forest-mid)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 5, width: `${progression}%`,
                  background: progression >= 100 ? 'var(--gold)' : 'linear-gradient(90deg, var(--green), #5cb87a)',
                  transition: 'width 0.8s ease'
                }} />
              </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Total reçu', value: `${stats.totalRecu.toLocaleString()} kg`, color: 'var(--white)', stripe: 'stripe-white' },
                { label: 'Exportable', value: `${stats.totalExportable.toLocaleString()} kg`, color: 'var(--green)', stripe: 'stripe-green' },
                { label: 'Écarts', value: `${stats.totalEcart.toLocaleString()} kg`, color: 'var(--red-bright)', stripe: 'stripe-red' },
                { label: '% Écart', value: `${stats.pctEcart}%`, color: stats.pctEcart > 20 ? 'var(--red-bright)' : 'var(--gold)', stripe: 'stripe-white' },
              ].map((k,i) => (
                <div key={i} className={`card ${k.stripe} fade-in`} style={{ padding: '14px', textAlign: 'center', animationDelay: `${i*0.06}s` }}>
                  <div style={{ fontSize: 17, fontFamily: 'Playfair Display, serif', color: k.color, fontWeight: 700 }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--gray-dim)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* 4 courbes */}
            {chartData.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  { title: 'Kg reçus / jour', dataKey: 'recu', color: '#4a90d9', unit: ' kg' },
                  { title: 'Kg exportables / jour', dataKey: 'exportable', color: '#3db06a', unit: ' kg' },
                ].map(({ title, dataKey, color, unit }) => (
                  <div key={dataKey} className="card" style={{ padding: '14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>{title}</div>
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="date" tick={{ fill: 'rgba(240,237,232,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'rgba(240,237,232,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${v}${unit}`, title]} />
                        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ))}
                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>% Écart / jour</div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fill: 'rgba(240,237,232,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'rgba(240,237,232,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                      <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${v}%`, '% Écart']} />
                      <Line type="monotone" dataKey="pctEcart" stroke="#E8312A" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Dépenses cumulées camion</div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={depensesChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fill: 'rgba(240,237,232,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'rgba(240,237,232,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip {...tooltipStyle} formatter={(v: unknown) => [formatFCFA(Number(v)), 'Dépenses']} />
                      <Line type="monotone" dataKey="depenses" stroke="#e0a83a" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Historique */}
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: 11, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                Journées production — Camion {camionAffiche.numero}
              </div>
              {journees.length === 0 ? (
                <p style={{ color: 'var(--gray-dim)', fontSize: 13 }}>Aucune journée enregistrée.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[...journees].reverse().map(j => {
                    const exportable = j.volumeRecuKg - j.volumeEcartKg
                    const pct = j.volumeRecuKg > 0 ? Math.round((j.volumeEcartKg / j.volumeRecuKg) * 1000) / 10 : 0
                    return (
                      <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'var(--forest-mid)' }}>
                        <span style={{ fontSize: 13, color: 'var(--cream)', fontWeight: 500, minWidth: 100 }}>{formatDate(j.date)}</span>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: 'var(--gray)' }}>Reçu : <span style={{ color: 'var(--white)', fontWeight: 600 }}>{j.volumeRecuKg.toLocaleString()} kg</span></span>
                          <span style={{ fontSize: 12, color: 'var(--gray)' }}>Export : <span style={{ color: 'var(--green)', fontWeight: 600 }}>{exportable.toLocaleString()} kg</span></span>
                          <span style={{ fontSize: 12, color: 'var(--gray)' }}>Écart : <span style={{ color: 'var(--red-bright)', fontWeight: 600 }}>{j.volumeEcartKg.toLocaleString()} kg ({pct}%)</span></span>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={() => ouvrirEditJournee(j)} style={{ background: 'var(--green-muted)', border: '1px solid rgba(61,176,106,0.3)', color: 'var(--green)', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontSize: 11 }}>✏</button>
                            <button onClick={() => supprimerJournee(j.id)} style={{ background: 'var(--red-muted)', border: '1px solid var(--red-border)', color: 'var(--red-bright)', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontSize: 11 }}>✕</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Bilan global */}
            {data.camions.length > 1 && (
              <div className="card stripe-green" style={{ padding: '16px', marginTop: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Bilan global — {data.camions.length} camions</div>
                <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                  <div><div style={{ fontSize: 17, color: 'var(--white)', fontWeight: 700 }}>{statsGlobal.totalRecu.toLocaleString()} kg</div><div style={{ fontSize: 11, color: 'var(--gray-dim)' }}>Total reçu</div></div>
                  <div><div style={{ fontSize: 17, color: 'var(--green)', fontWeight: 700 }}>{statsGlobal.totalExportable.toLocaleString()} kg</div><div style={{ fontSize: 11, color: 'var(--gray-dim)' }}>Total exportable</div></div>
                  <div><div style={{ fontSize: 17, color: 'var(--red-bright)', fontWeight: 700 }}>{statsGlobal.pctEcart}%</div><div style={{ fontSize: 11, color: 'var(--gray-dim)' }}>% écart moyen</div></div>
                  <div><div style={{ fontSize: 17, color: 'var(--gold)', fontWeight: 700 }}>{data.camions.filter(c=>c.statut==='cloture').length} / {data.camions.length}</div><div style={{ fontSize: 11, color: 'var(--gray-dim)' }}>Camions clôturés</div></div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      </PageWrapper>

      {/* Modal journée */}
      {showAddJournee && (
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
                <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Volume reçu (kg)</label>
                <input type="number" min="0" value={volumeRecu} onChange={e => setVolumeRecu(e.target.value)} placeholder="ex: 8500" style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Volume écart (kg)</label>
                <input type="number" min="0" value={volumeEcart} onChange={e => setVolumeEcart(e.target.value)} placeholder="ex: 1200" style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} />
              </div>
              {volumeRecu && parseFloat(volumeRecu) > 0 && (
                <div style={{ padding: '12px', borderRadius: 8, background: 'var(--forest-mid)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, color: 'var(--green)', fontWeight: 700 }}>
                      {(parseFloat(volumeRecu) - (parseFloat(volumeEcart)||0)).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--gray-dim)' }}>Export kg</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, color: 'var(--red-bright)', fontWeight: 700 }}>{(parseFloat(volumeEcart)||0).toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: 'var(--gray-dim)' }}>Écart kg</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, color: 'var(--gold)', fontWeight: 700 }}>
                      {Math.round(((parseFloat(volumeEcart)||0) / parseFloat(volumeRecu)) * 1000) / 10}%
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--gray-dim)' }}>% écart</div>
                  </div>
                </div>
              )}
              {/* Avertissement surplus */}
              {volumeRecu && camionAffiche && (() => {
                const exportable = parseFloat(volumeRecu) - (parseFloat(volumeEcart)||0)
                const journeesEx = getJourneesCamion(camionAffiche.id, data).filter(j => editJournee ? j.id !== editJournee.id : true)
                const cumul = getStatsProduction(journeesEx).totalExportable
                const surplus = (cumul + exportable) - camionAffiche.objectifKg
                if (surplus > 0) return (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(224,168,58,0.1)', border: '1px solid rgba(224,168,58,0.3)' }}>
                    <p style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>
                      ⚡ Camion {camionAffiche.numero} sera clôturé automatiquement
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--gray)', marginTop: 3 }}>
                      Surplus de {surplus.toLocaleString()} kg → Camion {data.camions.length + 1} (nouveau)
                    </p>
                  </div>
                )
                return null
              })()}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => { setShowAddJournee(false); setEditJournee(null) }} className="btn-ghost" style={{ padding: '9px 16px', borderRadius: 8 }}>Annuler</button>
              <button className="btn-primary ripple" onClick={sauvegarderJournee} style={{ padding: '9px 18px', borderRadius: 8 }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NOUVEAU CAMION ── */}
      {showNewCamionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)' }}>
          <div className="card modal-card" style={{ padding: 28, width: 380 }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, marginBottom: 6, color: 'var(--white)' }}>
              🚛 Nouveau camion
            </h3>
            <p style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 18 }}>
              Définissez l'objectif en kg exportables pour ce camion.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Objectif exportable (kg)</label>
                <input
                  type="number" min="1" value={newCamionObjectif}
                  onChange={e => setNewCamionObjectif(e.target.value)}
                  placeholder={`ex: ${data.config.objectifCamionKg.toLocaleString()}`}
                  style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} autoFocus
                />
                <p style={{ fontSize: 11, color: 'var(--gray-dim)', marginTop: 5 }}>
                  Défaut config : {data.config.objectifCamionKg.toLocaleString()} kg
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => { setShowNewCamionModal(false); setNewCamionObjectif('') }} className="btn-ghost" style={{ padding: '9px 16px', borderRadius: 8 }}>Annuler</button>
              <button className="btn-primary ripple" onClick={creerCamionAvecObjectif} style={{ padding: '9px 18px', borderRadius: 8 }}>
                Créer le camion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIG OBJECTIF CAMION AUTO-CRÉÉ ── */}
      {configCamionModal && (() => {
        const camion = data.camions.find(c => c.id === configCamionModal)
        if (!camion) return null
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250, backdropFilter: 'blur(4px)' }}>
            <div className="card modal-card" style={{ padding: 28, width: 400 }}>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, marginBottom: 6, color: 'var(--gold)' }}>
                ⚡ Configurer Camion {camion.numero}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 18, lineHeight: 1.6 }}>
                Le Camion {camion.numero} vient d'être créé automatiquement avec le surplus. Définissez son objectif en kg exportables.
              </p>
              <div>
                <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Objectif exportable (kg)</label>
                <input
                  type="number" min="1" value={configCamionObjectif}
                  onChange={e => setConfigCamionObjectif(e.target.value)}
                  placeholder={`ex: ${data.config.objectifCamionKg.toLocaleString()}`}
                  style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} autoFocus
                />
                <p style={{ fontSize: 11, color: 'var(--gray-dim)', marginTop: 5 }}>
                  Défaut : {data.config.objectifCamionKg.toLocaleString()} kg — modifiez si cet objectif est différent
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
                <button onClick={() => setConfigCamionModal(null)} className="btn-ghost" style={{ padding: '9px 16px', borderRadius: 8 }}>Garder le défaut</button>
                <button className="btn-primary ripple" onClick={mettreAJourObjectifCamion} style={{ padding: '9px 18px', borderRadius: 8 }}>
                  Confirmer l'objectif
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── MODAL SUPPRIMER CAMION ── */}
      {deleteCamionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)' }}>
          <div className="card modal-card" style={{ padding: 28, width: 380 }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, marginBottom: 8, color: 'var(--red-bright)' }}>
              🗑 Supprimer Camion {deleteCamionModal.numero}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 6, lineHeight: 1.6 }}>
              Toutes les journées de production et les dépenses liées à ce camion seront supprimées définitivement.
            </p>
            <p style={{ fontSize: 13, color: 'var(--white)', fontWeight: 600, marginBottom: 18 }}>
              {getJourneesCamion(deleteCamionModal.id, data).length} journée(s) · {getDepensesCamion(deleteCamionModal.id, data).length} dépense(s) effacées.
            </p>
            <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>Entrez votre PIN pour confirmer</label>
            <input type="password" maxLength={4} value={deleteCamionPin}
              onChange={e => { setDeleteCamionPin(e.target.value.replace(/\D/g,'')); setDeleteCamionPinErr('') }}
              placeholder="••••" style={{ width: '100%', padding: '11px 14px', fontSize: 22, letterSpacing: '0.35em', textAlign: 'center', marginBottom: 10 }} autoFocus />
            {deleteCamionPinErr && <p style={{ fontSize: 12, color: 'var(--red-bright)', marginBottom: 10, textAlign: 'center' }}>{deleteCamionPinErr}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button onClick={() => { setDeleteCamionModal(null); setDeleteCamionPin(''); setDeleteCamionPinErr('') }}
                className="btn-ghost" style={{ flex: 1, padding: '10px', borderRadius: 8 }}>Annuler</button>
              <button onClick={confirmerSuppressionCamion} style={{
                flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                background: 'var(--red)', border: 'none', color: 'white',
                fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 14
              }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// PATCH: This file needs the delete camion modal added
