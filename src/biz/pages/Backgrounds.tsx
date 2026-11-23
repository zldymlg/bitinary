import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Globe,
  Image as ImageIcon,
  ImagePlus,
  Info,
  ListChecks,
  MapPin,
  Phone,
  Save,
  Store,
  X,
} from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { useLocation } from "react-router"
import type { BizThemeId, BusinessProfile } from "@/app/account"
import { ChoiceChip, SelectCard, inputBase } from "@/components/flow/Fields"
import { Facebook, Instagram } from "@/components/icons/Brand"
import {
  HoursPicker,
  MapPinDropper,
  MenuRows,
  PHLocationPicker,
  UseMyLocationButton,
} from "@/components/onboarding/BizWidgets"
import { OptTag, PriceChips, ReqTag } from "@/components/onboarding/Kit"
import { Button } from "@/components/ui/Button"
import { findPHLocality } from "@/data/philippinesLocations"
import {
  bizTypeOpts,
  getOfferingConfig,
  langOpts,
  normalizeBizType,
  normalizeMenuCategories,
  priceHint,
} from "@/data/themes"
import { cn } from "@/lib/cn"
import { isGeoPoint } from "@/lib/geo"
import { isBizPreview } from "@/lib/forced"
import { shrink } from "@/screens/personalize/TravelerThemes"
import { formatPH, validPH, PhFlag } from "@/screens/signup/Signup"
import { useBiz, useBusiness } from "../store"
import { Card, PageHeader } from "../ui"
import { BusinessAssetImage } from "../ui/BusinessAssetImage"
import { createPhoto, deletePhoto, loadPhotos, updatePhoto } from "../db/photos"
import { updateBusiness } from "../db/businesses"
import { uploadBusinessAsset } from "../db/assets"
import { planPhotoSync } from "../db/ownerPersistence"
import { StatsTabs } from "./Overview"
import { BusinessVerificationCard } from "./BusinessVerification"

type SectionId = BizThemeId
const field = cn(inputBase, "border-line")

function Field({
  label,
  error,
  children,
  optional,
}: {
  label: string
  error?: string
  children: ReactNode
  optional?: boolean
}) {
  const { t } = useBiz()
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 font-display text-[14px] font-medium">
        {label}
        {optional && (
          <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] text-fg-2 dark:bg-elevated">
            {t("Opsyonal", "Optional")}
          </span>
        )}
      </span>
      {children}
      {error && (
        <span
          role="alert"
          className="mt-1.5 block text-[14px] font-semibold text-danger"
        >
          {error}
        </span>
      )}
    </label>
  )
}

/** Each section keeps its draft until save or cancel. */
function Section<K extends keyof BusinessProfile>({
  id,
  keys,
  title,
  icon,
  required,
  validate,
  saveReady = true,
  saveOverride,
  children,
}: {
  id: SectionId
  keys: K[]
  title: string
  icon: ReactNode
  required?: boolean
  validate?: (d: Pick<BusinessProfile, K>) => Record<string, string>
  saveReady?: boolean
  saveOverride?: (
    draft: Pick<BusinessProfile, K>,
    initialDraft: Pick<BusinessProfile, K>,
    applyLocal: (overrides?: Partial<Pick<BusinessProfile, K>>) => Promise<void>,
  ) => Promise<void>
  children: (
    d: Pick<BusinessProfile, K>,
    set: (p: Partial<Pick<BusinessProfile, K>>) => void,
    e: Record<string, string>,
  ) => ReactNode
}) {
  const { d, set: setData, setLocal, t, showToast } = useBiz()
  const pick = () =>
    Object.fromEntries(
      keys.map((k) => [k, d.business[k]]),
    ) as Pick<BusinessProfile, K>
  const [draft, setDraft] = useState(pick)
  const [initialDraft, setInitialDraft] = useState(pick)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft)
  const savedValues = JSON.stringify(pick())
  useEffect(() => {
    if (dirty) return
    const next = JSON.parse(savedValues) as Pick<BusinessProfile, K>
    setDraft(next)
    setInitialDraft(next)
  }, [savedValues, dirty])
  const save = async () => {
    const e = validate?.(draft) ?? {}
    setErrors(e)
    if (Object.keys(e).length) return

    const update = (x: typeof d, overrides: Partial<Pick<BusinessProfile, K>> = {}) => ({
      ...x,
      business: {
        ...x.business,
        ...draft,
        ...overrides,
        status: { ...x.business.status, [id]: "done" },
      },
      updated: { ...x.updated, [id]: new Date().toISOString() },
    })
    setSaving(true)
    setSaveError(null)
    let saved = draft
    try {
      const applyLocal = async (overrides?: Partial<Pick<BusinessProfile, K>>) => {
        await setLocal((x) => update(x, overrides))
        saved = { ...draft, ...overrides }
      }
      if (saveOverride) {
        await saveOverride(draft, initialDraft, applyLocal)
      } else {
        const result = await setData(update)
        if (result.error) throw new Error(result.error)
      }
      setDraft(saved)
      setInitialDraft(saved)
      showToast({ text: t("Na-save!", "Saved!"), expression: "celebrating" })
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : t("Hindi na-save.", "Could not save."),
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <Card id={id} className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-sunken text-link dark:bg-elevated">
          {icon}
        </span>
        <h2 className="text-h3">{title}</h2>
        {required ? <ReqTag /> : <OptTag />}
      </div>
      <fieldset disabled={saving} className="min-w-0 space-y-4">
        {children(
          draft,
          (p) => (setDraft((x) => ({ ...x, ...p })), setErrors({})),
          errors,
        )}
      </fieldset>
      <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-4">
        {saveError && (
          <span role="alert" className="mr-auto text-[14px] font-semibold text-danger">
            {saveError}
          </span>
        )}
        {dirty && (
          <span className="mr-auto text-[14px] font-semibold text-caution">
            {t("May hindi pa nase-save", "Unsaved changes")}
          </span>
        )}
        {dirty && (
          <Button variant="ghost" disabled={saving} onClick={() => {
            const next = pick()
            setDraft(next)
            setInitialDraft(next)
            setSaveError(null)
            setErrors({})
          }}>
            {t("Kanselahin", "Cancel")}
          </Button>
        )}
        <Button icon={<Save size={17} />} disabled={!dirty || saving || !saveReady} onClick={() => void save()}>
          {saving ? t("Sine-save…", "Saving…") : t("I-save", "Save")}
        </Button>
      </div>
    </Card>
  )
}

export function Backgrounds() {
  const { t, lang } = useBiz()
  const [b] = useBusiness()
  const photoSnapshot = useRef<{
    businessId: string
    ids: string[]
    cover?: { id: string; storage_path: string }
  } | null>(null)
  const uploadedPhotoPaths = useRef(new Map<string, string>())
  const [photoSnapshotReady, setPhotoSnapshotReady] = useState(false)
  const [photoSnapshotError, setPhotoSnapshotError] = useState<string | null>(null)
  const offering = getOfferingConfig(b.type)
  const { hash } = useLocation()
  useEffect(() => {
    if (hash)
      setTimeout(
        () =>
          document
            .getElementById(hash.slice(1))
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        150,
      )
  }, [hash])
  useEffect(() => {
    let active = true
    photoSnapshot.current = null
    setPhotoSnapshotError(null)
    if (isBizPreview()) {
      setPhotoSnapshotReady(true)
      return () => { active = false }
    }
    if (!b.id) {
      setPhotoSnapshotReady(false)
      return () => { active = false }
    }
    setPhotoSnapshotReady(false)
    void loadPhotos(b.id).then((result) => {
      if (!active) return
      if (result.error || !result.data) {
        setPhotoSnapshotError(result.error ?? "The photo list could not be loaded.")
      } else {
        photoSnapshot.current = {
          businessId: b.id!,
          ids: result.data.map((photo) => photo.id),
          cover: result.data.find((photo) => photo.is_cover),
        }
      }
      setPhotoSnapshotReady(true)
    })
    return () => { active = false }
  }, [b.id])

  const savePhotos = async (
    draft: Pick<BusinessProfile, "cover" | "photos">,
    initialDraft: Pick<BusinessProfile, "cover" | "photos">,
    applyLocal: (overrides?: Partial<Pick<BusinessProfile, "cover" | "photos">>) => Promise<void>,
  ) => {
    if (isBizPreview()) {
      await applyLocal()
      return
    }
    if (!b.id) throw new Error("Save the business profile before uploading photos.")
    if (photoSnapshotError) throw new Error(photoSnapshotError)
    if (photoSnapshot.current?.businessId !== b.id)
      throw new Error("The existing photo list is still loading. Try again shortly.")

    const uploadIfNeeded = async (path: string) => {
      if (!/^(data:image\/|blob:)/i.test(path)) return path
      const cached = uploadedPhotoPaths.current.get(path)
      if (cached) return cached
      const response = await fetch(path)
      if (!response.ok) throw new Error("Could not read a selected business photo.")
      const uploaded = await uploadBusinessAsset(b.id!, await response.blob(), "image", "photos")
      uploadedPhotoPaths.current.set(path, uploaded)
      return uploaded
    }
    const coverChanged = (draft.cover ?? "") !== (initialDraft.cover ?? "")
    const [selectedCoverPath, galleryPaths] = await Promise.all([
      coverChanged && draft.cover ? uploadIfNeeded(draft.cover) : Promise.resolve(initialDraft.cover ?? ""),
      Promise.all(draft.photos.map(uploadIfNeeded)),
    ])
    const coverPath = selectedCoverPath
    const loaded = await loadPhotos(b.id)
    if (loaded.error || !loaded.data)
      throw new Error(loaded.error ?? "The existing photo list could not be loaded.")
    const current = loaded.data
    const coverRow = current.find((photo) => photo.is_cover)
    if (coverChanged) {
      const originalCover = photoSnapshot.current.cover
      if (
        (coverRow?.id !== originalCover?.id || coverRow?.storage_path !== originalCover?.storage_path) &&
        (coverRow?.storage_path ?? "") !== coverPath
      ) {
        throw new Error("The cover photo changed in another session. Reload before saving.")
      }
      if (coverPath) {
        const result = coverRow
          ? await updatePhoto(b.id, coverRow.id, { storage_path: coverPath, sort_order: -1 })
          : await createPhoto(b.id, { storage_path: coverPath, is_cover: true, sort_order: -1 })
        if (result.error || !result.data)
          throw new Error(result.error ?? "The cover photo could not be saved.")
      } else if (coverRow) {
        const result = await deletePhoto(b.id, coverRow.id)
        if (result.error) throw new Error(result.error)
      }
      const businessResult = await updateBusiness(b.id, { cover_url: coverPath || null })
      if (businessResult.error || !businessResult.data)
        throw new Error(businessResult.error ?? "The cover photo could not be saved.")
    }

    const plan = planPhotoSync(current, galleryPaths, photoSnapshot.current.ids)
    const upserts = await Promise.all([
      ...plan.keep.map(({ id, sort_order }) => updatePhoto(b.id!, id, { sort_order })),
      ...plan.create.map((photo) => createPhoto(b.id!, photo)),
    ])
    const failedUpsert = upserts.find((result) => result.error)
    if (failedUpsert?.error) throw new Error(failedUpsert.error)
    const removals = await Promise.all(plan.remove.map((id) => deletePhoto(b.id!, id)))
    const failedRemoval = removals.find((result) => result.error)
    if (failedRemoval?.error) throw new Error(failedRemoval.error)
    const refreshed = await loadPhotos(b.id)
    if (refreshed.error || !refreshed.data)
      throw new Error(refreshed.error ?? "The updated photo list could not be loaded.")
    photoSnapshot.current = {
      businessId: b.id,
      ids: refreshed.data.map((photo) => photo.id),
      cover: refreshed.data.find((photo) => photo.is_cover),
    }
    const savedPhotos = refreshed.data
      .filter((photo) => !photo.is_cover)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((photo) => photo.storage_path)
    await applyLocal({ cover: coverPath || undefined, photos: savedPhotos })
    uploadedPhotoPaths.current.clear()
  }
  const hints = Object.fromEntries(
    Object.entries(priceHint).map(([k, v]) => [k, v[lang === "en" ? 1 : 0]]),
  )
  const index: [SectionId, string][] = [
    ["basics", t("Negosyo", "Basics")],
    ["location", t("Lokasyon", "Location")],
    ["hours", t("Oras", "Opening hours")],
    ["contact", "Contact"],
    ["menu", offering.themeTitle[lang]],
    ["photos", t("Mga larawan", "Photos")],
    ["about", t("Kuwento at specialty", "About and specialties")],
    ["online", "Online"],
    ["verify", t("Permit at verification", "Permits and verification")],
  ]
  return (
    <main>
      <PageHeader
        title={t("Profile ng negosyo", "Business Profile")}
        tabs={<StatsTabs />}
      />
      <div className="grid gap-6 px-4 md:px-8 xl:grid-cols-[230px_1fr]">
        <nav
          aria-label={t("Mga seksyon", "Sections")}
          className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 xl:sticky xl:top-24 xl:mx-0 xl:h-fit xl:flex-col xl:gap-0.5 xl:overflow-visible xl:px-0"
        >
          {index.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-line px-3 text-[15px] hover:bg-sunken xl:rounded-[12px] xl:border-0"
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  b.status[id] === "done"
                    ? "bg-ok"
                    : "bg-line",
                )}
                aria-hidden
              />
              {label}
            </a>
          ))}
        </nav>
        <div className="min-w-0 space-y-4">
          <Section
            id="basics"
            keys={["name", "type", "price", "menu"]}
            title={t("Negosyo", "Basics")}
            icon={<Store size={20} />}
            required
            validate={(x) => ({
              ...(x.name.trim().length < 2 && {
                name: t("Ilagay ang pangalan.", "Enter a name."),
              }),
              ...(!x.type && { type: t("Pumili ng uri.", "Choose a type.") }),
            })}
          >
            {(x, s, e) => (
              <>
                <Field
                  label={t("Pangalan ng negosyo", "Business name")}
                  error={e.name}
                >
                  <input
                    value={x.name}
                    onChange={(ev) => s({ name: ev.target.value })}
                    className={cn(field, e.name && "border-danger")}
                  />
                </Field>
                <Field label={t("Uri", "Type")} error={e.type}>
                  <div className="flex flex-wrap gap-2">
                    {bizTypeOpts.map((o) => (
                      <ChoiceChip
                        key={o.id}
                        multi={false}
                        selected={normalizeBizType(x.type) === o.id}
                        onClick={() =>
                          s({
                            type: o.id,
                            menu: normalizeMenuCategories(x.menu, o.id),
                          })
                        }
                      >
                        {o[lang]}
                      </ChoiceChip>
                    ))}
                  </div>
                </Field>
                <Field label={t("Price range", "Price range")}>
                  <PriceChips
                    value={x.price}
                    onChange={(p) => s({ price: p })}
                    hints={hints}
                  />
                </Field>
              </>
            )}
          </Section>

          <Section
            id="location"
            keys={["address", "city", "pin"]}
            title={t("Lokasyon", "Location")}
            icon={<MapPin size={20} />}
            required
            validate={(x) => ({
              ...(x.address.trim().length < 4 && {
                address: t("Ilagay ang address.", "Enter the address."),
              }),
              ...(!findPHLocality(x.city) && {
                city: t(
                  "Pumili ng lungsod o munisipalidad.",
                  "Choose a city or municipality.",
                ),
              }),
              ...(!isGeoPoint(x.pin) && {
                pin: t("Ilagay ang pin sa mapa.", "Place the pin on the map."),
              }),
            })}
          >
            {(x, s, e) => (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <UseMyLocationButton
                    onChange={(location) =>
                      s({
                        ...(location.address
                          ? { address: location.address }
                          : {}),
                        ...(location.city ? { city: location.city } : {}),
                        pin: location.pin,
                      })
                    }
                  />
                  <Field label="Street address" error={e.address}>
                    <input
                      value={x.address}
                      onChange={(ev) => s({ address: ev.target.value })}
                      className={cn(field, e.address && "border-danger")}
                    />
                  </Field>
                  <Field
                    label={t("Lungsod o probinsya", "City or province")}
                    error={e.city}
                  >
                    <PHLocationPicker
                      value={x.city}
                      onChange={(city) => s({ city, pin: undefined })}
                      error={!!e.city}
                    />
                  </Field>
                </div>
                <Field label={t("Map pin", "Map pin")} error={e.pin}>
                  <MapPinDropper
                    value={x.pin}
                    onChange={(p) => s({ pin: p })}
                    error={!!e.pin}
                    location={x.city}
                  />
                </Field>
              </div>
            )}
          </Section>

          <Section
            id="hours"
            keys={["hours"]}
            title={t("Oras ng bukas", "Opening hours")}
            icon={<Clock size={20} />}
            required
          >
            {(x, s) => (
              <HoursPicker value={x.hours} onChange={(h) => s({ hours: h })} />
            )}
          </Section>

          <Section
            id="contact"
            keys={["contactName", "mobile", "landline"]}
            title="Contact"
            icon={<Phone size={20} />}
            required
            validate={(x) => ({
              ...(!validPH(x.mobile) && {
                mobile: t(
                  "Dapat 10 digit at nagsisimula sa 9.",
                  "Must be 10 digits starting with 9.",
                ),
              }),
            })}
          >
            {(x, s, e) => (
              <div className="grid gap-4 lg:grid-cols-3">
                <Field label={t("Contact person", "Contact person")}>
                  <input
                    value={x.contactName}
                    onChange={(ev) => s({ contactName: ev.target.value })}
                    className={field}
                  />
                </Field>
                <Field label="Mobile" error={e.mobile}>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 items-center gap-2 font-display">
                      <PhFlag /> +63
                    </span>
                    <input
                      value={formatPH(x.mobile)}
                      inputMode="numeric"
                      onChange={(ev) =>
                        s({
                          mobile: ev.target.value
                            .replace(/\D/g, "")
                            .slice(0, 10),
                        })
                      }
                      className={cn(
                        field,
                        "pl-[92px]",
                        e.mobile && "border-danger",
                      )}
                    />
                  </div>
                </Field>
                <Field label="Landline" optional>
                  <input
                    value={x.landline}
                    onChange={(ev) => s({ landline: ev.target.value })}
                    className={field}
                  />
                </Field>
              </div>
            )}
          </Section>

          <Section
            id="menu"
            keys={["menu"]}
            title={offering.sectionTitle[lang]}
            icon={<ListChecks size={20} />}
          >
            {(x, s) => (
              <MenuRows
                items={x.menu}
                onChange={(m) => s({ menu: m })}
                categories={offering.categories}
                placeholder={offering.itemPlaceholder[lang]}
                addButtonLabel={offering.addButtonLabel[lang]}
                priceLabel={offering.priceLabel[lang]}
              />
            )}
          </Section>

          <Section
            id="photos"
            keys={["cover", "photos"]}
            title={t("Mga larawan", "Photos")}
            icon={<ImageIcon size={20} />}
            saveReady={photoSnapshotReady || !!photoSnapshotError}
            saveOverride={savePhotos}
          >
            {(x, s) => (
              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <Field label="Cover">
                  <label className="relative flex aspect-[16/9] cursor-pointer items-center justify-center overflow-hidden rounded-[18px] border-2 border-dashed border-line bg-sunken focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 dark:bg-elevated">
                    {x.cover ? (
                      <BusinessAssetImage
                        src={x.cover}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex items-center gap-2 font-display text-link">
                        <ImagePlus size={20} />{" "}
                        {t("Pumili ng cover", "Choose a cover")}
                      </span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      aria-label={t("Pumili ng cover photo", "Choose cover photo")}
                      onChange={async (ev) =>
                        ev.target.files?.[0] &&
                        s({ cover: await shrink(ev.target.files[0], 1200) })
                      }
                    />
                  </label>
                </Field>
                <Field
                  label={t(
                    `Hanggang 6 na larawan (${x.photos.length}/6)`,
                    `Up to 6 photos (${x.photos.length}/6)`,
                  )}
                >
                  <div className="grid grid-cols-3 gap-2">
                    {x.photos.map((p, i) => (
                      <div
                        key={i}
                        className="relative aspect-square overflow-hidden rounded-[12px]"
                      >
                        <BusinessAssetImage
                          src={p}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => {
                            const photos = [...x.photos]
                            const previous = photos[i - 1]
                            photos[i - 1] = photos[i]
                            photos[i] = previous
                            s({ photos })
                          }}
                          aria-label={t("Ilipat nang mas maaga", "Move earlier")}
                          className="absolute bottom-1 left-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white disabled:opacity-40"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={i === x.photos.length - 1}
                          onClick={() => {
                            const photos = [...x.photos]
                            const next = photos[i + 1]
                            photos[i + 1] = photos[i]
                            photos[i] = next
                            s({ photos })
                          }}
                          aria-label={t("Ilipat nang mas huli", "Move later")}
                          className="absolute bottom-1 left-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white disabled:opacity-40"
                        >
                          <ChevronRight size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            s({ photos: x.photos.filter((_, j) => j !== i) })
                          }
                          aria-label={t("Tanggalin", "Remove")}
                          className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                    {x.photos.length < 6 && (
                      <label className="flex aspect-square cursor-pointer items-center justify-center rounded-[12px] border-2 border-dashed border-line text-link focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
                        <ImagePlus size={22} />
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="sr-only"
                          aria-label={t("Magdagdag ng mga larawan", "Add photos")}
                          onChange={async (ev) =>
                            s({
                              photos: [
                                ...x.photos,
                                ...(await Promise.all(
                                  Array.from(ev.target.files ?? [])
                                    .slice(0, 6 - x.photos.length)
                                    .map((f) => shrink(f)),
                                )),
                              ].slice(0, 6),
                            })
                          }
                        />
                      </label>
                    )}
                  </div>
                </Field>
              </div>
            )}
          </Section>

          <Section
            id="about"
            keys={["about", "specialties", "languages"]}
            title={t("Kuwento at specialty", "About and specialties")}
            icon={<Info size={20} />}
          >
            {(x, s) => (
              <>
                <Field label={t("Maikling paglalarawan", "Short description")}>
                  <textarea
                    value={x.about}
                    maxLength={150}
                    rows={3}
                    onChange={(ev) => s({ about: ev.target.value })}
                    className={cn(field, "h-auto resize-none py-3")}
                  />
                  <span className="mt-1 block text-right text-[13px] text-fg-2">
                    {x.about.length}/150
                  </span>
                </Field>
                <Field
                  label={t(
                    "Mga specialty (hiwalayin ng kuwit)",
                    "Specialties (comma separated)",
                  )}
                >
                  <input
                    value={x.specialties.join(", ")}
                    onChange={(ev) =>
                      s({
                        specialties: ev.target.value
                          .split(",")
                          .map((y) => y.trimStart()),
                      })
                    }
                    className={field}
                  />
                </Field>
                <Field label={t("Mga wikang sinasalita", "Languages spoken")}>
                  <div className="flex flex-wrap gap-2">
                    {langOpts.map((l) => (
                      <ChoiceChip
                        key={l}
                        selected={x.languages.includes(l)}
                        onClick={() =>
                          s({
                            languages: x.languages.includes(l)
                              ? x.languages.filter((y) => y !== l)
                              : [...x.languages, l],
                          })
                        }
                      >
                        {l}
                      </ChoiceChip>
                    ))}
                  </div>
                </Field>
              </>
            )}
          </Section>

          <Section
            id="online"
            keys={["links"]}
            title="Online"
            icon={<Globe size={20} />}
          >
            {(x, s) => (
              <div className="grid gap-4 md:grid-cols-2">
                {([
                  ["facebook", "Facebook", <Facebook size={18} key="f" />],
                  ["instagram", "Instagram", <Instagram size={18} key="i" />],
                  ["tiktok", "TikTok", <Globe size={18} key="t" />],
                  ["website", "Website", <Globe size={18} key="w" />],
                ] as const).map(([k, l, ic]) => (
                  <Field key={k} label={l} optional>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-link">
                        {ic}
                      </span>
                      <input
                        value={x.links[k]}
                        onChange={(ev) =>
                          s({ links: { ...x.links, [k]: ev.target.value } })
                        }
                        className={cn(field, "pl-11")}
                      />
                    </div>
                  </Field>
                ))}
              </div>
            )}
          </Section>

          <BusinessVerificationCard />

        </div>
      </div>
    </main>
  )
}
