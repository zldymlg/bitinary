import { FileUp, Paperclip, ShieldCheck } from "lucide-react"
import { useEffect, useState } from "react"
import { inputBase } from "@/components/flow/Fields"
import { Button } from "@/components/ui/Button"
import { supabase } from "@/lib/supabase"
import {
  emptyVerification,
  isAllowedVerificationFile,
  isVerificationObjectPath,
  migrateVerification,
  validateVerification,
  verificationFileExtension,
  VERIFICATION_FILE_ACCEPT,
  type DocKey,
  type Verification,
} from "@/lib/verify"
import { useOnline } from "@/lib/useOnline"
import { ThemeScreen } from "@/components/onboarding/Templates"
import { useBiz } from "../store"
import { Card } from "../ui"

const BUCKET = "business-verification"
const DOCS: { key: DocKey; label: [string, string] }[] = [
  { key: "dti", label: ["Registration certificate", "Registration certificate"] },
  { key: "permit", label: ["Mayor's permit", "Mayor's permit"] },
]

type Props = {
  mode: "settings" | "setup"
  embedded?: boolean
  onBack?: () => void
  onDone?: (result: "done" | "skipped") => void
}

export function BusinessVerificationCard() {
  return <BusinessVerification mode="settings" />
}

export function BusinessVerificationSetup(props: Omit<Props, "mode">) {
  return <BusinessVerification {...props} mode="setup" />
}

function BusinessVerification({ mode, embedded, onBack, onDone }: Props) {
  const { d, set, setLocal, t, showToast } = useBiz()
  const business = d.business
  const online = useOnline()
  const [verification, setVerification] = useState<Verification>(emptyVerification)
  const [baseline, setBaseline] = useState<Verification>(emptyVerification)
  const [files, setFiles] = useState<Partial<Record<DocKey, File>>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [fetchAttempt, setFetchAttempt] = useState(0)

  useEffect(() => {
    let active = true
    const businessId = business.id
    if (!businessId) {
      setVerification(emptyVerification)
      setBaseline(emptyVerification)
      setLoading(false)
      setLoadError(null)
      return () => { active = false }
    }

    setLoading(true)
    setLoadError(null)
    setActionError(null)
    void (async () => {
      const [businessResult, privateResult] = await Promise.all([
        supabase
          .from("businesses")
          .select("verification_status,verification_method,verification_files,onsite_date")
          .eq("id", businessId)
          .maybeSingle(),
        supabase
          .from("business_verifications")
          .select("verification_data")
          .eq("business_id", businessId)
          .maybeSingle(),
      ])
      if (!active) return
      if (businessResult.error || privateResult.error) {
        setLoadError(businessResult.error?.message ?? privateResult.error?.message ?? t("Hindi ma-load ang verification.", "Could not load verification."))
        setLoading(false)
        return
      }

      const row = businessResult.data as {
        verification_status: Verification["status"]
        verification_method: Verification["method"] | null
        verification_files: string[] | null
        onsite_date: string | null
      } | null
      const saved = (privateResult.data as { verification_data?: Partial<Verification> } | null)?.verification_data
      const nextVerification = migrateVerification({
        ...saved,
        status: saved?.status ?? row?.verification_status ?? "none",
        method: row?.verification_method ?? saved?.method,
        files: row?.verification_files ?? saved?.files ?? [],
        onsiteDate: row?.onsite_date ?? saved?.onsiteDate,
      })
      setVerification(nextVerification)
      setBaseline(nextVerification)
      setLoading(false)
    })().catch((error: unknown) => {
      if (!active) return
      setLoadError(error instanceof Error ? error.message : t("Hindi ma-load ang verification.", "Could not load verification."))
      setLoading(false)
    })
    return () => { active = false }
  }, [business.id, fetchAttempt, t])

  const isLocked = verification.status === "pending" || verification.status === "verified"
  const hasUnsavedDraft = Object.keys(files).length > 0 || JSON.stringify(verification) !== JSON.stringify(baseline)
  const confirmLeave = () => !hasUnsavedDraft || window.confirm(t(
    "May hindi pa naipapadalang pagbabago at file. Itapon ang mga ito?",
    "You have unsent changes and files. Discard them?",
  ))
  const update = (patch: Partial<Verification>) => {
    setVerification((current) => ({ ...current, ...patch }))
    setErrors({})
    setActionError(null)
  }

  const chooseFile = (key: DocKey, file?: File) => {
    if (!file) return
    if (!isAllowedVerificationFile(file)) {
      setErrors((current) => ({
        ...current,
        [`${key}Doc`]: t("Pumili ng PDF o larawan hanggang 10 MB.", "Choose a PDF or image up to 10 MB."),
      }))
      return
    }
    setFiles((current) => ({ ...current, [key]: file }))
    setErrors((current) => {
      const next = { ...current }
      delete next[`${key}Doc`]
      return next
    })
  }

  const submit = async () => {
    if (saving || isLocked) return
    const businessId = business.id
    if (!businessId) {
      setActionError(t("I-save muna ang profile ng negosyo bago mag-upload.", "Save the business profile before uploading."))
      return
    }
    if (!online) {
      setActionError(t("Kailangan ng internet para ipadala ang mga dokumento.", "An internet connection is required to submit documents."))
      return
    }

    const candidate: Verification = {
      ...verification,
      method: "upload",
      registrationType: verification.registrationType ?? "dti",
      registrationNo: verification.registrationNo ?? verification.dtiNo,
      docs: {
        ...verification.docs,
        ...(files.dti ? { dti: { name: files.dti.name, size: files.dti.size, type: files.dti.type } } : {}),
        ...(files.permit ? { permit: { name: files.permit.name, size: files.permit.size, type: files.permit.type } } : {}),
      },
    }
    const nextErrors = validateVerification(candidate, t)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    setActionError(null)
    const uploaded: string[] = []
    let submitted = false
    try {
      const paths: Partial<Record<DocKey, string>> = {}
      for (const { key } of DOCS) {
        const file = files[key]
        if (file) {
          const path = `${businessId}/${crypto.randomUUID()}.${verificationFileExtension(file.type)}`
          const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
            cacheControl: "3600",
            contentType: file.type,
            upsert: false,
          })
          if (error) throw new Error(error.message)
          uploaded.push(path)
          paths[key] = path
          continue
        }

        const index = key === "dti" ? 0 : 1
        const storedPath = candidate.docs[key]?.storagePath ?? verification.files[index]
        if (storedPath && isVerificationObjectPath(storedPath, businessId)) paths[key] = storedPath
      }

      const fileRefs = [paths.dti, paths.permit]
      if (fileRefs.some((path) => !path)) {
        throw new Error(t("I-upload ang registration certificate at Mayor's permit.", "Upload both the registration certificate and Mayor's permit."))
      }
      const pFiles = fileRefs as [string, string]
      const pVerification: Verification = {
        ...candidate,
        files: pFiles,
        docs: {
          dti: {
            name: files.dti?.name ?? candidate.docs.dti?.name ?? `${candidate.registrationType?.toUpperCase() ?? "DTI"} certificate`,
            size: files.dti?.size ?? candidate.docs.dti?.size ?? 0,
            type: files.dti?.type ?? candidate.docs.dti?.type ?? "application/pdf",
            storagePath: pFiles[0],
          },
          permit: {
            name: files.permit?.name ?? candidate.docs.permit?.name ?? "Business permit",
            size: files.permit?.size ?? candidate.docs.permit?.size ?? 0,
            type: files.permit?.type ?? candidate.docs.permit?.type ?? "application/pdf",
            storagePath: pFiles[1],
          },
        },
      }
      const { data, error } = await supabase.rpc("submit_business_verification", {
        p_business_id: businessId,
        p_verification: pVerification,
        p_files: pFiles,
      })
      if (error) throw new Error(error.message)
      submitted = true

      const returned = (data as Partial<Verification> | null) ?? pVerification
      const saved = migrateVerification({ ...returned, status: returned.status ?? "pending", files: pFiles })
      setVerification(saved)
      setBaseline(saved)
      setFiles({})
      await setLocal((current) => ({
        ...current,
        business: {
          ...current.business,
          verification: { ...current.business.verification, method: "upload", files: pFiles, status: "pending" },
          status: { ...current.business.status, verify: "done" },
        },
        updated: { ...current.updated, verify: new Date().toISOString() },
      }))

      const previousPaths = verification.files.filter((path) => isVerificationObjectPath(path, businessId))
      const obsolete = previousPaths.filter((path) => !pFiles.includes(path))
      if (obsolete.length) void supabase.storage.from(BUCKET).remove(obsolete)
      showToast({ text: t("Naipadala ang verification documents.", "Verification documents submitted."), expression: "celebrating" })
      if (mode === "setup") onDone?.("done")
    } catch (error) {
      if (!submitted && uploaded.length) void supabase.storage.from(BUCKET).remove(uploaded)
      setActionError(error instanceof Error ? error.message : t("Hindi naipadala ang mga dokumento.", "Could not submit the documents."))
    } finally {
      setSaving(false)
    }
  }

  const skip = async () => {
    if (!confirmLeave()) return
    const result = await set((current) => ({
      ...current,
      business: {
        ...current.business,
        status: { ...current.business.status, verify: current.business.status.verify === "done" ? "done" : "skipped" },
      },
    }))
    if (result.error) {
      setActionError(result.error)
      return
    }
    onDone?.("skipped")
  }

  const form = (
    <div className="space-y-4">
      {loadError && <p role="alert" className="rounded-[14px] bg-danger-bg px-4 py-3 text-[14px] font-semibold text-danger">{loadError}</p>}
      {actionError && <p role="alert" className="rounded-[14px] bg-danger-bg px-4 py-3 text-[14px] font-semibold text-danger">{actionError}</p>}
      {verification.note && (
        <p role="status" className="rounded-[14px] bg-caution-bg px-4 py-3 text-[14px] text-caution">
          <b>{t("Tala ng reviewer", "Reviewer note")}:</b> {verification.note}
        </p>
      )}
      <p className="text-[14px] text-fg-2">
        {verification.status === "pending"
          ? t("Sinusuri na ng team ang mga dokumento mo.", "The team is reviewing your documents.")
          : verification.status === "verified"
            ? t("Verified na ang negosyo mo.", "Your business is verified.")
            : t("Pribado ang mga dokumento at hanggang 10 MB bawat file.", "Documents are private and limited to 10 MB each.")}
      </p>
      {loading ? (
        <p role="status" className="text-[14px] text-fg-2">{t("Kinukuha ang status…", "Loading status…")}</p>
      ) : loadError ? (
        <Button variant="secondary" onClick={() => setFetchAttempt((attempt) => attempt + 1)}>
          {t("Subukang muli", "Retry")}
        </Button>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block font-display text-[14px] font-medium">{t("Uri ng registration", "Registration type")}</span>
              <select value={verification.registrationType ?? "dti"} onChange={(event) => update({ registrationType: event.target.value as "dti" | "sec" })} className={`${inputBase} border-line`} disabled={isLocked}>
                <option value="dti">DTI</option>
                <option value="sec">SEC</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block font-display text-[14px] font-medium">{verification.registrationType === "sec" ? t("SEC registration number", "SEC registration number") : t("DTI Business Name No. (7 digit)", "DTI Business Name No. (7 digits)")}</span>
              <input inputMode={verification.registrationType === "sec" ? "text" : "numeric"} maxLength={30} value={verification.registrationNo ?? verification.dtiNo ?? ""} onChange={(event) => {
                const value = verification.registrationType === "sec" ? event.target.value : event.target.value.replace(/\D/g, "").slice(0, 7)
                update({ registrationNo: value, dtiNo: value })
              }} className={`${inputBase} border-line`} disabled={isLocked} />
              {errors.dtiNo && <span role="alert" className="mt-1 block text-[13px] text-danger">{errors.dtiNo}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block font-display text-[14px] font-medium">{t("Petsa ng registration", "Registration date")}</span>
              <input type="date" value={verification.dtiRegistered ?? ""} onChange={(event) => update({ dtiRegistered: event.target.value })} className={`${inputBase} border-line`} disabled={isLocked} />
              {errors.dtiRegistered && <span role="alert" className="mt-1 block text-[13px] text-danger">{errors.dtiRegistered}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block font-display text-[14px] font-medium">{verification.registrationType === "sec" ? t("Bisa ng rehistro (kung mayroon)", "Registration expiry (if applicable)") : t("Bisa ng DTI registration", "DTI registration expiry")}</span>
              <input type="date" value={verification.dtiValidUntil ?? ""} onChange={(event) => update({ dtiValidUntil: event.target.value })} className={`${inputBase} border-line`} disabled={isLocked} />
              {errors.dtiValidUntil && <span role="alert" className="mt-1 block text-[13px] text-danger">{errors.dtiValidUntil}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block font-display text-[14px] font-medium">{t("Permit number", "Permit number")}</span>
              <input maxLength={30} value={verification.permitNo ?? ""} onChange={(event) => update({ permitNo: event.target.value })} className={`${inputBase} border-line`} disabled={isLocked} />
              {errors.permitNo && <span role="alert" className="mt-1 block text-[13px] text-danger">{errors.permitNo}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block font-display text-[14px] font-medium">{t("Lungsod o bayan na nag-issue", "Issuing city or town")}</span>
              <input maxLength={100} value={verification.permitCity ?? ""} onChange={(event) => update({ permitCity: event.target.value })} className={`${inputBase} border-line`} disabled={isLocked} />
              {errors.permitCity && <span role="alert" className="mt-1 block text-[13px] text-danger">{errors.permitCity}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block font-display text-[14px] font-medium">{t("Petsa ng issue", "Issue date")}</span>
              <input type="date" value={verification.permitIssued ?? ""} onChange={(event) => update({ permitIssued: event.target.value })} className={`${inputBase} border-line`} disabled={isLocked} />
              {errors.permitIssued && <span role="alert" className="mt-1 block text-[13px] text-danger">{errors.permitIssued}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block font-display text-[14px] font-medium">{t("Permit valid until", "Permit valid until")}</span>
              <input type="date" value={verification.permitValidUntil ?? ""} onChange={(event) => update({ permitValidUntil: event.target.value })} className={`${inputBase} border-line`} disabled={isLocked} />
              {errors.permitValidUntil && <span role="alert" className="mt-1 block text-[13px] text-danger">{errors.permitValidUntil}</span>}
            </label>
          </div>
          {DOCS.map(({ key, label }) => {
            const selected = files[key]
            const saved = verification.docs[key]
            const value = selected?.name ?? (saved?.name?.includes("/") ? undefined : saved?.name)
            return (
              <label key={key} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[16px] border border-line px-3 py-2">
                <Paperclip size={20} className={value || saved?.storagePath ? "text-ok" : "text-link"} />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15px] font-semibold">{t(label[0], label[1])}</span>
                  <span className="block truncate text-[14px] text-fg-2">{value ?? (saved?.storagePath ? t("Na-upload", "Uploaded") : t("PDF o larawan, hanggang 10 MB", "PDF or image, up to 10 MB"))}</span>
                  {errors[`${key}Doc`] && <span role="alert" className="block text-[13px] text-danger">{errors[`${key}Doc`]}</span>}
                </span>
                {!isLocked && <span className="font-display text-[14px] font-medium text-link">{value || saved?.storagePath ? t("Palitan", "Replace") : t("Pumili", "Choose")}</span>}
                {!isLocked && <input type="file" accept={VERIFICATION_FILE_ACCEPT} className="sr-only" onChange={(event) => { chooseFile(key, event.currentTarget.files?.[0]); event.currentTarget.value = "" }} />}
              </label>
            )
          })}
          <p className="text-[13px] text-fg-2">{t("Makikita lang ng may-ari ng negosyo at authorized reviewer ang mga file.", "Only the business owner and authorized reviewers can access these files.")}</p>
        </>
      )}
    </div>
  )

  if (mode === "setup") {
    return (
      <ThemeScreen
        title={t("Permits and verification", "Permits and verification")}
        intro={t("Ipadala ang DTI o SEC registration certificate at Mayor's permit para ma-review ng team.", "Submit your DTI or SEC registration certificate and Mayor's permit for review.")}
        tag="optional"
        embedded={embedded}
        onBack={() => { if (confirmLeave()) onBack?.() }}
        onSkip={() => void skip()}
        onSave={() => void submit()}
        saveLabel={saving ? t("Ipinapadala…", "Submitting…") : t("Ipadala para ma-verify", "Submit for verification")}
        saveDisabled={loading || !!loadError || saving || isLocked || !online}
      >
        {form}
      </ThemeScreen>
    )
  }

  return (
    <Card id="verify" className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-sunken text-link dark:bg-elevated"><ShieldCheck size={20} /></span>
        <h2 className="text-h3">{t("Permit at verification", "Permits and verification")}</h2>
        <span className="ml-auto rounded-full bg-sunken px-3 py-1 text-[13px] font-medium text-fg-2">
          {verification.status === "verified" ? t("Verified", "Verified") : verification.status === "pending" ? t("Sinusuri", "In review") : verification.status === "needs-docs" || verification.status === "rejected" ? t("Kulang ang dokumento", "Needs documents") : t("Hindi pa na-verify", "Not verified")}
        </span>
      </div>
      {form}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
        <Button icon={<FileUp size={17} />} disabled={loading || !!loadError || saving || isLocked || !online || !business.id} onClick={() => void submit()}>
          {saving ? t("Ipinapadala…", "Submitting…") : verification.status === "pending" ? t("Naipadala na", "Submitted") : t("Ipadala para ma-verify", "Submit for verification")}
        </Button>
      </div>
    </Card>
  )
}
