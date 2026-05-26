import { createClient } from '@supabase/supabase-js'
import type { AppData } from './store'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  || ''
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

// ── Lire les données depuis Supabase ──
export async function fetchRemoteData(): Promise<AppData | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('ibl_data')
      .select('data')
      .eq('id', 'main')
      .maybeSingle()
    if (error || !data?.data) return null
    return data.data as AppData
  } catch {
    return null
  }
}

// ── Sauvegarder les données dans Supabase ──
export async function pushRemoteData(appData: AppData): Promise<void> {
  if (!supabase) return
  try {
    await supabase
      .from('ibl_data')
      .upsert({
        id: 'main',
        data: appData,
        updated_at: new Date().toISOString()
      })
  } catch (err) {
    console.error('[Supabase] Erreur sync:', err)
  }
}
