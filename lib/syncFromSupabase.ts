import type { AppData } from '@/lib/store'

/**
 * Appelé dans le useEffect de chaque page.
 * Récupère les données depuis Supabase et appelle onSync si elles existent.
 * Silencieux en cas d'erreur — le localStorage est toujours le fallback.
 */
export async function syncFromSupabase(
  onSync: (data: AppData) => void
): Promise<void> {
  try {
    const { fetchRemoteData } = await import('@/lib/supabase')
    const remote = await fetchRemoteData()
    if (remote && remote.config) {
      onSync(remote)
    }
  } catch {
    // Pas de connexion Supabase — on garde le localStorage
  }
}
