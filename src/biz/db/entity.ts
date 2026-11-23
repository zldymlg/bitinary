import { supabase } from '@/lib/supabase'
import { execute, throwIfError, type DbResult } from './result'

export type BusinessTable =
  | 'business_hours'
  | 'menu_items'
  | 'business_photos'
  | 'posts'
  | 'comments'
  | 'reviews'
  | 'review_cases'
  | 'deals'
  | 'boosts'
  | 'branches'
  | 'business_staff'
  | 'reservation_requests'

export async function assertBusinessOwner(businessId: string): Promise<void> {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  throwIfError(authError)
  if (!auth.user) throw new Error('Sign in as the business owner to access business records.')
  const { data, error } = await supabase.from('businesses').select('id').eq('id', businessId).eq('owner_id', auth.user.id).maybeSingle()
  throwIfError(error)
  if (!data) throw new Error('The requested business is not owned by the signed-in user.')
}

export function loadBusinessRows<T>(table: BusinessTable, businessId: string): Promise<DbResult<T[]>> {
  return execute(async () => {
    await assertBusinessOwner(businessId)
    const { data, error } = await supabase.from(table).select('*').eq('business_id', businessId)
    throwIfError(error)
    return data as T[]
  })
}

export function createBusinessRow<T>(table: BusinessTable, businessId: string, values: Record<string, unknown>): Promise<DbResult<T>> {
  return execute(async () => {
    await assertBusinessOwner(businessId)
    const { data, error } = await supabase.from(table).insert({ ...values, business_id: businessId }).select('*').single()
    throwIfError(error)
    return data as T
  })
}

export function updateBusinessRow<T>(table: BusinessTable, businessId: string, id: string, values: Record<string, unknown>): Promise<DbResult<T>> {
  return execute(async () => {
    await assertBusinessOwner(businessId)
    const { data, error } = await supabase.from(table).update(values).eq('business_id', businessId).eq('id', id).select('*').single()
    throwIfError(error)
    return data as T
  })
}

export function deleteBusinessRow(table: BusinessTable, businessId: string, id: string): Promise<DbResult<null>> {
  return execute(async () => {
    await assertBusinessOwner(businessId)
    const { data, error } = await supabase.from(table).delete().eq('business_id', businessId).eq('id', id).select('id').maybeSingle()
    throwIfError(error)
    if (!data) throw new Error('The requested business record could not be found.')
    return null
  })
}
