'use client'
import { useEffect, useState } from 'react'
import {
  loadData, AppData, formatDate, formatFCFA,
  getTauxForEmploye, getStatutEmployeJournee, getMontantJournee,
  getJourneesSession
} from '@/lib/store'

export default function RapportEmployesPage() {
  const [data, setData] = useState<AppData | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    const d = loadData()
    setData(d)
    const params = new URLSearchParams(window.location.search)
    const sid = params.get('session')
    setSessionId(sid)
    import('@/lib/syncFromSupabase').then(({ syncFromSupabase }) => {
      syncFromSupabase(remote => setData(remote))
    })
  }, [])

  if (!data) return null

  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const session = sessionId
    ? data.sessions.find(s => s.id === sessionId)
    : data.sessions.find(s => !s.fermee) || data.sessions[data.sessions.length - 1]

  const journees = session
    ? getJourneesSession(session.id, data.journees).sort((a, b) => a.date.localeCompare(b.date))
    : [...data.journees].sort((a, b) => a.date.localeCompare(b.date))

  const employes = data.employes

  const totalPaie = employes.reduce((acc, e) =>
    acc + journees.reduce((a, j) => a + getMontantJournee(e, j, data.config), 0), 0)

  const styles = {
    page: { background: 'white', minHeight: '100vh', fontFamily: 'Georgia, serif', color: '#1a1a1a' } as React.CSSProperties,
    inner: { maxWidth: 860, margin: '0 auto', padding: '36px 40px 60px' } as React.CSSProperties,
    header: { borderBottom: '3px solid #1a5c2e', paddingBottom: 18, marginBottom: 26 } as React.CSSProperties,
    sectionTitle: { fontSize: 13, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#1a5c2e', borderBottom: '1px solid #e0e0e0', paddingBottom: 6, marginBottom: 14, marginTop: 28 },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 },
    th: { background: '#1a5c2e', color: 'white', padding: '8px 10px', textAlign: 'left' as const, fontWeight: 600, fontSize: 11 },
    td: { padding: '7px 10px', borderBottom: '1px solid #f0f0f0', fontSize: 12 },
    tdCenter: { padding: '7px 10px', borderBottom: '1px solid #f0f0f0', fontSize: 12, textAlign: 'center' as const },
    tdRight: { padding: '7px 10px', borderBottom: '1px solid #f0f0f0', fontSize: 12, textAlign: 'right' as const },
    totalRow: { background: '#f5f9f6', fontWeight: 700 },
  }

  return (
    <div style={styles.page}>
      <div style={styles.inner}>

        {/* Boutons impression */}
        <div className="no-print" style={{ marginBottom: 24, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => window.print()} style={{
            padding: '10px 22px', borderRadius: 8, background: '#1a5c2e', color: 'white',
            border: 'none', cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 700, fontSize: 14
          }}>🖨 Imprimer / PDF</button>
          <button onClick={() => window.close()} style={{
            padding: '10px 18px', borderRadius: 8, background: '#f0f0f0',
            border: 'none', cursor: 'pointer', fontFamily: 'sans-serif', fontSize: 13
          }}>← Retour</button>
          <span style={{ fontSize: 12, color: '#888', fontFamily: 'sans-serif', marginLeft: 8 }}>
            Rapport journalier — <strong style={{ color: '#1a5c2e' }}>Session {session?.numero}</strong>
          </span>
        </div>

        {/* En-tête */}
        <div style={styles.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a5c2e' }}>IBL Primeurs</div>
              <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>Campagne Mangue — Rapport journalier employés</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: '#555' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>SESSION {session?.numero}</div>
              <div style={{ marginTop: 3 }}>Généré le {today}</div>
            </div>
          </div>
          {session && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#555' }}>
              Du {formatDate(session.dateDebut)}{session.dateFin ? ` au ${formatDate(session.dateFin)}` : ' — en cours'}
              {' · '}{journees.length} journée(s) · {employes.length} employé(s)
            </div>
          )}
        </div>

        {/* ═══ FEUILLE D'APPEL PAR JOURNÉE ═══ */}
        {journees.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic', fontSize: 13 }}>Aucune journée enregistrée pour cette session.</p>
        ) : (
          journees.map((j, idx) => {
            const actifs = employes.filter(e => getStatutEmployeJournee(e, j) !== 'na')
            const presents = actifs.filter(e => getStatutEmployeJournee(e, j) === 'present')
            const absents = actifs.filter(e => getStatutEmployeJournee(e, j) === 'absent')
            const presentsH = presents.filter(e => e.genre === 'H')
            const presentsF = presents.filter(e => e.genre === 'F')
            const montantJour = actifs.reduce((acc, e) => acc + getMontantJournee(e, j, data.config), 0)

            return (
              <div key={j.id} style={{ marginBottom: 32, pageBreakInside: 'avoid' }}>
                {/* Titre journée */}
                <div style={{
                  background: '#1a5c2e', color: 'white', padding: '10px 16px', borderRadius: '8px 8px 0 0',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>
                    Journée {idx + 1} — {formatDate(j.date)}
                  </span>
                  <span style={{ fontSize: 12, opacity: 0.85 }}>
                    {presents.length} présents · {absents.length} absents
                  </span>
                </div>

                {/* Résumé */}
                <div style={{
                  background: '#f5f9f6', border: '1px solid #d0e8d8', borderTop: 'none',
                  padding: '10px 16px', display: 'flex', gap: 28, flexWrap: 'wrap',
                  marginBottom: 8
                }}>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: '#555' }}>Hommes présents : </span>
                    <strong style={{ color: '#1a5c2e' }}>{presentsH.length}</strong>
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: '#555' }}>Femmes présentes : </span>
                    <strong style={{ color: '#1a5c2e' }}>{presentsF.length}</strong>
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: '#555' }}>Total actifs : </span>
                    <strong>{actifs.length}</strong>
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: '#555' }}>Montant journée : </span>
                    <strong style={{ color: '#c0392b' }}>{formatFCFA(montantJour)}</strong>
                  </div>
                  {j.bonusJour && j.bonusJour > 0 && (
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: '#555' }}>Bonus : </span>
                      <strong style={{ color: '#e67e22' }}>+{formatFCFA(j.bonusJour)} / personne</strong>
                    </div>
                  )}
                </div>

                {/* Tableau présents — séparé H / F */}
                {(['H', 'F'] as const).map(genre => {
                  const actifsGenre = actifs.filter(e => e.genre === genre)
                  if (actifsGenre.length === 0) return null
                  const montantGenre = actifsGenre.reduce((acc, e) => acc + getMontantJournee(e, j, data.config), 0)
                  const presentsGenre = actifsGenre.filter(e => getStatutEmployeJournee(e, j) === 'present')
                  return (
                    <div key={genre} style={{ marginBottom: 10 }}>
                      <div style={{ background: genre === 'H' ? '#1a3a5c' : '#5c1a3a', color: 'white', padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>
                        {genre === 'H' ? '👨 HOMMES' : '👩 FEMMES'} — {presentsGenre.length} présent(s) / {actifsGenre.length}
                      </div>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={{ ...styles.th, width: '5%', background: genre === 'H' ? '#1a3a5c' : '#5c1a3a' }}>N°</th>
                            <th style={{ ...styles.th, background: genre === 'H' ? '#1a3a5c' : '#5c1a3a' }}>Nom & Prénom</th>
                            <th style={{ ...styles.th, textAlign: 'right', background: genre === 'H' ? '#1a3a5c' : '#5c1a3a' }}>Taux/jour</th>
                            <th style={{ ...styles.th, textAlign: 'right', background: genre === 'H' ? '#1a3a5c' : '#5c1a3a' }}>Montant</th>
                            <th style={{ ...styles.th, textAlign: 'center', width: '120px', background: genre === 'H' ? '#1a3a5c' : '#5c1a3a' }}>Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {actifsGenre.map((e, i) => {
                            const statut = getStatutEmployeJournee(e, j)
                            const present = statut === 'present'
                            const taux = getTauxForEmploye(e, data.config)
                            const montant = getMontantJournee(e, j, data.config)
                            return (
                              <tr key={e.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                                <td style={{ ...styles.td, color: '#888' }}>{i + 1}</td>
                                <td style={{ ...styles.td, fontWeight: 600 }}>{e.prenom} {e.nom}</td>
                                <td style={styles.tdRight}>{formatFCFA(taux)}</td>
                                <td style={{ ...styles.tdRight, color: present ? '#1a5c2e' : '#aaa', fontWeight: present ? 700 : 400 }}>
                                  {present ? formatFCFA(montant) : '—'}
                                </td>
                                <td style={{ ...styles.tdCenter }}>
                                  {present
                                    ? <span style={{ background: '#e8f5ec', color: '#1a5c2e', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>PRÉSENT</span>
                                    : <span style={{ background: '#fdecea', color: '#c0392b', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>ABSENT</span>
                                  }
                                </td>
                              </tr>
                            )
                          })}
                          <tr style={styles.totalRow}>
                            <td style={styles.td} colSpan={2}><strong>Sous-total {genre === 'H' ? 'Hommes' : 'Femmes'}</strong></td>
                            <td style={styles.td} />
                            <td style={{ ...styles.tdRight, color: '#c0392b' }}><strong>{formatFCFA(montantGenre)}</strong></td>
                            <td style={{ ...styles.tdCenter, color: '#1a5c2e' }}><strong>{presentsGenre.length} / {actifsGenre.length}</strong></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )
                })}
                {/* Total journée global */}
                <table style={{ ...styles.table, marginTop: 4 }}>
                  <tbody>
                    <tr style={{ background: '#e8f0e8', fontWeight: 700 }}>
                      <td style={{ ...styles.td, width: '5%' }} />
                      <td style={{ ...styles.td }}><strong>TOTAL JOURNÉE</strong></td>
                      <td style={styles.td} />
                      <td style={{ ...styles.tdRight, color: '#c0392b' }}><strong>{formatFCFA(montantJour)}</strong></td>
                      <td style={{ ...styles.tdCenter, color: '#1a5c2e' }}><strong>{presents.length} / {actifs.length}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          })
        )}

        {/* ═══ RÉCAP SESSION ═══ */}
        {journees.length > 0 && (
          <>
            <div style={styles.sectionTitle}>Récapitulatif session {session?.numero}</div>
            {(['H', 'F'] as const).map(genre => {
              // Seulement les présents (au moins 1 journée présent)
              const empGenre = employes.filter(e =>
                e.genre === genre &&
                journees.some(j => getStatutEmployeJournee(e, j) === 'present')
              )
              if (empGenre.length === 0) return null
              const totalGenre = empGenre.reduce((acc, e) => acc + journees.reduce((a, j) => a + getMontantJournee(e, j, data.config), 0), 0)
              const totalJoursGenre = empGenre.reduce((acc, e) => acc + journees.filter(j => getStatutEmployeJournee(e, j) === 'present').length, 0)
              return (
                <div key={genre} style={{ marginBottom: 18 }}>
                  <div style={{ background: genre === 'H' ? '#1a3a5c' : '#5c1a3a', color: 'white', padding: '7px 14px', fontSize: 12, fontWeight: 700, marginBottom: 0 }}>
                    {genre === 'H' ? '👨 HOMMES' : '👩 FEMMES'} — {empGenre.length} présent(s)
                  </div>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, width: '5%', background: genre === 'H' ? '#1a3a5c' : '#5c1a3a' }}>N°</th>
                        <th style={{ ...styles.th, background: genre === 'H' ? '#1a3a5c' : '#5c1a3a' }}>Nom & Prénom</th>
                        <th style={{ ...styles.th, textAlign: 'right', background: genre === 'H' ? '#1a3a5c' : '#5c1a3a' }}>Taux/jour</th>
                        <th style={{ ...styles.th, textAlign: 'right', background: genre === 'H' ? '#1a3a5c' : '#5c1a3a' }}>Jours présents</th>
                        <th style={{ ...styles.th, textAlign: 'right', background: genre === 'H' ? '#1a3a5c' : '#5c1a3a' }}>Total à payer</th>
                        <th style={{ ...styles.th, textAlign: 'center', minWidth: 100, background: genre === 'H' ? '#1a3a5c' : '#5c1a3a' }}>Signature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empGenre.map((e, idx) => {
                        const taux = getTauxForEmploye(e, data.config)
                        const joursP = journees.filter(j => getStatutEmployeJournee(e, j) === 'present').length
                        const montant = journees.reduce((acc, j) => acc + getMontantJournee(e, j, data.config), 0)
                        return (
                          <tr key={e.id} style={{ background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                            <td style={{ ...styles.td, color: '#888' }}>{idx + 1}</td>
                            <td style={{ ...styles.td, fontWeight: 600 }}>{e.prenom} {e.nom}</td>
                            <td style={styles.tdRight}>{formatFCFA(taux)}</td>
                            <td style={{ ...styles.tdRight, fontWeight: 700 }}>{joursP}</td>
                            <td style={{ ...styles.tdRight, color: '#1a5c2e', fontWeight: 700 }}>{formatFCFA(montant)}</td>
                            <td style={{ ...styles.td, textAlign: 'center' }}>
                              <div style={{ borderBottom: '1px solid #999', height: 28, width: '80%', margin: '0 auto' }} />
                            </td>
                          </tr>
                        )
                      })}
                      <tr style={styles.totalRow}>
                        <td style={styles.td} colSpan={3}><strong>Sous-total {genre === 'H' ? 'Hommes' : 'Femmes'}</strong></td>
                        <td style={{ ...styles.tdRight }}><strong>{totalJoursGenre}</strong></td>
                        <td style={{ ...styles.tdRight, color: '#c0392b' }}><strong>{formatFCFA(totalGenre)}</strong></td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )
            })}
            {/* Total général */}
            <table style={styles.table}>
              <tbody>
                <tr style={{ background: '#e8f0e8', fontWeight: 700 }}>
                  <td style={styles.td} colSpan={3}><strong>TOTAL GÉNÉRAL</strong></td>
                  <td style={{ ...styles.tdRight }}>
                    <strong>{journees.reduce((acc, j) => acc + employes.filter(e => getStatutEmployeJournee(e, j) === 'present').length, 0)}</strong>
                  </td>
                  <td style={{ ...styles.tdRight, color: '#c0392b' }}><strong>{formatFCFA(totalPaie)}</strong></td>
                  <td />
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* Pied de page */}
        <div style={{ marginTop: 40, borderTop: '1px solid #e0e0e0', paddingTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888' }}>
          <span>IBL Primeurs — Rapport journalier employés</span>
          <span>Généré le {today}</span>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 12mm; }
        }
      `}</style>
    </div>
  )
}
