import { supabase } from './supabase'

export function isDatabaseBusinessId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

export async function persistSavedPlace(userId: string, businessId: string, saved: boolean) {
  const result = saved
    ? await supabase.from('saved_places').upsert(
        { user_id: userId, business_id: businessId },
        { onConflict: 'user_id,business_id' },
      )
    : await supabase
        .from('saved_places')
        .delete()
        .eq('user_id', userId)
        .eq('business_id', businessId)

  if (result.error) throw new Error(result.error.message)
}
