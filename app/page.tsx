'use client'
import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import PageWrapper from '@/components/PageWrapper'
import { useToast } from '@/components/Toast'
import { useCountUp } from '@/hooks/useCountUp'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import {
  loadData, saveData, genId, formatFCFA, formatDate,
  AppData, Journee, Session, getTauxForEmploye, getMontantJournee,
  getSessionActive, getJourneesSession, getStatutEmployeJournee
} from '@/lib/store'

export default function SessionPage() {
  const [data, setData] = useState<AppData | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [tauxH, setTauxH] = useState('')
  const [tauxF, setTauxF] = useState('')
  const [ancienPin, setAncienPin] = useState('')
  const [nouveauPin, setNouveauPin] = useState('')
  const [confirmerPin, setConfirmerPin] = useState('')
  const [pinMsg, setPinMsg] = useState<{type:'ok'|'err', text:string} | null>(null)
  const [showJourneeModal, setShowJourneeModal] = useState(false)
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10))
  const [sessionVue, setSessionVue] = useState<string | null>(null)
  const [bonusModal, setBonusModal] = useState<Journee | null>(null)
  const [bonusInput, setBonusInput] = useState('')
  // Suppression session
  const [deleteModal, setDeleteModal] = useState<Session | null>(null)
  const [deletePin, setDeletePin] = useState('')
  const [deletePinErr, setDeletePinErr] = useState('')
  // Réinitialiser tout
  const [resetPin, setResetPin] = useState('')
  const [resetPinErr, setResetPinErr] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const toast = useToast()

  useEffect(() => {
    const d = loadData()
    if (d.sessions.length === 0) {
      const s: Session = { id: genId(), numero: 1, dateDebut: new Date().toISOString().slice(0,10), fermee: false }
      d.sessions = [s]
      saveData(d)
    }
    setData(d)
    setTauxH(d.config.tauxHomme.toString())
    setTauxF(d.config.tauxFemme.toString())
    // Sync depuis Supabase
    import('@/lib/syncFromSupabase').then(({ syncFromSupabase }) => {
      syncFromSupabase(remote => {
        setData(remote)
        setTauxH(remote.config.tauxHomme.toString())
        setTauxF(remote.config.tauxFemme.toString())
      })
    })
  }, [])

  const sessionActive0 = data ? getSessionActive(data) : null
  const sessionAffichee0 = data ? (sessionVue ? data.sessions.find(s => s.id === sessionVue) || sessionActive0 : sessionActive0) : null
  const journeesSession0 = data && sessionAffichee0 ? getJourneesSession(sessionAffichee0.id, data.journees) : []
  const nbJournees0 = journeesSession0.length
  const montantSession0 = data ? data.employes.reduce((acc, e) => {
    const taux = getTauxForEmploye(e, data.config)
    const jours = journeesSession0.filter(j => !j.absents.includes(e.id)).length
    return acc + jours * taux
  }, 0) : 0

  const countEmployes = useCountUp(data?.employes.length || 0, 800, 100)
  const countJournees = useCountUp(nbJournees0, 900, 200)
  const countMontant  = useCountUp(montantSession0, 1100, 300)

  if (!data) return <SessionSkeleton />

  const sessionActive = getSessionActive(data)
  const sessionAffichee = sessionVue
    ? data.sessions.find(s => s.id === sessionVue) || sessionActive
    : sessionActive

  const journeesSession = sessionAffichee
    ? getJourneesSession(sessionAffichee.id, data.journees)
    : []

  const nbJournees = journeesSession.length
  const montantSession = data.employes.reduce((acc, e) => {
    const taux = getTauxForEmploye(e, data.config)
    const jours = journeesSession.filter(j => !j.absents.includes(e.id)).length
    return acc + jours * taux
  }, 0)

  const montantGlobal = data.employes.reduce((acc, e) => {
    const taux = getTauxForEmploye(e, data.config)
    const jours = data.journees.filter(j => !j.absents.includes(e.id)).length
    return acc + jours * taux
  }, 0)
  const totalJourneesGlobal = new Set(data.journees.map(j => j.date)).size

  const peutFermer = sessionActive && getJourneesSession(sessionActive.id, data.journees).length >= 15
  const proche15 = sessionActive && getJourneesSession(sessionActive.id, data.journees).length >= 13

  const fermerSession = () => {
    if (!sessionActive) return
    const nouvSession: Session = {
      id: genId(), numero: sessionActive.numero + 1,
      dateDebut: new Date().toISOString().slice(0,10), fermee: false
    }
    const updated = {
      ...data,
      sessions: data.sessions.map(s => s.id === sessionActive.id
        ? { ...s, fermee: true, dateFin: new Date().toISOString().slice(0,10) }
        : s).concat(nouvSession)
    }
    setData(updated); saveData(updated); setSessionVue(null)
    toast(`Session ${sessionActive.numero} fermée — Session ${nouvSession.numero} démarrée`, 'success')
  }

  const addJournee = () => {
    if (!newDate || !sessionActive) return
    if (data.journees.find(j => j.date === newDate)) {
      toast('Une journée pour cette date existe déjà.', 'error'); return
    }
    const j: Journee = { id: genId(), sessionId: sessionActive.id, date: newDate, absents: [], ecartKg: 0 }
    const updated = { ...data, journees: [...data.journees, j].sort((a, b) => a.date.localeCompare(b.date)) }
    setData(updated); saveData(updated)
    setShowJourneeModal(false)
    setNewDate(new Date().toISOString().slice(0, 10))
    toast(`Journée du ${formatDate(newDate)} ajoutée`, 'success')
  }

  const saveConfig = () => {
    const updated = { ...data, config: { ...data.config, tauxHomme: parseInt(tauxH) || 3500, tauxFemme: parseInt(tauxF) || 3000 } }
    setData(updated); saveData(updated); setShowConfig(false)
    toast('Taux mis à jour', 'success')
  }

  const changerPin = () => {
    setPinMsg(null)
    if (ancienPin !== data.config.pin) { setPinMsg({type:'err', text:'Ancien code incorrect.'}); return }
    if (nouveauPin.length !== 4 || !/^\d{4}$/.test(nouveauPin)) { setPinMsg({type:'err', text:'Le nouveau code doit être 4 chiffres.'}); return }
    if (nouveauPin !== confirmerPin) { setPinMsg({type:'err', text:'Les codes ne correspondent pas.'}); return }
    const updated = { ...data, config: { ...data.config, pin: nouveauPin } }
    setData(updated); saveData(updated)
    setPinMsg({type:'ok', text:'Code PIN modifié ✓'})
    setAncienPin(''); setNouveauPin(''); setConfirmerPin('')
  }

  const openRapport = () => {
    const sid = sessionAffichee?.id || ''
    window.open(`/rapport?session=${sid}`, '_blank')
  }

  const removeJournee = (id: string) => {
    const updated = { ...data, journees: data.journees.filter(j => j.id !== id) }
    setData(updated); saveData(updated)
    toast('Journée supprimée', 'info')
  }

  const saveBonus = () => {
    if (!bonusModal) return
    const bonus = parseInt(bonusInput) || 0
    const updated = { ...data, journees: data.journees.map(j => j.id === bonusModal.id ? { ...j, bonusJour: bonus > 0 ? bonus : undefined } : j) }
    setData(updated); saveData(updated)
    setBonusModal(null); setBonusInput('')
    toast(bonus > 0 ? `Bonus de ${formatFCFA(bonus)} enregistré` : 'Bonus supprimé', 'success')
  }

  // ── SUPPRIMER SESSION ──
  const confirmerSuppressionSession = () => {
    if (!deleteModal) return
    if (deletePin !== data.config.pin) {
      setDeletePinErr('Code PIN incorrect')
      return
    }
    const idS = deleteModal.id
    // Supprimer la session + ses journées
    let updated = {
      ...data,
      sessions: data.sessions.filter(s => s.id !== idS),
      journees: data.journees.filter(j => j.sessionId !== idS),
    }
    // Si plus de session active, créer une nouvelle
    const encoreActive = updated.sessions.find(s => !s.fermee)
    if (!encoreActive) {
      const nouvNum = (updated.sessions.reduce((m, s) => Math.max(m, s.numero), 0)) + 1
      const nouvS: Session = { id: genId(), numero: nouvNum, dateDebut: new Date().toISOString().slice(0,10), fermee: false }
      updated = { ...updated, sessions: [...updated.sessions, nouvS] }
    }
    setData(updated); saveData(updated)
    setDeleteModal(null); setDeletePin(''); setDeletePinErr('')
    setSessionVue(null)
    toast(`Session ${deleteModal.numero} supprimée`, 'info')
  }

  const confirmerReset = () => {
    if (resetPin !== data.config.pin) { setResetPinErr('Code PIN incorrect'); return }
    const fresh: AppData = {
      employes: [], journees: [], depenses: [],
      camions: [], journeesProduction: [],
      sessions: [{ id: genId(), numero: 1, dateDebut: new Date().toISOString().slice(0,10), fermee: false }],
      config: { ...data.config }
    }
    setData(fresh); saveData(fresh)
    setShowConfig(false); setShowResetConfirm(false); setResetPin(''); setResetPinErr('')
    setSessionVue(null)
    toast('Système réinitialisé — prêt pour la campagne', 'success')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--forest-deep)' }}>
      <Navbar />
      <PageWrapper>
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 30, color: 'var(--white)', lineHeight: 1.1 }}>
              Campagne Mangue
            </h1>
            <p style={{ color: 'rgba(245,240,232,0.45)', marginTop: 5, fontSize: 13 }}>
              {data.sessions.length} session(s) · {totalJourneesGlobal} journée(s) au total
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={openRapport} style={{
              padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
              background: 'var(--forest-mid)', border: '1px solid rgba(61,176,106,0.25)',
              color: 'var(--green)', fontSize: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
              transition: 'all 0.18s'
            }}>📄 Rapport PDF</button>
            <button onClick={() => setShowConfig(true)} style={{
              padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
              background: 'var(--forest-mid)', border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--cream)', fontSize: 12, fontFamily: 'DM Sans, sans-serif'
            }}>⚙ Paramètres</button>
            {!sessionVue && sessionActive && (
              <button className="btn-primary ripple" onClick={() => setShowJourneeModal(true)}
                style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13 }}>
                + Journée
              </button>
            )}
          </div>
        </div>

        {/* Alerte 15 jours */}
        {proche15 && sessionActive && !sessionVue && (
          <div style={{
            background: peutFermer ? 'rgba(232,49,42,0.12)' : 'rgba(232,49,42,0.07)',
            border: `1px solid var(--red-border)`,
            borderLeft: `4px solid var(--red)`,
            borderRadius: 10, padding: '14px 18px', marginBottom: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <span style={{ fontWeight: 600, color: 'var(--red-bright)', fontSize: 14 }}>
                {peutFermer ? '🔴 Session complète — 15 jours atteints' : `⚠️ ${nbJournees}/15 jours — session bientôt complète`}
              </span>
              {peutFermer && <p style={{ fontSize: 12, color: 'var(--gray)', marginTop: 3 }}>Fermez cette session pour en commencer une nouvelle.</p>}
            </div>
            {peutFermer && (
              <button onClick={fermerSession} className="btn-primary" style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, whiteSpace: 'nowrap' }}>
                Fermer & Nouvelle session
              </button>
            )}
          </div>
        )}

        {/* Navigation sessions */}
        {data.sessions.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gray-dim)', fontWeight: 600, marginBottom: 10 }}>
              Sessions RH
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {data.sessions.map(s => {
                const active = sessionVue ? sessionVue === s.id : (!s.fermee)
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => setSessionVue(s.fermee ? s.id : null)} style={{
                      padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
                      fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600,
                      background: active ? 'var(--red)' : 'var(--forest-mid)',
                      color: active ? 'white' : 'var(--gray)',
                      border: active ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      transition: 'all 0.18s',
                      boxShadow: active ? '0 2px 10px rgba(232,49,42,0.3)' : 'none'
                    }}>
                      Session {s.numero} {s.fermee ? '✓' : '●'}
                    </button>
                    {/* Bouton supprimer session */}
                    <button
                      onClick={() => { setDeleteModal(s); setDeletePin(''); setDeletePinErr('') }}
                      title={`Supprimer Session ${s.numero}`}
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

        {/* KPI Session */}
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gray-dim)', fontWeight: 600 }}>
            {sessionAffichee ? `Session ${sessionAffichee.numero} ${sessionAffichee.fermee ? '· fermée' : '· en cours'}` : ''}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
          {[
            { label: 'Employés actifs', value: countEmployes.toString(), color: 'var(--green)', stripe: 'stripe-green' },
            { label: 'Journées session', value: `${countJournees} / 15`, color: 'var(--white)', stripe: 'stripe-white' },
            { label: 'Montant session', value: formatFCFA(countMontant), color: 'var(--red-bright)', stripe: 'stripe-red', small: true },
          ].map((kpi, i) => (
            <div key={i} className={`card ${kpi.stripe} fade-in`} style={{ padding: '22px 20px', animationDelay: `${i * 0.07}s` }}>
              <div style={{ fontSize: kpi.small ? 18 : 28, fontFamily: 'Playfair Display, serif', color: kpi.color, fontWeight: 700, lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ fontSize: 11, color: 'var(--gray-dim)', marginTop: 7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* KPI Global */}
        {data.sessions.length > 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 22 }}>
            {[
              { label: 'Total journées (global)', value: totalJourneesGlobal.toString(), color: 'var(--green)', stripe: 'stripe-green' },
              { label: 'Montant total global', value: formatFCFA(montantGlobal), color: 'var(--red-bright)', stripe: 'stripe-red', small: true },
            ].map((kpi, i) => (
              <div key={i} className={`card ${kpi.stripe}`} style={{ padding: '18px 20px', opacity: 0.85 }}>
                <div style={{ fontSize: kpi.small ? 16 : 22, fontFamily: 'Playfair Display, serif', color: kpi.color, fontWeight: 700 }}>{kpi.value}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-dim)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Taux */}
        <div className="card" style={{ padding: '12px 18px', marginBottom: 22, display: 'flex', gap: 24, alignItems: 'center' }}>
          <span style={{ color: 'var(--gray-dim)', fontSize: 12 }}>Taux journaliers :</span>
          <span style={{ color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>♂ Homme — {formatFCFA(data.config.tauxHomme)}</span>
          <span style={{ color: 'var(--red-bright)', fontSize: 13, fontWeight: 600 }}>♀ Femme — {formatFCFA(data.config.tauxFemme)}</span>
        </div>

        {/* Stats détaillées — session sélectionnée */}
        {sessionVue && sessionAffichee && (() => {
          const jSession = getJourneesSession(sessionAffichee.id, data.journees)
          const totalPossible = data.employes.reduce((acc, e) => {
            const actifs = jSession.filter(j => getStatutEmployeJournee(e, j) !== 'na').length
            return acc + actifs
          }, 0)
          const totalPresences = data.employes.reduce((acc, e) => {
            const p = jSession.filter(j => getStatutEmployeJournee(e, j) === 'present').length
            return acc + p
          }, 0)
          const tauxGlobal = totalPossible > 0 ? Math.round((totalPresences / totalPossible) * 100) : 0
          const donutData = [
            { name: 'Présents', value: totalPresences },
            { name: 'Absents', value: totalPossible - totalPresences },
          ]

          const statsEmployes = data.employes.map(e => {
            const joursActifs = jSession.filter(j => getStatutEmployeJournee(e, j) !== 'na').length
            const joursPresents = jSession.filter(j => getStatutEmployeJournee(e, j) === 'present').length
            const taux = joursActifs > 0 ? Math.round((joursPresents / joursActifs) * 100) : 0
            return { e, joursPresents, joursActifs, taux }
          }).sort((a, b) => b.taux - a.taux)

          // Badge équipe stable
          const idxSession = data.sessions.findIndex(s => s.id === sessionAffichee.id)
          const sessionSuivante = data.sessions[idxSession + 1]
          let badge = null
          if (sessionSuivante) {
            const jSuiv = getJourneesSession(sessionSuivante.id, data.journees)
            const empSession = new Set(data.employes.filter(e => jSession.some(j => getStatutEmployeJournee(e, j) === 'present')).map(e => e.id))
            const empSuiv = new Set(data.employes.filter(e => jSuiv.some(j => getStatutEmployeJournee(e, j) === 'present')).map(e => e.id))
            const communs = [...empSession].filter(id => empSuiv.has(id)).length
            const ratio = empSession.size > 0 ? communs / empSession.size : 0
            badge = ratio >= 0.8
              ? { label: 'Équipe stable 🟢', color: 'var(--green)', bg: 'rgba(61,176,106,0.12)', border: 'rgba(61,176,106,0.3)' }
              : { label: 'Équipe renouvelée 🔄', color: 'var(--gold)', bg: 'rgba(224,168,58,0.1)', border: 'rgba(224,168,58,0.3)' }
          }

          return (
            <div className="fade-in" style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gray-dim)', fontWeight: 600, marginBottom: 12 }}>
                Analyse — Session {sessionAffichee.numero}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14, marginBottom: 14 }}>
                {/* Donut */}
                <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Présence globale</div>
                  <PieChart width={120} height={120}>
                    <Pie data={donutData} cx={55} cy={55} innerRadius={38} outerRadius={56} dataKey="value" strokeWidth={0}>
                      <Cell fill="#3db06a" />
                      <Cell fill="#E8312A" fillOpacity={0.7} />
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--forest)', border: '1px solid rgba(61,176,106,0.2)', borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                  <div style={{ fontSize: 22, fontFamily: 'Playfair Display, serif', color: 'var(--green)', fontWeight: 700, marginTop: 4 }}>{tauxGlobal}%</div>
                  <div style={{ fontSize: 10, color: 'var(--gray-dim)', marginTop: 2 }}>{totalPresences} / {totalPossible} j.</div>
                  {badge && (
                    <div style={{ marginTop: 10, padding: '4px 10px', borderRadius: 20, background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color, fontSize: 11, fontWeight: 600, textAlign: 'center' }}>
                      {badge.label}
                    </div>
                  )}
                </div>

                {/* Tableau employés */}
                <div className="card" style={{ padding: '14px 16px', overflowX: 'auto' }}>
                  <div style={{ fontSize: 10, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Présence par employé</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: 'var(--gray-dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>Employé</th>
                        <th style={{ textAlign: 'center', padding: '4px 8px', fontWeight: 600 }}>Jours</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 600 }}>Taux</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsEmployes.map(({ e, joursPresents, joursActifs, taux }) => (
                        <tr key={e.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '6px 8px', color: 'var(--cream)' }}>
                            {e.prenom} {e.nom}
                            <span style={{ fontSize: 10, color: 'var(--gray-dim)', marginLeft: 6 }}>{e.genre === 'H' ? '♂' : '♀'}</span>
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--gray)' }}>
                            {joursPresents} / {joursActifs}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                            <span style={{
                              fontWeight: 700, fontSize: 13,
                              color: taux >= 80 ? 'var(--green)' : taux >= 50 ? 'var(--gold)' : 'var(--red-bright)'
                            }}>{taux}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Journées */}
        <div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, marginBottom: 14, color: 'var(--white)' }}>
            Journées — Session {sessionAffichee?.numero}
          </h2>
          {journeesSession.length === 0 ? (
            <div className="card" style={{ padding: 36, textAlign: 'center', color: 'rgba(245,240,232,0.3)' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
              <p style={{ fontSize: 14 }}>{sessionVue ? 'Aucune journée dans cette session.' : 'Ajoutez la première journée pour commencer.'}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[...journeesSession].reverse().map((j, i) => {
                const presents = data.employes.filter(e => getStatutEmployeJournee(e, j) === 'present').length
                const montant = data.employes.reduce((acc, e) => acc + getMontantJournee(e, j, data.config), 0)
                return (
                  <div key={j.id} className="card stagger-item" style={{ padding: '14px 18px', animationDelay: `${i * 0.04}s` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--forest-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>📅</div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--white)', fontSize: 14 }}>{formatDate(j.date)}</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-dim)', marginTop: 2 }}>
                            {presents} présent(s) · {j.absents.length} absent(s)
                            {j.bonusJour ? <span style={{ color: 'var(--gold)', marginLeft: 8 }}>+{formatFCFA(j.bonusJour)} bonus</span> : null}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: 'var(--green)', fontWeight: 700, fontSize: 14 }}>{formatFCFA(montant)}</div>
                          <div style={{ fontSize: 10, color: 'var(--gray-dim)' }}>payé ce jour</div>
                        </div>
                        {j.ecartKg > 0 && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: 'var(--red-bright)', fontWeight: 600, fontSize: 13 }}>{j.ecartKg} kg</div>
                            <div style={{ fontSize: 10, color: 'var(--gray-dim)' }}>écarts</div>
                          </div>
                        )}
                        {!sessionVue && (
                          <>
                            <button onClick={() => setBonusModal(j)} style={{
                              background: j.bonusJour ? 'rgba(224,168,58,0.15)' : 'var(--forest-mid)',
                              border: `1px solid ${j.bonusJour ? 'rgba(224,168,58,0.35)' : 'rgba(255,255,255,0.08)'}`,
                              color: j.bonusJour ? 'var(--gold)' : 'var(--gray)', borderRadius: 6,
                              padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif'
                            }}>⚡ Bonus</button>
                            <button onClick={() => removeJournee(j.id)} style={{
                              background: 'var(--red-muted)', border: '1px solid var(--red-border)',
                              color: 'var(--red-bright)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12
                            }}>✕</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
      </PageWrapper>

      {/* ── MODAL PARAMÈTRES ── */}
      {showConfig && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)" }}>
          <div className="card" style={{ padding: 30, width: 420, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, marginBottom: 22, color: 'var(--white)' }}>Paramètres</h3>

            {/* Taux */}
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(245,240,232,0.4)', marginBottom: 12 }}>Taux journaliers</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(245,240,232,0.55)', display: 'block', marginBottom: 5 }}>Taux Homme (FCFA/jour)</label>
                <input value={tauxH} onChange={e => setTauxH(e.target.value)} type="number" style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(245,240,232,0.55)', display: 'block', marginBottom: 5 }}>Taux Femme (FCFA/jour)</label>
                <input value={tauxF} onChange={e => setTauxF(e.target.value)} type="number" style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 26 }}>
              <button className="btn-primary" onClick={saveConfig} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13 }}>Enregistrer les taux</button>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginBottom: 22 }} />

            {/* Modifier PIN */}
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(245,240,232,0.4)', marginBottom: 12 }}>Modifier le code PIN</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(245,240,232,0.55)', display: 'block', marginBottom: 5 }}>Ancien code</label>
                <input type="password" maxLength={4} value={ancienPin} onChange={e => { setAncienPin(e.target.value.replace(/\D/,'')); setPinMsg(null) }}
                  placeholder="••••" style={{ width: '100%', padding: '10px 14px', fontSize: 20, letterSpacing: '0.3em', textAlign: 'center' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(245,240,232,0.55)', display: 'block', marginBottom: 5 }}>Nouveau code (4 chiffres)</label>
                <input type="password" maxLength={4} value={nouveauPin} onChange={e => { setNouveauPin(e.target.value.replace(/\D/g,'')); setPinMsg(null) }}
                  placeholder="••••" style={{ width: '100%', padding: '10px 14px', fontSize: 20, letterSpacing: '0.3em', textAlign: 'center' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(245,240,232,0.55)', display: 'block', marginBottom: 5 }}>Confirmer le nouveau code</label>
                <input type="password" maxLength={4} value={confirmerPin} onChange={e => { setConfirmerPin(e.target.value.replace(/\D/g,'')); setPinMsg(null) }}
                  placeholder="••••" style={{ width: '100%', padding: '10px 14px', fontSize: 20, letterSpacing: '0.3em', textAlign: 'center' }} />
              </div>
            </div>
            {pinMsg && (
              <p style={{ fontSize: 13, color: pinMsg.type === 'ok' ? 'var(--green)' : 'var(--red-bright)', marginBottom: 14, textAlign: 'center', fontWeight: 500 }}>
                {pinMsg.text}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginBottom: 26 }}>
              <button onClick={() => { setShowConfig(false); setPinMsg(null); setAncienPin(''); setNouveauPin(''); setConfirmerPin('') }}
                style={{ padding: '9px 16px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--cream)', fontFamily: 'DM Sans, sans-serif' }}>Fermer</button>
              <button onClick={changerPin} style={{ padding: '9px 18px', borderRadius: 8, background: 'var(--forest-light)', border: '1px solid rgba(92,184,122,0.3)', color: 'var(--green)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 13 }}>
                Changer le PIN
              </button>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginBottom: 22 }} />

            {/* RÉINITIALISER TOUT */}
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(232,49,42,0.7)', marginBottom: 12 }}>
              ⚠️ Zone dangereuse
            </div>
            {!showResetConfirm ? (
              <button onClick={() => setShowResetConfirm(true)} style={{
                width: '100%', padding: '11px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(232,49,42,0.08)', border: '1px solid rgba(232,49,42,0.3)',
                color: 'var(--red-bright)', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 13
              }}>
                🗑 Réinitialiser tout le système
              </button>
            ) : (
              <div style={{ background: 'rgba(232,49,42,0.06)', border: '1px solid rgba(232,49,42,0.25)', borderRadius: 10, padding: '16px' }}>
                <p style={{ fontSize: 13, color: 'var(--red-bright)', fontWeight: 600, marginBottom: 4 }}>Cette action supprime TOUT</p>
                <p style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 14, lineHeight: 1.5 }}>
                  Employés, sessions, journées, camions, production, dépenses — tout sera effacé. Les paramètres (taux, PIN) seront conservés.
                </p>
                <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>Confirmez avec votre PIN</label>
                <input type="password" maxLength={4} value={resetPin}
                  onChange={e => { setResetPin(e.target.value.replace(/\D/g,'')); setResetPinErr('') }}
                  placeholder="••••" style={{ width: '100%', padding: '10px 14px', fontSize: 20, letterSpacing: '0.3em', textAlign: 'center', marginBottom: 10 }} autoFocus />
                {resetPinErr && <p style={{ fontSize: 12, color: 'var(--red-bright)', marginBottom: 10, textAlign: 'center' }}>{resetPinErr}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setShowResetConfirm(false); setResetPin(''); setResetPinErr('') }} style={{
                    flex: 1, padding: '9px', borderRadius: 8, cursor: 'pointer',
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--gray)', fontFamily: 'DM Sans, sans-serif'
                  }}>Annuler</button>
                  <button onClick={confirmerReset} style={{
                    flex: 1, padding: '9px', borderRadius: 8, cursor: 'pointer',
                    background: 'var(--red)', border: 'none', color: 'white', fontFamily: 'DM Sans, sans-serif', fontWeight: 700
                  }}>Tout effacer</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL NOUVELLE JOURNÉE ── */}
      {showJourneeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)" }}>
          <div className="card" style={{ padding: 30, width: 380 }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, marginBottom: 22, color: 'var(--white)' }}>Nouvelle journée</h3>
            {peutFermer ? (
              <div style={{ marginBottom: 18 }}>
                <p style={{ color: 'var(--red-bright)', fontSize: 14, lineHeight: 1.6 }}>
                  ⚠️ La session {sessionActive?.numero} a atteint 15 jours. Fermez-la d&apos;abord avant d&apos;ajouter une nouvelle journée.
                </p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, color: 'rgba(245,240,232,0.55)', display: 'block', marginBottom: 5 }}>Date</label>
                  <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ width: '100%', padding: '10px 14px', fontSize: 15 }} />
                </div>
                <p style={{ fontSize: 13, color: 'rgba(245,240,232,0.45)', marginBottom: 18 }}>
                  Tous les <strong style={{ color: 'var(--green)' }}>{data.employes.length} employé(s)</strong> seront <strong style={{ color: 'var(--green)' }}>présents</strong> par défaut.
                </p>
              </>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowJourneeModal(false)} style={{ padding: '9px 16px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--cream)', fontFamily: 'DM Sans, sans-serif' }}>Fermer</button>
              {!peutFermer && <button className="btn-primary" onClick={addJournee} style={{ padding: '9px 18px', borderRadius: 8 }}>Créer</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL BONUS ── */}
      {bonusModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)' }}>
          <div className="card modal-card" style={{ padding: 28, width: 380 }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, marginBottom: 6, color: 'var(--white)' }}>Bonus journée</h3>
            <p style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 20 }}>{formatDate(bonusModal.date)} · s&apos;applique à tous les présents</p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>Montant du bonus (FCFA/personne)</label>
              <input type="number" min="0" value={bonusInput} onChange={e => setBonusInput(e.target.value)}
                placeholder={bonusModal.bonusJour ? bonusModal.bonusJour.toString() : 'ex: 1000'}
                style={{ width: '100%', padding: '11px 14px', fontSize: 15 }} autoFocus />
              {bonusModal.bonusJour && (
                <p style={{ fontSize: 11, color: 'var(--gold)', marginTop: 6 }}>Bonus actuel : {formatFCFA(bonusModal.bonusJour)} · mettez 0 pour supprimer</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setBonusModal(null); setBonusInput('') }} className="btn-ghost" style={{ padding: '9px 16px', borderRadius: 8 }}>Annuler</button>
              <button className="btn-primary ripple" onClick={saveBonus} style={{ padding: '9px 18px', borderRadius: 8 }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SUPPRIMER SESSION ── */}
      {deleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)' }}>
          <div className="card modal-card" style={{ padding: 28, width: 380 }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, marginBottom: 8, color: 'var(--red-bright)' }}>
              🗑 Supprimer Session {deleteModal.numero}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 6, lineHeight: 1.6 }}>
              Toutes les journées de cette session seront supprimées définitivement.
            </p>
            <p style={{ fontSize: 13, color: 'var(--white)', fontWeight: 600, marginBottom: 18 }}>
              {getJourneesSession(deleteModal.id, data.journees).length} journée(s) seront effacées.
            </p>
            <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>Entrez votre PIN pour confirmer</label>
            <input type="password" maxLength={4} value={deletePin}
              onChange={e => { setDeletePin(e.target.value.replace(/\D/g,'')); setDeletePinErr('') }}
              placeholder="••••" style={{ width: '100%', padding: '11px 14px', fontSize: 22, letterSpacing: '0.35em', textAlign: 'center', marginBottom: 10 }} autoFocus />
            {deletePinErr && <p style={{ fontSize: 12, color: 'var(--red-bright)', marginBottom: 10, textAlign: 'center' }}>{deletePinErr}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button onClick={() => { setDeleteModal(null); setDeletePin(''); setDeletePinErr('') }}
                className="btn-ghost" style={{ flex: 1, padding: '10px', borderRadius: 8 }}>Annuler</button>
              <button onClick={confirmerSuppressionSession} style={{
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

function SessionSkeleton() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--forest-deep)' }}>
      <div style={{ height: 62, background: 'var(--forest-deep)', borderBottom: '2px solid var(--red)' }} />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        <div className="skeleton" style={{ height: 36, width: 260, marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 16, width: 180, marginBottom: 32 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 12 }} />)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 68, borderRadius: 12 }} />)}
        </div>
      </div>
    </div>
  )
}
