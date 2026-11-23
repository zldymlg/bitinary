import { useCallback, useEffect, useState } from 'react'
import { useStore } from './store'
import { supabase } from '@/lib/supabase'
import { emptyVerification, isVerificationObjectPath, migrateVerification, type DocKey, type Verification } from '@/lib/verify'

export type VerificationRow = {
  placeId: string
  name: string
  city: string
  image?: string
  owner: string
  contact: string
  v: Verification
}

const UPDATED = 'bitinary:console-verifications-updated'
const VERIFY_BUCKET = 'business-verification'
const SIGNED_URL_SECONDS = 300

export function useVerifications() {
  const [rows, setRows] = useState<VerificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const { showToast } = useStore()

  useEffect(() => {
    let active = true
    const load = async () => {
      const [businessResult, privateResult] = await Promise.all([
        supabase
          .from('businesses')
          .select('id,name,city,cover_url,verification_status,verification_method,verification_files,onsite_date,owner:profiles!businesses_owner_id_fkey(name,mobile)')
          .order('created_at', { ascending: false }),
        supabase.from('business_verifications').select('business_id,verification_data'),
      ])
      if (!active) return
      if (businessResult.error || privateResult.error) {
        setLoading(false)
        showToast({ text: `Could not load database verification records: ${businessResult.error?.message ?? privateResult.error?.message}`, expression: 'unsure' })
        return
      }

      const verificationByBusiness = new Map(
        (privateResult.data ?? []).map((row) => [row.business_id, row.verification_data as Partial<Verification>]),
      )
      setRows((businessResult.data ?? []).map((business) => {
        const owner = business.owner as { name?: string; mobile?: string } | null
        const saved = verificationByBusiness.get(business.id)
        const fallback = {
          ...emptyVerification,
          status: business.verification_status ?? 'none',
          method: business.verification_method ?? undefined,
          onsiteDate: business.onsite_date ?? undefined,
          files: business.verification_files ?? [],
        }
        const hasSavedVerification = !!saved && Object.keys(saved).length > 0
        return {
          placeId: business.id,
          name: business.name,
          city: business.city || '—',
          image: business.cover_url ?? undefined,
          owner: owner?.name || 'No name set',
          contact: owner?.mobile ? `+63 ${owner.mobile}` : '—',
          v: migrateVerification(hasSavedVerification ? { ...fallback, ...saved } : fallback),
        }
      }))
      setLoading(false)
    }

    const refresh = () => {
      setLoading(true)
      void load()
    }
    void load()
    window.addEventListener(UPDATED, refresh)
    return () => {
      active = false
      window.removeEventListener(UPDATED, refresh)
    }
  }, [showToast])

  return { rows, loading }
}

export function useVerificationOf(placeId: string) {
  return useVerifications().rows.find((row) => row.placeId === placeId)?.v
}

/** Create private, short-lived reviewer links only while the detail screen is open. */
export async function signVerificationDocuments(businessId: string, verification: Verification) {
  const docs = { ...verification.docs }
  await Promise.all((['dti', 'permit'] as DocKey[]).map(async (key, index) => {
    const doc = docs[key]
    const path = doc?.storagePath ?? verification.files[index]
    if (!path || !isVerificationObjectPath(path, businessId)) return
    const { data, error } = await supabase.storage.from(VERIFY_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS)
    if (error || !data?.signedUrl) return
    docs[key] = {
      name: doc?.name ?? (key === 'dti' ? 'DTI certificate' : 'Business permit'),
      size: doc?.size ?? 0,
      type: doc?.type ?? 'application/octet-stream',
      ...doc,
      storagePath: path,
      signedUrl: data.signedUrl,
    }
  }))
  return { ...verification, docs }
}

/** Save a review decision to the business record and notify its owner. */
export function useSaveVerification() {
  return useCallback(async (businessId: string, verification: Verification, notification?: { tl: string; en: string }) => {
    const privateVerification = {
      ...verification,
      docs: Object.fromEntries(Object.entries(verification.docs).map(([key, doc]) => {
        if (!doc) return [key, doc]
        const { signedUrl: _signedUrl, ...storedDoc } = doc
        return [key, storedDoc]
      })),
    }
    const { error } = await supabase.rpc('set_dev_console_business_verification', {
      p_business_id: businessId,
      p_verification: privateVerification,
      p_notification: notification ?? null,
    })
    if (error) return { error: error.message }
    window.dispatchEvent(new Event(UPDATED))
    return { error: null }
  }, [])
}
