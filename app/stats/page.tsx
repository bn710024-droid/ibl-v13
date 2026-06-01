'use client'
import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import PageWrapper from '@/components/PageWrapper'
import {
  loadData, formatFCFA, formatDate,
  AppData, getStatutEmployeJournee
} from '@/lib/store'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts'

export default function StatsPage() {
  const [data, setData] = useState<AppData | null>(null)
  const [jourClique, setJourClique] = useState<string | null>(null)

  useEffect(() => {
    setData(loadData())
    import('@/lib/syncFromSupabase').then(({ syncFromSupabase }) => {
      syncFromSupabase(remote => setData(remote))
    })
  }, [])

  if (!data) return null

  const hommes = data.employes.filter(e => e.genre === 'H')
  const femmes = data.employes.filter(e => e.genre === 'F')
  const sortedJournees = [...data.journees].sort((a, b) => a.date.localeCompare(b.date))

  const presencesH = sortedJournees.reduce((acc, j) =>
    acc + hommes.filter(e => getStatutEmployeJournee(e, j) === 'present').length, 0)
  const presencesF = sortedJournees.reduce((acc, j) =>
    acc + femmes.filter(e => getStatutEmployeJournee(e, j) === 'present').length, 0)
  const totalPossibleH = sortedJournees.reduce((acc, j) =>
    acc + hommes.filter(e => getStatutEmployeJournee(e, j) !== 'na').length, 0)
  const totalPossibleF = sortedJournees.reduce((acc, j) =>
    acc + femmes.filter(e => getStatutEmployeJournee(e, j) !== 'na').length, 0)
  const tauxH = totalPossibleH > 0 ? Math.round((presencesH / totalPossibleH) * 100) : 0
  const tauxF = totalPossibleF > 0 ? Math.round((presencesF / totalPossibleF) * 100) : 0

  const courbeGenerale = sortedJournees.map(j => ({
    date: j.date.slice(5),
    fullDate: j.date,
    Hommes: hommes.filter(e => getStatutEmployeJournee(e, j) === 'present').length,
    Femmes: femmes.filter(e => getStatutEmployeJournee(e, j) === 'present').length,
  }))

  // Présences par session
  const presencesParSession = data.sessions.map(s => {
    const jours = sortedJournees.filter(j => j.sessionId === s.id)
    const pH = jours.reduce((acc, j) => acc + hommes.filter(e => getStatutEmployeJournee(e, j) === 'present').length, 0)
    const pF = jours.reduce((acc, j) => acc + femmes.filter(e => getStatutEmployeJournee(e, j) === 'present').length, 0)
    return { name: `S${s.numero}`, Hommes: pH, Femmes: pF }
  })

  // Taux présence par employé (top 10)
  const tauxParEmploye = data.employes.map(e => {
    const actifs = sortedJournees.filter(j => getStatutEmployeJournee(e, j) !== 'na').length
    const presents = sortedJournees.filter(j => getStatutEmployeJournee(e, j) === 'present').length
    const taux = actifs > 0 ? Math.round((presents / actifs) * 100) : 0
    const montant = sortedJournees.reduce((acc, j) => {
      if (getStatutEmployeJournee(e, j) !== 'present') return acc
      const tauxJ = e.tauxIndividuel || (e.genre === 'H' ? data.config.tauxHomme : data.config.tauxFemme)
      return acc + tauxJ + (j.bonusJour || 0)
    }, 0)
    return { e, actifs, presents, taux, montant }
  }).sort((a, b) => b.taux - a.taux)

  // Donut absences globales
  const totalPresences = presencesH + presencesF
  const totalPossible = totalPossibleH + totalPossibleF
  const donutData = [
    { name: 'Présents', value: totalPresences },
    { name: 'Absents', value: totalPossible - totalPresences },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--forest-deep)' }}>
      <Navbar />
      <PageWrapper>
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: 'var(--white)', lineHeight: 1.1 }}>
              Statistiques générales
            </h1>
            <p style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, marginTop: 5 }}>
              {data.employes.length} employés · {data.journees.length} journées · {data.sessions.length} sessions
            </p>
          </div>

          {/* KPIs effectifs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
            {[
              { label: 'Total employés', value: data.employes.length, color: 'var(--white)' },
              { label: 'Hommes', value: hommes.length, color: '#3db06a' },
              { label: 'Femmes', value: femmes.length, color: '#52d485' },
              { label: 'Journées', value: data.journees.length, color: 'var(--gold)' },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: '18px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontFamily: 'Playfair Display, serif', color: s.color, fontWeight: 700 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 5 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* KPIs taux de présence */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Taux de présence — Hommes', value: `${tauxH}%`, color: '#3db06a' },
              { label: 'Taux de présence — Femmes', value: `${tauxF}%`, color: '#52d485' },
              { label: 'Taux de présence global', value: totalPossible > 0 ? `${Math.round((totalPresences / totalPossible) * 100)}%` : '—', color: 'var(--gold)' },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: '18px', textAlign: 'center' }}>
                <div style={{ fontSize: 30, fontFamily: 'Playfair Display, serif', color: s.color, fontWeight: 700 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 5 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Graphiques ligne 1 : courbe présences + donut */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 14, marginBottom: 14 }}>

            {/* Courbe H vs F */}
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontSize: 11, color: 'var(--gray-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Présences par jour — Hommes vs Femmes</div>
              <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.3)', marginBottom: 12 }}>Cliquez sur un point pour voir le détail</div>
              {courbeGenerale.length === 0 ? (
                <div style={{ color: 'var(--gray-dim)', fontSize: 12 }}>Aucune journée</div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={courbeGenerale}>
                    <XAxis dataKey="date" tick={{ fill: 'rgba(240,237,232,0.35)', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ background: 'var(--forest)', border: '1px solid rgba(61,176,106,0.2)', borderRadius: 8, color: 'var(--cream)', fontSize: 11 }} />
                    <Line type="monotone" dataKey="Hommes" stroke="#3db06a" strokeWidth={2.5}
                      dot={{ r: 6, fill: '#3db06a', strokeWidth: 0, cursor: 'pointer' }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      activeDot={{ r: 9, cursor: 'pointer', onClick: (_: any, p: any) => setJourClique(prev => prev === p.payload.fullDate ? null : p.payload.fullDate) }}
                    />
                    <Line type="monotone" dataKey="Femmes" stroke="#52d485" strokeWidth={2.5} strokeDasharray="5 3"
                      dot={{ r: 6, fill: '#52d485', strokeWidth: 0, cursor: 'pointer' }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      activeDot={{ r: 9, cursor: 'pointer', onClick: (_: any, p: any) => setJourClique(prev => prev === p.payload.fullDate ? null : p.payload.fullDate) }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
              <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11 }}>
                <span style={{ color: '#3db06a' }}>— Hommes</span>
                <span style={{ color: '#52d485' }}>– – Femmes</span>
              </div>

              {/* Panel jour cliqué */}
              {jourClique && (() => {
                const journee = sortedJournees.find(j => j.date === jourClique)
                if (!journee) return null
                const actifs = data.employes.filter(e => getStatutEmployeJournee(e, journee) !== 'na')
                const presentsH2 = actifs.filter(e => e.genre === 'H' && getStatutEmployeJournee(e, journee) === 'present')
                const presentsF2 = actifs.filter(e => e.genre === 'F' && getStatutEmployeJournee(e, journee) === 'present')
                const absentsJ = actifs.filter(e => getStatutEmployeJournee(e, journee) === 'absent')
                return (
                  <div className="fade-in" style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 14, color: 'var(--white)', fontWeight: 600 }}>📅 {formatDate(jourClique)}</span>
                      <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>{presentsH2.length + presentsF2.length} / {actifs.length} présents</span>
                      <button onClick={() => setJourClique(null)} style={{ background: 'transparent', border: 'none', color: 'var(--gray-dim)', cursor: 'pointer', fontSize: 16 }}>✕</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#3db06a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>♂ Hommes ({presentsH2.length})</div>
                        {presentsH2.map(e => <div key={e.id} style={{ fontSize: 12, color: 'var(--cream)', padding: '2px 0' }}>✓ {e.prenom} {e.nom}</div>)}
                        {presentsH2.length === 0 && <div style={{ fontSize: 12, color: 'var(--gray-dim)' }}>Aucun</div>}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#52d485', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>♀ Femmes ({presentsF2.length})</div>
                        {presentsF2.map(e => <div key={e.id} style={{ fontSize: 12, color: 'var(--cream)', padding: '2px 0' }}>✓ {e.prenom} {e.nom}</div>)}
                        {presentsF2.length === 0 && <div style={{ fontSize: 12, color: 'var(--gray-dim)' }}>Aucune</div>}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Absents ({absentsJ.length})</div>
                        {absentsJ.map(e => <div key={e.id} style={{ fontSize: 12, color: 'var(--gray-dim)', padding: '2px 0' }}>✕ {e.prenom} {e.nom}</div>)}
                        {absentsJ.length === 0 && <div style={{ fontSize: 12, color: 'var(--green)' }}>Aucun absent 🎉</div>}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Donut global */}
            <div className="card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--gray-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Taux global</div>
              <PieChart width={130} height={130}>
                <Pie data={donutData} cx={60} cy={60} innerRadius={40} outerRadius={60} dataKey="value" strokeWidth={0}>
                  <Cell fill="#3db06a" />
                  <Cell fill="#E8312A" fillOpacity={0.7} />
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--forest)', border: '1px solid rgba(61,176,106,0.2)', borderRadius: 8, fontSize: 11 }} />
              </PieChart>
              <div style={{ fontSize: 26, fontFamily: 'Playfair Display, serif', color: 'var(--green)', fontWeight: 700, marginTop: 6 }}>
                {totalPossible > 0 ? `${Math.round((totalPresences / totalPossible) * 100)}%` : '—'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--gray-dim)', marginTop: 4, textAlign: 'center' }}>
                {totalPresences} / {totalPossible} jours-présence
              </div>
              <div style={{ marginTop: 14, width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#3db06a' }}>♂ Hommes</span>
                  <span style={{ color: '#3db06a', fontWeight: 700 }}>{tauxH}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#52d485' }}>♀ Femmes</span>
                  <span style={{ color: '#52d485', fontWeight: 700 }}>{tauxF}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Graphiques ligne 2 : BarChart sessions */}
          {presencesParSession.length > 1 && (
            <div className="card" style={{ padding: '18px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--gray-dim)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Présences par session</div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={presencesParSession} barGap={4}>
                  <XAxis dataKey="name" tick={{ fill: 'rgba(240,237,232,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: 'var(--forest)', border: '1px solid rgba(61,176,106,0.2)', borderRadius: 8, color: 'var(--cream)', fontSize: 11 }} />
                  <Bar dataKey="Hommes" fill="#3db06a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Femmes" fill="#52d485" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11 }}>
                <span style={{ color: '#3db06a' }}>■ Hommes</span>
                <span style={{ color: '#52d485' }}>■ Femmes</span>
              </div>
            </div>
          )}

          {/* Tableau taux par employé */}
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ fontSize: 11, color: 'var(--gray-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Classement présence — tous employés
            </div>
            <p style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', marginBottom: 14 }}>
              Classés du meilleur au plus faible taux. <span style={{ color: 'var(--green)' }}>Vert ≥ 80%</span> · <span style={{ color: 'var(--gold)' }}>Or ≥ 50%</span> · <span style={{ color: 'var(--red-bright)' }}>Rouge &lt; 50%</span>. Le taux est calculé uniquement sur les jours où l'employé était censé être présent (à partir de sa date d'embauche).
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--gray-dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600 }}>#</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600 }}>Employé</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 600 }}>Genre</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 600 }}>Embauché le</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 600 }}>Jours</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 600 }}>Taux</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 600 }}>Total gagné</th>
                </tr>
              </thead>
              <tbody>
                {tauxParEmploye.map(({ e, presents, actifs, taux, montant }, i) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '9px 10px', color: 'var(--gray-dim)', fontSize: 12 }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td style={{ padding: '9px 10px', color: 'var(--cream)', fontWeight: 500 }}>{e.prenom} {e.nom}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: e.genre === 'H' ? '#3db06a' : '#52d485', fontSize: 12 }}>
                      {e.genre === 'H' ? '♂ H' : '♀ F'}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: 'var(--gray-dim)', fontSize: 11 }}>
                      {formatDate(e.dateEmbauche || e.dateAjout)}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: 'var(--gray)' }}>
                      {presents} / {actifs}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                      <span style={{
                        fontWeight: 700, fontSize: 14,
                        color: taux >= 80 ? 'var(--green)' : taux >= 50 ? 'var(--gold)' : 'var(--red-bright)'
                      }}>{taux}%</span>
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--red-bright)', fontWeight: 700, fontFamily: 'Playfair Display, serif', fontSize: 13 }}>
                      {formatFCFA(montant)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </main>
      </PageWrapper>
    </div>
  )
}
