export interface Employe {
  id: string
  nom: string
  prenom: string
  genre: 'H' | 'F'
  dateAjout: string
  dateEmbauche?: string   // date réelle d'embauche (= dateAjout si non renseigné)
  dateSortie?: string
  tauxIndividuel?: number
}

export interface Journee {
  id: string
  sessionId: string
  date: string
  absents: string[]
  ecartKg: number
  bonusJour?: number
  bonusJourH?: number
  bonusJourF?: number
}

export interface Session {
  id: string
  numero: number
  dateDebut: string
  dateFin?: string
  fermee: boolean
}

export interface JourneeProduction {
  id: string
  camionId: string
  date: string
  volumeRecuKg: number
  volumeEcartKg: number
  produit?: string
}

export interface Depense {
  id: string
  camionId: string
  date: string
  description: string
  quantiteKg?: number
  prixParKg?: number
  montantFixe?: number
  isProductionSync?: boolean      // créée automatiquement depuis production
  productionJourneeId?: string    // lien vers la journée production
}

export interface Camion {
  id: string
  numero: number
  dateDebut: string
  dateFin?: string
  objectifKg: number
  statut: 'en_cours' | 'cloture'
}

export interface Config {
  tauxHomme: number
  tauxFemme: number
  pin: string
  objectifCamionKg: number
}

export interface AppData {
  employes: Employe[]
  journees: Journee[]
  sessions: Session[]
  journeesProduction: JourneeProduction[]
  depenses: Depense[]
  camions: Camion[]
  config: Config
}

const DEFAULT_DATA: AppData = {
  employes: [], journees: [], sessions: [],
  journeesProduction: [], depenses: [], camions: [],
  config: { tauxHomme: 3500, tauxFemme: 3000, pin: '1234', objectifCamionKg: 24000 }
}

export function loadData(): AppData {
  if (typeof window === 'undefined') return DEFAULT_DATA
  try {
    const raw = localStorage.getItem('ibl-primeurs-data')
    if (!raw) return DEFAULT_DATA
    const parsed = JSON.parse(raw)
    if (parsed.journees && !parsed.sessions) {
      const sessionId = genId()
      parsed.sessions = [{ id: sessionId, numero: 1, dateDebut: parsed.journees[0]?.date || new Date().toISOString().slice(0,10), fermee: false }]
      parsed.journees = parsed.journees.map((j: Journee) => ({ ...j, sessionId }))
    }
    return {
      ...DEFAULT_DATA, ...parsed,
      config: { ...DEFAULT_DATA.config, ...parsed.config },
      journeesProduction: parsed.journeesProduction || [],
      depenses: parsed.depenses || [],
      camions: parsed.camions || [],
    }
  } catch { return DEFAULT_DATA }
}

export function saveData(data: AppData) {
  if (typeof window === 'undefined') return
  localStorage.setItem('ibl-primeurs-data', JSON.stringify(data))
  // Sync vers Supabase en arrière-plan
  import('@/lib/supabase').then(({ pushRemoteData }) => {
    pushRemoteData(data)
  }).catch(() => {})
}

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export type StatutJournee = 'present' | 'absent' | 'na'

export function getStatutEmployeJournee(e: Employe, j: Journee): StatutJournee {
  const embauche = e.dateEmbauche || e.dateAjout
  if (j.date < embauche) return 'na'
  if (e.dateSortie && j.date > e.dateSortie) return 'na'
  if (j.absents.includes(e.id)) return 'absent'
  return 'present'
}

export function getTauxForEmploye(e: Employe, config: Config): number {
  if (e.tauxIndividuel && e.tauxIndividuel > 0) return e.tauxIndividuel
  return e.genre === 'H' ? config.tauxHomme : config.tauxFemme
}

export function getMontantJournee(e: Employe, j: Journee, config: Config): number {
  if (getStatutEmployeJournee(e, j) !== 'present') return 0
  const bonus = e.genre === 'H'
    ? (j.bonusJourH ?? j.bonusJour ?? 0)
    : (j.bonusJourF ?? j.bonusJour ?? 0)
  return getTauxForEmploye(e, config) + bonus
}

export function getMontantTotal(e: Employe, journees: Journee[], config: Config): number {
  return journees.reduce((acc, j) => acc + getMontantJournee(e, j, config), 0)
}

export function getSessionActive(data: AppData): Session | null {
  return data.sessions.find(s => !s.fermee) || null
}

export function getJourneesSession(sessionId: string, journees: Journee[]): Journee[] {
  return journees.filter(j => j.sessionId === sessionId)
}

export function getCamionActif(data: AppData): Camion | null {
  return data.camions.find(c => c.statut !== 'cloture') || null
}

export function getJourneesCamion(camionId: string, data: AppData): JourneeProduction[] {
  return data.journeesProduction.filter(j => j.camionId === camionId)
}

export function getDepensesCamion(camionId: string, data: AppData): Depense[] {
  return data.depenses.filter(d => d.camionId === camionId)
}

export function getMontantDepense(d: Depense): number {
  if (d.quantiteKg && d.prixParKg) return d.quantiteKg * d.prixParKg
  return d.montantFixe || 0
}

export function getStatsProduction(journees: JourneeProduction[]) {
  const totalRecu = journees.reduce((a, j) => a + j.volumeRecuKg, 0)
  const totalEcart = journees.reduce((a, j) => a + j.volumeEcartKg, 0)
  const totalExportable = totalRecu - totalEcart
  const pctEcart = totalRecu > 0 ? Math.round((totalEcart / totalRecu) * 1000) / 10 : 0
  return { totalRecu, totalEcart, totalExportable, pctEcart }
}

// Crée ou met à jour la dépense synchronisée depuis une journée production
export function syncDepenseProduction(
  data: AppData,
  journee: JourneeProduction,
  camionId: string
): AppData {
  const existante = data.depenses.find(d => d.productionJourneeId === journee.id)
  const depenseData: Depense = {
    id: existante?.id || genId(),
    camionId,
    date: journee.date,
    description: 'Achat mangues',
    quantiteKg: journee.volumeRecuKg,
    prixParKg: existante?.prixParKg, // on garde le prix si déjà renseigné
    isProductionSync: true,
    productionJourneeId: journee.id,
  }
  return {
    ...data,
    depenses: existante
      ? data.depenses.map(d => d.productionJourneeId === journee.id ? depenseData : d)
      : [...data.depenses, depenseData]
  }
}

export function formatFCFA(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short'
  })
}

export function verifierPin(input: string, config: Config): boolean {
  return input === config.pin
}
