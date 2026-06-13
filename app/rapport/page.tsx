'use client'
import { useEffect, useState } from 'react'
import {
  loadData, AppData, formatDate, formatFCFA,
  getTauxForEmploye, getStatutEmployeJournee, getMontantJournee,
  getJourneesSession, getJourneesCamion, getDepensesCamion,
  getMontantDepense, getStatsProduction
} from '@/lib/store'

export default function RapportPage() {
  const [data, setData] = useState<AppData | null>(null)
  const [mode, setMode] = useState<'session' | 'camion' | 'global'>('global')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [camionId, setCamionId] = useState<string | null>(null)

  useEffect(() => {
    const d = loadData()
    setData(d)
    const params = new URLSearchParams(window.location.search)
    const sid = params.get('session')
    const cid = params.get('camion')
    const m = params.get('mode') as 'session' | 'camion' | 'global' | null
    if (sid) { setSessionId(sid); setMode('session') }
    if (cid) { setCamionId(cid); setMode('camion') }
    if (m) setMode(m)
    // Sync depuis Supabase
    import('@/lib/syncFromSupabase').then(({ syncFromSupabase }) => {
      syncFromSupabase(remote => setData(remote))
    })
  }, [])

  if (!data) return null

  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  // ─── DONNÉES SESSION ───
  const session = sessionId
    ? data.sessions.find(s => s.id === sessionId)
    : (mode === 'session' ? data.sessions.find(s => !s.fermee) : null)

  const journeesRH = session
    ? getJourneesSession(session.id, data.journees).sort((a, b) => a.date.localeCompare(b.date))
    : (mode === 'global' ? [...data.journees].sort((a, b) => a.date.localeCompare(b.date)) : [])

  const employes = data.employes

  const getTotalEmploye = (eId: string) => {
    const e = employes.find(x => x.id === eId)
    if (!e) return 0
    return journeesRH.reduce((acc, j) => acc + getMontantJournee(e, j, data.config), 0)
  }

  const totalPaie = employes.reduce((acc, e) =>
    acc + journeesRH.reduce((a, j) => a + getMontantJournee(e, j, data.config), 0), 0)

  const totalJoursPresents = (eId: string) =>
    journeesRH.filter(j => {
      const e = employes.find(x => x.id === eId)
      if (!e) return false
      return getStatutEmployeJournee(e, j) === 'present'
    }).length

  // ─── DONNÉES CAMION ───
  const camion = camionId
    ? data.camions.find(c => c.id === camionId)
    : (mode === 'camion' ? data.camions.find(c => c.statut !== 'cloture') || data.camions[data.camions.length - 1] : null)

  const journeesProd = camion
    ? getJourneesCamion(camion.id, data).sort((a, b) => a.date.localeCompare(b.date))
    : (mode === 'global' ? [...data.journeesProduction].sort((a, b) => a.date.localeCompare(b.date)) : [])

  const depenses = camion
    ? getDepensesCamion(camion.id, data)
    : (mode === 'global' ? data.depenses : [])

  const statsProd = getStatsProduction(journeesProd)
  const totalDepenses = depenses.reduce((a, d) => a + getMontantDepense(d), 0)

  // ─── BILAN GLOBAL ───
  const allCamions = data.camions
  const statsGlobal = getStatsProduction(data.journeesProduction)
  const totalDepensesGlobal = data.depenses.reduce((a, d) => a + getMontantDepense(d), 0)
  const totalPaieGlobal = employes.reduce((acc, e) =>
    acc + data.journees.reduce((a, j) => a + getMontantJournee(e, j, data.config), 0), 0)
  const coutTotal = totalDepensesGlobal + totalPaieGlobal

  const styles = {
    page: { background: 'white', minHeight: '100vh', fontFamily: 'Georgia, serif', color: '#1a1a1a' } as React.CSSProperties,
    inner: { maxWidth: 820, margin: '0 auto', padding: '36px 40px 60px' } as React.CSSProperties,
    header: { borderBottom: '3px solid #1a5c2e', paddingBottom: 18, marginBottom: 26 } as React.CSSProperties,
    sectionTitle: { fontSize: 13, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#1a5c2e', borderBottom: '1px solid #e0e0e0', paddingBottom: 6, marginBottom: 14, marginTop: 28 },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 } as React.CSSProperties,
    kpiBox: { background: '#f5f9f6', border: '1px solid #d0e8d8', borderRadius: 8, padding: '12px 14px', textAlign: 'center' as const },
    kpiVal: { fontSize: 18, fontWeight: 700, color: '#1a5c2e' },
    kpiLab: { fontSize: 10, color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginTop: 3 },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 },
    th: { background: '#1a5c2e', color: 'white', padding: '8px 10px', textAlign: 'left' as const, fontWeight: 600, fontSize: 11 },
    td: { padding: '7px 10px', borderBottom: '1px solid #f0f0f0', fontSize: 12 },
    tdRight: { padding: '7px 10px', borderBottom: '1px solid #f0f0f0', fontSize: 12, textAlign: 'right' as const },
    totalRow: { background: '#f5f9f6', fontWeight: 700 },
    redBadge: { color: '#c0392b', fontWeight: 600 },
    greenBadge: { color: '#1a5c2e', fontWeight: 600 },
  }

  const isGlobal = mode === 'global'

  return (
    <div style={styles.page}>
      <div style={styles.inner}>

        {/* Boutons impression — masqués à l'impression */}
        <div className="no-print" style={{ marginBottom: 24, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => window.print()} style={{
            padding: '10px 22px', borderRadius: 8, background: '#1a5c2e', color: 'white',
            border: 'none', cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 700, fontSize: 14
          }}>🖨 Imprimer / PDF</button>
          <button onClick={() => window.close()} style={{
            padding: '10px 18px', borderRadius: 8, background: '#f0f0f0',
            border: 'none', cursor: 'pointer', fontFamily: 'sans-serif', fontSize: 13
          }}>← Retour</button>
          <span style={{ fontSize: 12, color: '#888', fontFamily: 'sans-serif', marginLeft: 8 }}>
            Mode affiché :
            <strong style={{ color: '#1a5c2e', marginLeft: 4 }}>
              {isGlobal ? 'Bilan global saison' : mode === 'session' ? `Session ${session?.numero}` : `Camion ${camion?.numero}`}
            </strong>
          </span>
        </div>

        {/* En-tête */}
        <div style={styles.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a5c2e', fontFamily: 'Georgia, serif' }}>IBL Primeurs</div>
              <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>Campagne Mangue — Système de gestion</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: '#555' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>
                {isGlobal ? 'BILAN GLOBAL SAISON' : mode === 'session' ? `SESSION ${session?.numero}` : `CAMION ${camion?.numero}`}
              </div>
              <div style={{ marginTop: 3 }}>Généré le {today}</div>
            </div>
          </div>
          {isGlobal && (
            <div style={{ marginTop: 12, padding: '8px 14px', background: '#f5f9f6', borderRadius: 6, fontSize: 12, color: '#444' }}>
              Rapport complet · {data.sessions.length} session(s) · {allCamions.length} camion(s) · {employes.length} employé(s)
            </div>
          )}
          {mode === 'session' && session && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#555' }}>
              Du {formatDate(session.dateDebut)}{session.dateFin ? ` au ${formatDate(session.dateFin)}` : ' — en cours'}
              {' · '}{journeesRH.length} journée(s) de travail
            </div>
          )}
          {mode === 'camion' && camion && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#555' }}>
              Démarré le {formatDate(camion.dateDebut)}{camion.dateFin ? ` · Clôturé le ${formatDate(camion.dateFin)}` : ' — en cours'}
              {' · '}Objectif : {camion.objectifKg.toLocaleString()} kg exportables
            </div>
          )}
        </div>

        {/* ═══ BILAN GLOBAL RAPIDE (toujours visible) ═══ */}
        {isGlobal && (
          <>
            <div style={styles.sectionTitle}>Bilan global saison</div>
            <div style={styles.kpiGrid}>
              <div style={styles.kpiBox}><div style={styles.kpiVal}>{employes.length}</div><div style={styles.kpiLab}>Employés</div></div>
              <div style={styles.kpiBox}><div style={styles.kpiVal}>{data.sessions.length}</div><div style={styles.kpiLab}>Sessions RH</div></div>
              <div style={styles.kpiBox}><div style={styles.kpiVal}>{allCamions.length}</div><div style={styles.kpiLab}>Camions</div></div>
              <div style={styles.kpiBox}><div style={styles.kpiVal}>{data.journees.length}</div><div style={styles.kpiLab}>Jours travaillés</div></div>
            </div>
            <div style={{ ...styles.kpiGrid, gridTemplateColumns: 'repeat(3,1fr)' }}>
              <div style={styles.kpiBox}><div style={{ ...styles.kpiVal, color: '#1a5c2e' }}>{statsGlobal.totalExportable.toLocaleString()} kg</div><div style={styles.kpiLab}>Total exportable</div></div>
              <div style={styles.kpiBox}><div style={{ ...styles.kpiVal, color: '#c0392b' }}>{formatFCFA(totalDepensesGlobal)}</div><div style={styles.kpiLab}>Total dépenses</div></div>
              <div style={styles.kpiBox}><div style={{ ...styles.kpiVal, color: '#c0392b' }}>{formatFCFA(totalPaieGlobal)}</div><div style={styles.kpiLab}>Total paie</div></div>
            </div>
            <div style={{ padding: '14px 18px', background: '#fff3f3', border: '1px solid #f5c6c6', borderRadius: 8, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#555' }}>Coût total saison (dépenses + paie) :</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#c0392b' }}>{formatFCFA(coutTotal)}</span>
              </div>
            </div>
          </>
        )}

        {/* ═══ SECTION PRODUCTION / CAMIONS ═══ */}
        <div style={styles.sectionTitle}>
          {isGlobal ? `Production — Tous les camions (${allCamions.length})` : mode === 'camion' ? `Production — Camion ${camion?.numero}` : 'Production (période session)'}
        </div>

        {/* KPIs production */}
        <div style={styles.kpiGrid}>
          <div style={styles.kpiBox}><div style={styles.kpiVal}>{statsProd.totalRecu.toLocaleString()} kg</div><div style={styles.kpiLab}>Total reçu</div></div>
          <div style={{ ...styles.kpiBox, background: '#f0faf3' }}><div style={{ ...styles.kpiVal, color: '#1a5c2e' }}>{statsProd.totalExportable.toLocaleString()} kg</div><div style={styles.kpiLab}>Exportable</div></div>
          <div style={{ ...styles.kpiBox, background: '#fff8f8' }}><div style={{ ...styles.kpiVal, color: '#c0392b' }}>{statsProd.totalEcart.toLocaleString()} kg</div><div style={styles.kpiLab}>Écarts</div></div>
          <div style={{ ...styles.kpiBox, background: '#fff8f8' }}><div style={{ ...styles.kpiVal, color: statsProd.pctEcart > 20 ? '#c0392b' : '#e67e22' }}>{statsProd.pctEcart}%</div><div style={styles.kpiLab}>% Écart</div></div>
        </div>

        {/* Tableau journées production */}
        {journeesProd.length > 0 && (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Date</th>
                {isGlobal && <th style={styles.th}>Camion</th>}
                <th style={{ ...styles.th, textAlign: 'right' }}>Reçu (kg)</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Exportable (kg)</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Écart (kg)</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>% Écart</th>
              </tr>
            </thead>
            <tbody>
              {journeesProd.map(j => {
                const exp = j.volumeRecuKg - j.volumeEcartKg
                const pct = j.volumeRecuKg > 0 ? Math.round((j.volumeEcartKg / j.volumeRecuKg) * 1000) / 10 : 0
                const cam = data.camions.find(c => c.id === j.camionId)
                return (
                  <tr key={j.id}>
                    <td style={styles.td}>{formatDate(j.date)}</td>
                    {isGlobal && <td style={styles.td}>Camion {cam?.numero || '?'}</td>}
                    <td style={styles.tdRight}>{j.volumeRecuKg.toLocaleString()}</td>
                    <td style={{ ...styles.tdRight, ...styles.greenBadge }}>{exp.toLocaleString()}</td>
                    <td style={{ ...styles.tdRight, ...styles.redBadge }}>{j.volumeEcartKg.toLocaleString()}</td>
                    <td style={{ ...styles.tdRight, color: pct > 20 ? '#c0392b' : '#e67e22', fontWeight: 600 }}>{pct}%</td>
                  </tr>
                )
              })}
              <tr style={styles.totalRow}>
                <td style={styles.td} colSpan={isGlobal ? 2 : 1}><strong>TOTAL</strong></td>
                <td style={styles.tdRight}><strong>{statsProd.totalRecu.toLocaleString()}</strong></td>
                <td style={{ ...styles.tdRight, color: '#1a5c2e' }}><strong>{statsProd.totalExportable.toLocaleString()}</strong></td>
                <td style={{ ...styles.tdRight, color: '#c0392b' }}><strong>{statsProd.totalEcart.toLocaleString()}</strong></td>
                <td style={{ ...styles.tdRight, color: '#c0392b' }}><strong>{statsProd.pctEcart}%</strong></td>
              </tr>
            </tbody>
          </table>
        )}
        {journeesProd.length === 0 && (
          <p style={{ fontSize: 13, color: '#888', fontStyle: 'italic' }}>Aucune donnée de production.</p>
        )}

        {/* ═══ SECTION DÉPENSES ═══ */}
        <div style={styles.sectionTitle}>
          {isGlobal ? 'Dépenses — Toute la saison' : mode === 'camion' ? `Dépenses — Camion ${camion?.numero}` : 'Dépenses (période)'}
        </div>

        {depenses.length > 0 ? (
          <>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  {isGlobal && <th style={styles.th}>Camion</th>}
                  <th style={styles.th}>Description</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Qté (kg)</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Prix/kg</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {[...depenses].sort((a,b) => a.date.localeCompare(b.date)).map(d => {
                  const cam = data.camions.find(c => c.id === d.camionId)
                  const montant = getMontantDepense(d)
                  return (
                    <tr key={d.id}>
                      <td style={styles.td}>{formatDate(d.date)}</td>
                      {isGlobal && <td style={styles.td}>Camion {cam?.numero || '?'}</td>}
                      <td style={styles.td}>
                        {d.description}
                        {d.isProductionSync && <span style={{ fontSize: 10, color: '#1a5c2e', marginLeft: 6, background: '#e8f5ec', padding: '1px 5px', borderRadius: 4 }}>Auto</span>}
                      </td>
                      <td style={styles.tdRight}>{d.quantiteKg ? d.quantiteKg.toLocaleString() : '—'}</td>
                      <td style={styles.tdRight}>{d.prixParKg ? formatFCFA(d.prixParKg) : '—'}</td>
                      <td style={{ ...styles.tdRight, fontWeight: montant > 0 ? 600 : 400, color: montant > 0 ? '#c0392b' : '#aaa' }}>
                        {montant > 0 ? formatFCFA(montant) : 'À renseigner'}
                      </td>
                    </tr>
                  )
                })}
                <tr style={styles.totalRow}>
                  <td style={styles.td} colSpan={isGlobal ? 4 : 3}><strong>TOTAL DÉPENSES</strong></td>
                  <td style={{ ...styles.tdRight, color: '#c0392b' }} colSpan={2}><strong>{formatFCFA(totalDepenses)}</strong></td>
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <p style={{ fontSize: 13, color: '#888', fontStyle: 'italic' }}>Aucune dépense enregistrée.</p>
        )}

        {/* ═══ SECTION EMPLOYÉS / PAIE ═══ */}
        <div style={styles.sectionTitle}>
          {isGlobal ? 'Paie — Toute la saison' : mode === 'session' ? `Paie — Session ${session?.numero}` : 'Paie (période)'}
        </div>

        {/* KPIs paie */}
        <div style={{ ...styles.kpiGrid, gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 16 }}>
          <div style={styles.kpiBox}><div style={styles.kpiVal}>{employes.length}</div><div style={styles.kpiLab}>Employés</div></div>
          <div style={styles.kpiBox}><div style={styles.kpiVal}>{journeesRH.length}</div><div style={styles.kpiLab}>Journées</div></div>
          <div style={{ ...styles.kpiBox, background: '#fff8f8' }}><div style={{ ...styles.kpiVal, color: '#c0392b' }}>{formatFCFA(totalPaie)}</div><div style={styles.kpiLab}>Total paie</div></div>
        </div>

        {employes.length > 0 ? (
          <>
            {/* Tableau présences détaillées par jour */}
            {journeesRH.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1a5c2e', marginBottom: 8, marginTop: 4 }}>
                  Feuille de présence détaillée
                </div>
                <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                  <table style={{ ...styles.table, fontSize: 10 }}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, fontSize: 10, minWidth: 120 }}>Employé</th>
                        <th style={{ ...styles.th, fontSize: 10 }}>Genre</th>
                        {journeesRH.map(j => (
                          <th key={j.id} style={{ ...styles.th, textAlign: 'center', fontSize: 9, padding: '6px 4px', minWidth: 32 }}>
                            {new Date(j.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                          </th>
                        ))}
                        <th style={{ ...styles.th, textAlign: 'right', fontSize: 10 }}>Jours</th>
                        <th style={{ ...styles.th, textAlign: 'right', fontSize: 10 }}>Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employes.map((e, idx) => {
                        const jours = totalJoursPresents(e.id)
                        const montant = getTotalEmploye(e.id)
                        return (
                          <tr key={e.id} style={{ background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                            <td style={{ ...styles.td, fontSize: 11, fontWeight: 600 }}>{e.prenom} {e.nom}</td>
                            <td style={{ ...styles.td, fontSize: 10 }}>{e.genre === 'H' ? 'H' : 'F'}</td>
                            {journeesRH.map(j => {
                              const statut = getStatutEmployeJournee(e, j)
                              return (
                                <td key={j.id} style={{ ...styles.td, textAlign: 'center', padding: '6px 2px', fontSize: 11 }}>
                                  {statut === 'present' ? <span style={{ color: '#1a5c2e', fontWeight: 700 }}>P</span>
                                    : statut === 'absent' ? <span style={{ color: '#c0392b', fontWeight: 700 }}>A</span>
                                    : <span style={{ color: '#ccc' }}>—</span>}
                                </td>
                              )
                            })}
                            <td style={{ ...styles.tdRight, fontWeight: 700, fontSize: 11 }}>{jours}</td>
                            <td style={{ ...styles.tdRight, color: '#1a5c2e', fontWeight: 700, fontSize: 11 }}>{formatFCFA(montant)}</td>
                          </tr>
                        )
                      })}
                      <tr style={styles.totalRow}>
                        <td style={styles.td} colSpan={2}><strong>TOTAL</strong></td>
                        {journeesRH.map(j => (
                          <td key={j.id} style={{ ...styles.td, textAlign: 'center', fontSize: 10, color: '#1a5c2e', fontWeight: 700 }}>
                            {employes.filter(e => getStatutEmployeJournee(e, j) === 'present').length}
                          </td>
                        ))}
                        <td style={{ ...styles.tdRight, color: '#1a1a1a' }}><strong>{journeesRH.reduce((acc, j) => acc + employes.filter(e => getStatutEmployeJournee(e, j) === 'present').length, 0)}</strong></td>
                        <td style={{ ...styles.tdRight, color: '#c0392b' }}><strong>{formatFCFA(totalPaie)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Tableau de paiement avec signature */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1a5c2e', marginBottom: 8 }}>
              Fiche de paiement — Signature des employés
            </div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: '4%' }}>N°</th>
                  <th style={styles.th}>Nom & Prénom</th>
                  <th style={styles.th}>Genre</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Taux/jour</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Jours</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Montant dû</th>
                  <th style={{ ...styles.th, textAlign: 'center', minWidth: 100 }}>Signature</th>
                </tr>
              </thead>
              <tbody>
                {employes.map((e, idx) => {
                  const jours = totalJoursPresents(e.id)
                  const montant = getTotalEmploye(e.id)
                  const taux = getTauxForEmploye(e, data.config)
                  return (
                    <tr key={e.id} style={{ background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ ...styles.td, color: '#888', fontSize: 11 }}>{idx + 1}</td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{e.prenom} {e.nom}</td>
                      <td style={styles.td}>{e.genre === 'H' ? 'Homme' : 'Femme'}</td>
                      <td style={styles.tdRight}>{formatFCFA(taux)}</td>
                      <td style={{ ...styles.tdRight, fontWeight: 700 }}>{jours}</td>
                      <td style={{ ...styles.tdRight, color: '#1a5c2e', fontWeight: 700 }}>{formatFCFA(montant)}</td>
                      <td style={{ ...styles.td, textAlign: 'center', borderBottom: '1px solid #ccc' }}>
                        <div style={{ borderBottom: '1px solid #999', height: 28, width: '80%', margin: '0 auto' }} />
                      </td>
                    </tr>
                  )
                })}
                <tr style={styles.totalRow}>
                  <td style={styles.td} colSpan={4}><strong>TOTAL GÉNÉRAL</strong></td>
                  <td style={styles.tdRight}><strong>{journeesRH.reduce((acc, j) => acc + employes.filter(e => getStatutEmployeJournee(e, j) === 'present').length, 0)}</strong></td>
                  <td style={{ ...styles.tdRight, color: '#c0392b' }}><strong>{formatFCFA(totalPaie)}</strong></td>
                  <td />
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <p style={{ fontSize: 13, color: '#888', fontStyle: 'italic' }}>Aucun employé enregistré.</p>
        )}

        {/* ═══ RÉCAP FINAL ═══ */}
        <div style={{ ...styles.sectionTitle, marginTop: 32 }}>Récapitulatif financier</div>
        <div style={{ border: '2px solid #1a5c2e', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 18px', background: '#f5f9f6', borderBottom: '1px solid #d0e8d8' }}>
            <span style={{ fontSize: 13 }}>Total dépenses (achats + frais)</span>
            <span style={{ fontWeight: 700, color: '#c0392b' }}>{formatFCFA(totalDepenses)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 18px', background: '#f5f9f6', borderBottom: '1px solid #d0e8d8' }}>
            <span style={{ fontSize: 13 }}>Total paie employés</span>
            <span style={{ fontWeight: 700, color: '#c0392b' }}>{formatFCFA(totalPaie)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 18px', background: '#1a5c2e' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>COÛT TOTAL</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{formatFCFA(totalDepenses + totalPaie)}</span>
          </div>
        </div>

        {/* Pied de page */}
        <div style={{ marginTop: 40, borderTop: '1px solid #e0e0e0', paddingTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888' }}>
          <span>IBL Primeurs — Système de gestion Campagne Mangue</span>
          <span>Généré le {today}</span>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 15mm; }
        }
      `}</style>
    </div>
  )
}
