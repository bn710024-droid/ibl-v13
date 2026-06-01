'use client'
import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import PageWrapper from '@/components/PageWrapper'
import { useToast } from '@/components/Toast'
import {
  loadData, saveData, genId, formatFCFA, formatDate,
  AppData, Employe, getMontantTotal, getTauxForEmploye,
  verifierPin, getStatutEmployeJournee, getMontantJournee
} from '@/lib/store'
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function EmployesPage() {
  const [data, setData] = useState<AppData | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<Employe | null>(null)
  const [search, setSearch] = useState('')
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [genre, setGenre] = useState<'H' | 'F'>('H')
  const [jourClique, setJourClique] = useState<string | null>(null)
  const toast = useToast()

  // Modifier profil
  const [showEditModal, setShowEditModal] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinValide, setPinValide] = useState(false)
  const [pinErreur, setPinErreur] = useState(false)
  const [editNom, setEditNom] = useState('')
  const [editPrenom, setEditPrenom] = useState('')
  const [editGenre, setEditGenre] = useState<'H' | 'F'>('H')
  const [editTaux, setEditTaux] = useState('')

  useEffect(() => {
    setData(loadData())
    import('@/lib/syncFromSupabase').then(({ syncFromSupabase }) => {
      syncFromSupabase(remote => setData(remote))
    })
  }, [])
  if (!data) return null

  const addEmploye = () => {
    if (!nom.trim() || !prenom.trim()) return
    const today = new Date().toISOString().slice(0, 10)
    const e: Employe = { id: genId(), nom: nom.trim(), prenom: prenom.trim(), genre, dateAjout: today, dateEmbauche: today }
    // Ajouter l'employé comme absent sur toutes les journées existantes → 0 présence automatique
    const updated = {
      ...data,
      employes: [...data.employes, e],
      journees: data.journees.map(j => ({
        ...j,
        absents: j.absents.includes(e.id) ? j.absents : [...j.absents, e.id]
      }))
    }
    setData(updated); saveData(updated)
    setNom(''); setPrenom(''); setGenre('H'); setShowAdd(false)
    toast(`${e.prenom} ${e.nom} ajouté(e)`, 'success')
  }

  const deleteEmploye = (id: string) => {
    const emp = data.employes.find(e => e.id === id)
    const updated = {
      ...data,
      employes: data.employes.filter(e => e.id !== id),
      journees: data.journees.map(j => ({ ...j, absents: j.absents.filter(a => a !== id) }))
    }
    setData(updated); saveData(updated); setSelected(null)
    if (emp) toast(`${emp.prenom} ${emp.nom} supprimé(e)`, 'info')
  }

  const togglePresence = (employeId: string, journeeId: string) => {
    const updated = {
      ...data,
      journees: data.journees.map(j => {
        if (j.id !== journeeId) return j
        const isAbsent = j.absents.includes(employeId)
        return { ...j, absents: isAbsent ? j.absents.filter(a => a !== employeId) : [...j.absents, employeId] }
      })
    }
    setData(updated); saveData(updated)
    if (selected) setSelected(updated.employes.find(e => e.id === selected.id) || null)
  }

  const ouvrirEdit = (e: Employe) => {
    setEditNom(e.nom)
    setEditPrenom(e.prenom)
    setEditGenre(e.genre)
    setEditTaux(e.tauxIndividuel ? e.tauxIndividuel.toString() : '')
    setPinInput('')
    setPinValide(false)
    setPinErreur(false)
    setShowEditModal(true)
  }

  const validerPin = () => {
    if (verifierPin(pinInput, data.config)) {
      setPinValide(true)
      setPinErreur(false)
    } else {
      setPinErreur(true)
      setPinInput('')
    }
  }

  const sauvegarderEdit = () => {
    if (!selected) return
    const updated = {
      ...data,
      employes: data.employes.map(e => e.id === selected.id ? {
        ...e,
        nom: editNom.trim(),
        prenom: editPrenom.trim(),
        genre: editGenre,
        tauxIndividuel: editTaux ? parseInt(editTaux) : undefined
      } : e)
    }
    setData(updated); saveData(updated)
    setSelected(updated.employes.find(e => e.id === selected.id) || null)
    setShowEditModal(false)
  }

  const ProfileView = ({ e }: { e: Employe }) => {
    const [sessionVue, setSessionVue] = useState<string | null>(null)
    const [showSortieInput, setShowSortieInput] = useState(false)
    const [sortieDate, setSortieDate] = useState(e.dateSortie || '')
    const taux = getTauxForEmploye(e, data.config)

    const sessionActive = data.sessions.find(s => !s.fermee) || null
    const sessionAffichee = sessionVue
      ? data.sessions.find(s => s.id === sessionVue) || sessionActive
      : sessionActive

    const journeesSession = sessionAffichee
      ? data.journees.filter(j => j.sessionId === sessionAffichee.id).sort((a,b) => a.date.localeCompare(b.date))
      : []

    const joursPresentsSession = journeesSession.filter(j => getStatutEmployeJournee(e, j) === 'present').length
    const joursAbsentsSession  = journeesSession.filter(j => getStatutEmployeJournee(e, j) === 'absent').length
    const joursNASession       = journeesSession.filter(j => getStatutEmployeJournee(e, j) === 'na').length
    const montantSession = journeesSession.reduce((acc, j) => acc + getMontantJournee(e, j, data.config), 0)

    const joursPresentsTotal = data.journees.filter(j => getStatutEmployeJournee(e, j) === 'present').length
    const montantTotal = getMontantTotal(e, data.journees, data.config)

    const statsParSession = data.sessions.map(s => {
      const jours = data.journees.filter(j => j.sessionId === s.id)
      const presents = jours.filter(j => getStatutEmployeJournee(e, j) === 'present').length
      const montant = jours.reduce((acc, j) => acc + getMontantJournee(e, j, data.config), 0)
      return { session: s, presents, montant }
    })

    const pieData = [
      { name: 'Présent', value: joursPresentsSession || 0 },
      { name: 'Absent',  value: joursAbsentsSession  || 0 },
    ]

    const courbeData = journeesSession.map((j, idx) => ({
      date: j.date.slice(5),
      montant: journeesSession.slice(0, idx + 1).reduce((acc, jj) => acc + getMontantJournee(e, jj, data.config), 0)
    }))

    const saveSortie = () => {
      const updated = {
        ...data,
        employes: data.employes.map(emp => emp.id === e.id
          ? { ...emp, dateSortie: sortieDate || undefined }
          : emp)
      }
      setData(updated); saveData(updated)
      setSelected(updated.employes.find(emp => emp.id === e.id) || null)
      setShowSortieInput(false)
      toast(sortieDate ? `Date de sortie enregistrée` : 'Date de sortie supprimée', 'success')
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Header profil */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 50, height: 50, borderRadius: 12,
                background: e.genre === 'H' ? 'linear-gradient(135deg, #1a3522, #3db06a)' : 'linear-gradient(135deg, #1a3522, #52d485)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: 'white', fontWeight: 700, fontFamily: 'Playfair Display, serif'
              }}>{e.prenom[0]}{e.nom[0]}</div>
              <div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 19, color: 'var(--white)' }}>{e.prenom} {e.nom}</div>
                <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>
                  {e.genre === 'H' ? 'Homme' : 'Femme'} · {formatFCFA(taux)}/jour
                  {e.tauxIndividuel && <span style={{ color: 'var(--gold)', marginLeft: 6 }}>★ individuel</span>}
                </div>
                <div style={{ fontSize: 11, marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--green)' }}>↓ Entrée : {formatDate(e.dateAjout)}</span>
                  {e.dateSortie && <span style={{ color: 'var(--red-bright)' }}>↑ Sortie : {formatDate(e.dateSortie)}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button onClick={() => ouvrirEdit(e)} style={{ background: 'var(--green-muted)', border: '1px solid rgba(61,176,106,0.3)', color: 'var(--green)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>✏ Modifier</button>
              <button onClick={() => setShowSortieInput(!showSortieInput)} style={{ background: e.dateSortie ? 'var(--red-muted)' : 'var(--forest-mid)', border: `1px solid ${e.dateSortie ? 'var(--red-border)' : 'rgba(255,255,255,0.08)'}`, color: e.dateSortie ? 'var(--red-bright)' : 'var(--gray)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
                {e.dateSortie ? '↑ Sortie définie' : '↑ Marquer sortie'}
              </button>
              <button onClick={() => deleteEmploye(e.id)} style={{ background: 'var(--red-muted)', border: '1px solid var(--red-border)', color: 'var(--red-bright)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>Supprimer</button>
            </div>
          </div>

          {/* Sortie date input */}
          {showSortieInput && (
            <div className="fade-in" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Date de sortie (laisser vide pour annuler)</label>
                <input type="date" value={sortieDate} onChange={e2 => setSortieDate(e2.target.value)} style={{ width: '100%', padding: '9px 12px', fontSize: 13 }} />
              </div>
              <button className="btn-primary ripple" onClick={saveSortie} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13 }}>Enregistrer</button>
              <button className="btn-ghost" onClick={() => setShowSortieInput(false)} style={{ padding: '9px 12px', borderRadius: 8, fontSize: 13 }}>✕</button>
            </div>
          )}
        </div>

        {/* KPIs globaux */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Jours présents (total)', value: joursPresentsTotal, color: 'var(--green)', stripe: 'stripe-green' },
            { label: 'Sessions', value: data.sessions.length, color: 'var(--white)', stripe: 'stripe-white' },
            { label: 'Montant total', value: formatFCFA(montantTotal), color: 'var(--red-bright)', stripe: 'stripe-red', small: true },
          ].map((s, i) => (
            <div key={i} className={`card ${s.stripe}`} style={{ padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: s.small ? 13 : 22, fontFamily: 'Playfair Display, serif', color: s.color, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Récap par session */}
        {data.sessions.length > 0 && (
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Récapitulatif par session</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {statsParSession.map(({ session: s, presents, montant: m }) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: 8, background: 'var(--forest-mid)', border: !s.fermee ? '1px solid rgba(61,176,106,0.2)' : '1px solid transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--cream)', fontWeight: 500 }}>Session {s.numero}</span>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: s.fermee ? 'rgba(255,255,255,0.06)' : 'rgba(61,176,106,0.15)', color: s.fermee ? 'var(--gray-dim)' : 'var(--green)', fontWeight: 600 }}>
                      {s.fermee ? 'fermée' : 'en cours'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--gray)' }}>{presents} j. présent</span>
                    <span style={{ fontSize: 14, color: 'var(--red-bright)', fontWeight: 700, fontFamily: 'Playfair Display, serif' }}>{formatFCFA(m)}</span>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, padding: '9px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--gray)' }}>TOTAL</span>
                <span style={{ fontSize: 16, color: 'var(--red-bright)', fontWeight: 700, fontFamily: 'Playfair Display, serif' }}>{formatFCFA(montantTotal)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation sessions */}
        {data.sessions.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {data.sessions.map(s => {
              const active = sessionVue ? sessionVue === s.id : !s.fermee
              return (
                <button key={s.id} onClick={() => setSessionVue(s.fermee ? s.id : null)} style={{
                  padding: '5px 14px', borderRadius: 16, cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600,
                  background: active ? 'var(--red)' : 'var(--forest-mid)',
                  color: active ? 'white' : 'var(--gray)',
                  border: active ? 'none' : '1px solid rgba(255,255,255,0.07)',
                  transition: 'all 0.15s'
                }}>Session {s.numero} {s.fermee ? '✓' : '●'}</button>
              )
            })}
          </div>
        )}

        {/* Graphiques */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--gray-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Présence · S{sessionAffichee?.numero}</div>
            {journeesSession.length === 0 ? (
              <div style={{ color: 'var(--gray-dim)', fontSize: 12, padding: '16px 0' }}>Aucune journée</div>
            ) : (
              <>
                <PieChart width={120} height={120}>
                  <Pie data={pieData} cx={55} cy={55} innerRadius={38} outerRadius={56} dataKey="value" strokeWidth={0}>
                    <Cell fill="#3db06a" />
                    <Cell fill="#E8312A" fillOpacity={0.7} />
                  </Pie>
                </PieChart>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                  <span style={{ color: '#3db06a' }}>● {joursPresentsSession} présent(s)</span>
                  <span style={{ color: '#ff4d45' }}>● {joursAbsentsSession} absent(s)</span>
                  {joursNASession > 0 && <span style={{ color: 'var(--gray-dim)' }}>● {joursNASession} N/A</span>}
                </div>
                <div style={{ marginTop: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--red-bright)', fontWeight: 700, fontFamily: 'Playfair Display, serif' }}>{formatFCFA(montantSession)}</div>
                  <div style={{ fontSize: 10, color: 'var(--gray-dim)', marginTop: 2 }}>cette session</div>
                </div>
              </>
            )}
          </div>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: 11, color: 'var(--gray-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Paiement cumulé · S{sessionAffichee?.numero}</div>
            {courbeData.length === 0 ? (
              <div style={{ color: 'var(--gray-dim)', fontSize: 12 }}>Aucune donnée</div>
            ) : (
              <ResponsiveContainer width="100%" height={110}>
                <LineChart data={courbeData}>
                  <XAxis dataKey="date" tick={{ fill: 'rgba(240,237,232,0.35)', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: 'var(--forest)', border: '1px solid rgba(232,49,42,0.2)', borderRadius: 8, color: 'var(--cream)', fontSize: 11 }}
                    formatter={(v: unknown) => [formatFCFA(Number(v)), 'Cumulé']}
                  />
                  <Line type="monotone" dataKey="montant" stroke="#3db06a" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Historique présences */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: 11, color: 'var(--gray-dim)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Présence jour par jour · Session {sessionAffichee?.numero}</div>
          {journeesSession.length === 0 ? (
            <p style={{ color: 'var(--gray-dim)', fontSize: 13 }}>Aucune journée dans cette session</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...journeesSession].reverse().map(j => {
                const statut = getStatutEmployeJournee(e, j)
                const sessionFermee = sessionAffichee?.fermee
                const bonus = j.bonusJour || 0
                return (
                  <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--forest-mid)', opacity: statut === 'na' ? 0.5 : 1 }}>
                    <div>
                      <span style={{ fontSize: 13, color: 'var(--cream)' }}>{formatDate(j.date)}</span>
                      {bonus > 0 && statut === 'present' && (
                        <span style={{ fontSize: 10, color: 'var(--gold)', marginLeft: 8 }}>+{formatFCFA(bonus)}</span>
                      )}
                    </div>
                    {statut === 'na' ? (
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: 'var(--gray-dim)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        N/A
                      </span>
                    ) : sessionFermee ? (
                      <span className={statut === 'absent' ? 'tag-absent' : 'tag-present'} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                        {statut === 'absent' ? '✕ Absent' : '✓ Présent'}
                      </span>
                    ) : (
                      <button onClick={() => togglePresence(e.id, j.id)} className={statut === 'absent' ? 'tag-absent' : 'tag-present'}
                        style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                        {statut === 'absent' ? '✕ Absent' : '✓ Présent'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }


  const filteredEmployes = data.employes.filter(e =>
    `${e.prenom} ${e.nom}`.toLowerCase().includes(search.toLowerCase())
  )

  const hommes = data.employes.filter(e => e.genre === 'H')
  const femmes = data.employes.filter(e => e.genre === 'F')
  const sortedJournees = [...data.journees].sort((a, b) => a.date.localeCompare(b.date))
  const presencesH = sortedJournees.reduce((acc, j) => acc + hommes.filter(e => getStatutEmployeJournee(e, j) === 'present').length, 0)
  const presencesF = sortedJournees.reduce((acc, j) => acc + femmes.filter(e => getStatutEmployeJournee(e, j) === 'present').length, 0)
  const courbeGenerale = sortedJournees.map(j => ({
    date: j.date.slice(5),
    fullDate: j.date,
    Hommes: hommes.filter(e => getStatutEmployeJournee(e, j) === 'present').length,
    Femmes: femmes.filter(e => getStatutEmployeJournee(e, j) === 'present').length,
  }))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--forest-deep)' }}>
      <Navbar />
      <PageWrapper>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        {/* Statistiques générales */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: 'var(--white)', marginBottom: 14 }}>Statistiques générales</h2>

          {/* KPIs effectifs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
            {[
              { label: 'Total employés', value: data.employes.length, color: 'var(--white)', stripe: 'stripe-white' },
              { label: 'Hommes', value: hommes.length, color: '#3db06a', stripe: 'stripe-green' },
              { label: 'Femmes', value: femmes.length, color: '#52d485', stripe: 'stripe-green' },
              { label: 'Journées', value: data.journees.length, color: 'var(--gold)', stripe: 'stripe-white' },
            ].map((s, i) => (
              <div key={i} className={`card ${s.stripe}`} style={{ padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontFamily: 'Playfair Display, serif', color: s.color, fontWeight: 700 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* KPIs présences */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
            {[
              { label: 'Présences hommes', value: presencesH, color: '#3db06a' },
              { label: 'Présences femmes', value: presencesF, color: '#52d485' },
              { label: 'Total présences', value: presencesH + presencesF, color: 'var(--red-bright)' },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontFamily: 'Playfair Display, serif', color: s.color, fontWeight: 700 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Courbe présences H vs F */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: 11, color: 'var(--gray-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Présences par jour — Hommes vs Femmes</div>
            <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.3)', marginBottom: 10 }}>Cliquez sur un point pour voir le détail du jour</div>
            {courbeGenerale.length === 0 ? (
              <div style={{ color: 'var(--gray-dim)', fontSize: 12, padding: '16px 0' }}>Aucune journée enregistrée</div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart
                  data={courbeGenerale}
                  onClick={(chartData: unknown) => {
                    const d = chartData as { activePayload?: { payload: { fullDate: string } }[] }
                    if (d?.activePayload?.[0]) {
                      const fd = d.activePayload[0].payload.fullDate
                      setJourClique(prev => prev === fd ? null : fd)
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <XAxis dataKey="date" tick={{ fill: 'rgba(240,237,232,0.35)', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: 'var(--forest)', border: '1px solid rgba(61,176,106,0.2)', borderRadius: 8, color: 'var(--cream)', fontSize: 11 }}
                  />
                  <Line type="monotone" dataKey="Hommes" stroke="#3db06a" strokeWidth={2.5} dot={{ r: 3, fill: '#3db06a' }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="Femmes" stroke="#52d485" strokeWidth={2.5} dot={{ r: 3, fill: '#52d485' }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            )}
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11 }}>
              <span style={{ color: '#3db06a' }}>— Hommes</span>
              <span style={{ color: '#52d485' }}>– – Femmes</span>
            </div>

            {/* Panel détail jour cliqué */}
            {jourClique && (() => {
              const journee = sortedJournees.find(j => j.date === jourClique)
              if (!journee) return null
              const actifs = data.employes.filter(e => getStatutEmployeJournee(e, journee) !== 'na')
              const presentsH = actifs.filter(e => e.genre === 'H' && getStatutEmployeJournee(e, journee) === 'present')
              const presentsF = actifs.filter(e => e.genre === 'F' && getStatutEmployeJournee(e, journee) === 'present')
              const absentsJ  = actifs.filter(e => getStatutEmployeJournee(e, journee) === 'absent')
              return (
                <div className="fade-in" style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: 'var(--white)', fontWeight: 600 }}>📅 {formatDate(jourClique)}</span>
                    <span style={{ fontSize: 12, color: 'var(--green)' }}>{presentsH.length + presentsF.length} / {actifs.length} présents</span>
                    <button onClick={() => setJourClique(null)} style={{ background: 'transparent', border: 'none', color: 'var(--gray-dim)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#3db06a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>♂ Hommes présents ({presentsH.length})</div>
                      {presentsH.map(e => (
                        <div key={e.id} style={{ fontSize: 12, color: 'var(--cream)', padding: '3px 0' }}>✓ {e.prenom} {e.nom}</div>
                      ))}
                      <div style={{ fontSize: 10, color: '#52d485', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 8, marginBottom: 6 }}>♀ Femmes présentes ({presentsF.length})</div>
                      {presentsF.map(e => (
                        <div key={e.id} style={{ fontSize: 12, color: 'var(--cream)', padding: '3px 0' }}>✓ {e.prenom} {e.nom}</div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Absents ({absentsJ.length})</div>
                      {absentsJ.map(e => (
                        <div key={e.id} style={{ fontSize: 12, color: 'var(--gray-dim)', padding: '3px 0' }}>✕ {e.prenom} {e.nom}</div>
                      ))}
                      {absentsJ.length === 0 && <div style={{ fontSize: 12, color: 'var(--gray-dim)' }}>Aucun absent 🎉</div>}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selected ? '300px 1fr' : '1fr', gap: 22 }}>
        {/* Liste */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, color: 'var(--white)' }}>Employés</h1>
            <button className="btn-primary ripple" onClick={() => setShowAdd(true)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13 }}>+ Ajouter</button>
          </div>

          {/* Barre de recherche */}
          {data.employes.length > 0 && (
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--gray-dim)' }}>🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un employé..."
                style={{ width: '100%', padding: '10px 14px 10px 36px', fontSize: 13 }}
              />
            </div>
          )}

          {data.employes.length === 0 ? (
            <div className="card" style={{ padding: 30, textAlign: 'center', color: 'rgba(245,240,232,0.3)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👷</div>
              <p style={{ fontSize: 13 }}>Aucun employé. Ajoutez le premier.</p>
            </div>
          ) : filteredEmployes.length === 0 ? (
            <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--gray-dim)', fontSize: 13 }}>
              Aucun résultat pour &quot;{search}&quot;
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredEmployes.map((e, i) => {
                const joursP = data.journees.filter(j => getStatutEmployeJournee(e, j) === 'present').length
                const montant = getMontantTotal(e, data.journees, data.config)
                const isActive = selected?.id === e.id
                return (
                  <div key={e.id} onClick={() => setSelected(isActive ? null : e)}
                    className="card card-clickable stagger-item"
                    style={{
                      padding: '14px 16px', cursor: 'pointer',
                      animationDelay: `${i * 0.06}s`,
                      borderColor: isActive ? 'var(--red)' : undefined,
                      background: isActive ? 'var(--forest-mid)' : undefined,
                      boxShadow: isActive ? '0 0 0 1px var(--red)' : undefined
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10,
                          background: e.genre === 'H'
                            ? 'linear-gradient(135deg, #1a3522, #3db06a)'
                            : 'linear-gradient(135deg, #1a3522, #52d485)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, color: 'white', fontWeight: 700,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                        }}>{e.prenom[0]}{e.nom[0]}</div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--white)', fontSize: 13 }}>{e.prenom} {e.nom}</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-dim)' }}>
                            {e.genre === 'H' ? '♂' : '♀'} · {joursP}j présent · embauché le {formatDate(e.dateEmbauche || e.dateAjout)}
                          </div>
                        </div>
                      </div>
                      <div style={{ color: 'var(--red-bright)', fontSize: 12, fontWeight: 700 }}>{formatFCFA(montant)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Profil */}
        {selected && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: 'var(--white)' }}>Profil</h2>
              <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(245,240,232,0.5)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>✕ Fermer</button>
            </div>
            <ProfileView e={selected} />
          </div>
        )}
        </div>
      </main>
      </PageWrapper>
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ padding: 30, width: 390 }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 21, marginBottom: 22, color: 'var(--white)' }}>Ajouter un employé</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 22 }}>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(245,240,232,0.55)', display: 'block', marginBottom: 5 }}>Prénom</label>
                <input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Mamadou" style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(245,240,232,0.55)', display: 'block', marginBottom: 5 }}>Nom</label>
                <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Diallo" style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(245,240,232,0.55)', display: 'block', marginBottom: 5 }}>Genre</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['H', 'F'] as const).map(g => (
                    <button key={g} onClick={() => setGenre(g)} style={{
                      flex: 1, padding: '9px', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 13,
                      background: genre === g ? 'var(--green)' : 'var(--forest-mid)',
                      color: genre === g ? 'var(--forest-deep)' : 'var(--cream)',
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}>{g === 'H' ? '♂ Homme' : '♀ Femme'}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '9px 16px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--cream)', fontFamily: 'DM Sans, sans-serif' }}>Annuler</button>
              <button className="btn-primary" onClick={addEmploye} style={{ padding: '9px 18px', borderRadius: 8 }}>Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modifier profil avec PIN */}
      {showEditModal && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ padding: 30, width: 420 }}>
            {!pinValide ? (
              <>
                <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 21, marginBottom: 8, color: 'var(--white)' }}>Code PIN requis</h3>
                <p style={{ fontSize: 13, color: 'rgba(245,240,232,0.45)', marginBottom: 22 }}>Entrez le code à 4 chiffres pour modifier ce profil.</p>
                <div style={{ marginBottom: 20 }}>
                  <input
                    type="password" maxLength={4} value={pinInput}
                    onChange={e => { setPinInput(e.target.value.replace(/\D/g,'')); setPinErreur(false) }}
                    onKeyDown={e => e.key === 'Enter' && validerPin()}
                    placeholder="••••"
                    style={{ width: '100%', padding: '14px', fontSize: 24, textAlign: 'center', letterSpacing: '0.4em' }}
                  />
                  {pinErreur && <p style={{ color: 'var(--red-bright)', fontSize: 12, marginTop: 8, textAlign: 'center' }}>Code incorrect. Réessayez.</p>}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowEditModal(false)} style={{ padding: '9px 16px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--cream)', fontFamily: 'DM Sans, sans-serif' }}>Annuler</button>
                  <button className="btn-primary" onClick={validerPin} style={{ padding: '9px 18px', borderRadius: 8 }}>Valider</button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 21, marginBottom: 22, color: 'var(--white)' }}>Modifier le profil</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 22 }}>
                  <div>
                    <label style={{ fontSize: 12, color: 'rgba(245,240,232,0.55)', display: 'block', marginBottom: 5 }}>Prénom</label>
                    <input value={editPrenom} onChange={e => setEditPrenom(e.target.value)} style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'rgba(245,240,232,0.55)', display: 'block', marginBottom: 5 }}>Nom</label>
                    <input value={editNom} onChange={e => setEditNom(e.target.value)} style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'rgba(245,240,232,0.55)', display: 'block', marginBottom: 5 }}>Genre</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['H', 'F'] as const).map(g => (
                        <button key={g} onClick={() => setEditGenre(g)} style={{
                          flex: 1, padding: '9px', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 13,
                          background: editGenre === g ? 'var(--green)' : 'var(--forest-mid)',
                          color: editGenre === g ? 'var(--forest-deep)' : 'var(--cream)',
                          border: '1px solid rgba(255,255,255,0.08)'
                        }}>{g === 'H' ? '♂ Homme' : '♀ Femme'}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'rgba(245,240,232,0.55)', display: 'block', marginBottom: 5 }}>
                      Taux individuel (FCFA/jour) <span style={{ color: 'rgba(245,240,232,0.3)' }}>— optionnel, remplace le taux général</span>
                    </label>
                    <input
                      type="number" value={editTaux}
                      onChange={e => setEditTaux(e.target.value)}
                      placeholder={`Taux général : ${formatFCFA(editGenre === 'H' ? data.config.tauxHomme : data.config.tauxFemme)}`}
                      style={{ width: '100%', padding: '10px 14px', fontSize: 14 }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowEditModal(false)} style={{ padding: '9px 16px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--cream)', fontFamily: 'DM Sans, sans-serif' }}>Annuler</button>
                  <button className="btn-primary" onClick={sauvegarderEdit} style={{ padding: '9px 18px', borderRadius: 8 }}>Sauvegarder</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
