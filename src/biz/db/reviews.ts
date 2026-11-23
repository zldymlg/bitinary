import { supabase } from '@/lib/supabase'
import { execute, throwIfError, type DbResult } from './result'
import { assertBusinessOwner } from './entity'

export type ReviewRow = { id: string; business_id: string; author_id: string | null; stars: number; body: string; photo_urls: string[]; visited: boolean; checkin_at: string | null; checkin_via: 'QR' | 'code' | null; reply: string | null; hidden: boolean; created_at: string }
export function loadReviews(businessId: string): Promise<DbResult<ReviewRow[]>> {
  return execute(async () => {
    await assertBusinessOwner(businessId)
    const { data, error } = await supabase.from('reviews').select('*').eq('business_id', businessId).order('created_at', { ascending: false })
    throwIfError(error)
    return data as ReviewRow[]
  })
}
export function createReview(review: Omit<ReviewRow, 'id' | 'created_at'>): Promise<DbResult<ReviewRow>> {
  return execute(async () => {
    const { data, error } = await supabase.from('reviews').insert(review).select('*').single()
    throwIfError(error)
    return data as ReviewRow
  })
}
export function updateReviewReply(businessId: string, id: string, reply: string): Promise<DbResult<ReviewRow>> {
  return execute(async () => {
    await assertBusinessOwner(businessId)
    const { data, error } = await supabase.from('reviews').update({ reply }).eq('business_id', businessId).eq('id', id).select('*').single()
    throwIfError(error)
    return data as ReviewRow
  })
}
export function deleteReview(businessId: string, id: string): Promise<DbResult<null>> {
  return execute(async () => {
    await assertBusinessOwner(businessId)
    const { error } = await supabase.from('reviews').delete().eq('business_id', businessId).eq('id', id)
    throwIfError(error)
    return null
  })
}
