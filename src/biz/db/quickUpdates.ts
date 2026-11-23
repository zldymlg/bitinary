import { supabase } from '@/lib/supabase'
import { activeQuickUpdate, normalizeQuickUpdate, type QuickUpdate, type QuickUpdateFields } from '../quickUpdateState'
import { execute, throwIfError } from './result'

const columns = 'status, sold_out, long_queue, special, expires_at'

export function loadQuickUpdate(businessId: string) {
  return execute(async () => {
    const { data, error } = await supabase.from('business_quick_updates')
      .select(columns).eq('business_id', businessId).maybeSingle()
    throwIfError(error)
    return activeQuickUpdate(data as QuickUpdate | null)
  })
}

export function saveQuickUpdate(businessId: string, fields: QuickUpdateFields) {
  return execute(async () => {
    const { data, error } = await supabase.from('business_quick_updates')
      .upsert({ business_id: businessId, ...normalizeQuickUpdate(fields) })
      .select(columns).single()
    throwIfError(error)
    return data as QuickUpdate
  })
}

export function clearQuickUpdate(businessId: string) {
  return execute(async () => {
    const { data, error } = await supabase.from('business_quick_updates').delete().eq('business_id', businessId)
      .select('business_id').maybeSingle()
    throwIfError(error)
    if (!data) throw new Error('The update could not be cleared.')
    return true
  })
}
