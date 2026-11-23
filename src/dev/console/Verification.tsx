import { ArrowLeft, BadgeCheck, CalendarCheck, Check, Download, FileText, RotateCcw, Search, ShieldCheck, X, ZoomIn } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useConsole, useCurrentDev } from '@/app/console'
import { useStore } from '@/app/store'
import { signVerificationDocuments, useSaveVerification, useVerifications, type VerificationRow } from '@/app/verification'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { cn } from '@/lib/cn'
import { img } from '@/lib/format'
import { daysUntil, verifyState, type DocKey, type Verification, type VerifyDoc, type VerifyState } from '@/lib/verify'
import { fmtDate, fmtRel } from './data'
import { Badge, Empty, Field, PageHead, Panel, download, field } from './ui'

const BASE = '/bitinarydev/verification'
const STATES: { id: VerifyState; label: string; tone: 'neutral' | 'ok' | 'caution' | 'danger' | 'orange' }[] = [
  { id: 'pending', label: 'Pending', tone: 'orange' },
  { id: 'needs-docs', label: 'Needs documents', tone: 'caution' },
  { id: 'rejected', label: 'Rejected', tone: 'danger' },
  { id: 'verified', label: 'Verified', tone: 'ok' },
  { id: 'expiring', label: 'Expiring', tone: 'caution' },
  { id: 'expired', label: 'Expired', tone: 'danger' },
  { id: 'none', label: 'Not submitted', tone: 'neutral' },
]
const stateMeta = (s: VerifyState) => STATES.find((x) => x.id === s)!

export function StateBadge({ v }: { v: Verification }) {
  const s = verifyState(v)
  const m = stateMeta(s)
  return <Badge tone={m.tone}>{s === 'expiring' ? `Expiring · ${daysUntil(v.permitValidUntil)}d` : m.label}</Badge>
}

/** Owner, city and display data for a verification row. */
function useRowInfo() {
  return (row: VerificationRow) => row
}

type DateField = 'submittedAt' | 'reviewedAt' | 'permitValidUntil' | 'dtiRegistered'
const DATE_FIELDS: { id: DateField; label: string }[] = [
  { id: 'submittedAt', label: 'Submitted' },
  { id: 'reviewedAt', label: 'Reviewed' },
  { id: 'permitValidUntil', label: 'Permit expiry' },
  { id: 'dtiRegistered', label: 'Registration date' },
]
const day = (x?: string) => x?.slice(0, 10) ?? ''
const ORDER: VerifyState[] = ['pending', 'needs-docs', 'expired', 'expiring', 'rejected', 'none', 'verified']

export function VerificationPage() {
  const { rows, loading } = useVerifications()
  const info = useRowInfo()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const statuses = (params.get('status')?.split(',').filter(Boolean) ?? []) as VerifyState[]
  const [q, setQ] = useState('')
  const [city, setCity] = useState('all')
  const [dateField, setDateField] = useState<DateField>('submittedAt')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState<{ key: DateField | 'default'; dir: 1 | -1 }>({ key: 'default', dir: 1 })

  const all = useMemo(() => rows.map((r) => ({ ...r, ...info(r), state: verifyState(r.v) })), [rows, info])
  const counts = Object.fromEntries(STATES.map((s) => [s.id, all.filter((r) => r.state === s.id).length]))
  const cities = [...new Set(all.map((r) => r.city))]
  const setStatuses = (list: VerifyState[]) => {
    const n = new URLSearchParams(params)
    if (list.length) n.set('status', list.join(','))
    else n.delete('status')
    setParams(n, { replace: true })
  }
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const out = all.filter((r) => {
      if (statuses.length && !statuses.includes(r.state)) return false
      if (city !== 'all' && r.city !== city) return false
      const dv = day(r.v[dateField])
      if ((from || to) && !dv) return false
      if (from && dv < from) return false
      if (to && dv > to) return false
      if (needle && ![r.name, r.owner, r.v.registrationNo, r.v.dtiNo, r.v.permitNo].join(' ').toLowerCase().includes(needle)) return false
      return true
    })
    return out.sort((a, b) => {
      if (sort.key === 'default') return ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || day(a.v.submittedAt).localeCompare(day(b.v.submittedAt))
      const x = day(a.v[sort.key])
      const y = day(b.v[sort.key])
      if (!x) return 1
      if (!y) return -1
      return x.localeCompare(y) * sort.dir
    })
  }, [all, statuses, city, dateField, from, to, q, sort])

  const exportCsv = () => {
    const head = ['business', 'owner', 'city', 'status', 'method', 'registration_type', 'registration_no', 'registration_date', 'registration_valid_until', 'permit_no', 'permit_city', 'permit_issued', 'permit_valid_until', 'submitted', 'reviewed', 'reviewer', 'note']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    download('bitinary-verification.csv', [head.join(','), ...list.map((r) => [r.name, r.owner, r.city, r.state, r.v.method, r.v.registrationType ?? 'dti', r.v.registrationNo ?? r.v.dtiNo, r.v.dtiRegistered, r.v.dtiValidUntil, r.v.permitNo, r.v.permitCity, r.v.permitIssued, r.v.permitValidUntil, day(r.v.submittedAt), day(r.v.reviewedAt), r.v.reviewer, r.v.note].map(esc).join(','))].join('\n'), 'text/csv')
  }
  const SortTh = ({ k, label }: { k: DateField; label: string }) => (
    <th className="py-3 pr-3">
      <button onClick={() => setSort((s) => ({ key: k, dir: s.key === k && s.dir === 1 ? -1 : 1 }))} className="inline-flex items-center gap-1 uppercase hover:text-fg">
        {label}
        {sort.key === k && <span aria-hidden>{sort.dir === 1 ? '↑' : '↓'}</span>}
      </button>
    </th>
  )

  return (
    <>
      <PageHead
        title="Verification"
        sub={`DTI registration and Business permit for all ${all.length} businesses · ${counts.pending} pending`}
        actions={
          <Button variant="secondary" icon={<Download size={17} />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label="Filter by status">
        <button onClick={() => setStatuses([])} aria-pressed={!statuses.length} className={cn('h-10 shrink-0 rounded-full px-4 font-display text-[14px] font-medium', !statuses.length ? 'bg-brown text-cream dark:bg-primary dark:text-ink' : 'bg-surface text-fg-2 shadow-card')}>
          All · {all.length}
        </button>
        {STATES.map((s) => {
          const on = statuses.includes(s.id)
          return (
            <button key={s.id} onClick={() => setStatuses(on ? statuses.filter((x) => x !== s.id) : [...statuses, s.id])} aria-pressed={on} className={cn('h-10 shrink-0 rounded-full px-4 font-display text-[14px] font-medium', on ? 'bg-brown text-cream dark:bg-primary dark:text-ink' : 'bg-surface text-fg-2 shadow-card')}>
              {s.label} · {counts[s.id]}
            </button>
          )
        })}
      </div>
      <Panel pad={false}>
        <div className="grid gap-3 border-b border-line p-4 md:grid-cols-2 md:p-5 xl:grid-cols-[1.4fr_1fr_1fr_0.8fr_0.8fr]">
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Business, owner, DTI or permit no." aria-label="Search verification" className={cn(field, 'pl-10')} />
          </div>
          <select aria-label="City" value={city} onChange={(e) => setCity(e.target.value)} className={field}>
            <option value="all">All cities</option>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select aria-label="Date field" value={dateField} onChange={(e) => setDateField(e.target.value as DateField)} className={field}>
            {DATE_FIELDS.map((d) => (
              <option key={d.id} value={d.id}>
                Date: {d.label}
              </option>
            ))}
          </select>
          <input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
          <input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
        </div>
        {(from || to) && (
          <p className="flex items-center gap-2 border-b border-line px-4 py-2 text-[13px] text-fg-2 md:px-5">
            {DATE_FIELDS.find((d) => d.id === dateField)!.label} {from && `from ${fmtDate(from)}`} {to && `to ${fmtDate(to)}`}
            <button onClick={() => (setFrom(''), setTo(''))} className="font-semibold text-link">
              Clear dates
            </button>
          </p>
        )}
        {list.length === 0 ? (
          <Empty title={loading ? 'Loading verification requests…' : all.length ? 'No matching businesses' : 'No verification requests yet'} body={loading ? undefined : all.length ? 'Try changing your filters or date range.' : 'Businesses with verification requests will appear here.'} />
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full text-left text-[14px]">
                <thead className="text-[12px] uppercase tracking-wide text-fg-2">
                  <tr className="border-b border-line">
                    <th className="py-3 pl-5 pr-3">Business</th>
                    <th className="py-3 pr-3">DTI no.</th>
                    <SortTh k="dtiRegistered" label="Registration date" />
                    <th className="py-3 pr-3">Permit no.</th>
                    <SortTh k="permitValidUntil" label="Permit valid until" />
                    <SortTh k="submittedAt" label="Submitted" />
                    <th className="py-3 pr-3">Status</th>
                    <SortTh k="reviewedAt" label="Reviewed" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.placeId} onClick={() => navigate(r.placeId)} className="cursor-pointer border-b border-line last:border-0 hover:bg-sunken/60 dark:hover:bg-elevated/60">
                      <td className="py-3 pl-5 pr-3">
                        <span className="flex items-center gap-3">
                          <img src={img(r.image ?? '', 96, 96)} alt="" className="h-10 w-10 shrink-0 rounded-[10px] object-cover" loading="lazy" />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{r.name}</span>
                            <span className="block truncate text-[12px] text-fg-2">
                              {r.owner} · {r.city}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="py-3 pr-3 font-mono text-[13px]">{r.v.method === 'onsite' ? <Badge>On-site</Badge> : r.v.registrationNo ?? r.v.dtiNo ?? '—'}</td>
                      <td className="py-3 pr-3 text-fg-2">{fmtDate(r.v.dtiRegistered)}</td>
                      <td className="py-3 pr-3 font-mono text-[13px]">{r.v.permitNo || '—'}</td>
                      <td className={cn('py-3 pr-3', r.state === 'expired' ? 'font-semibold text-danger' : r.state === 'expiring' ? 'font-semibold text-caution' : 'text-fg-2')}>{fmtDate(r.v.permitValidUntil)}</td>
                      <td className="py-3 pr-3 text-fg-2">{r.v.submittedAt ? fmtRel(r.v.submittedAt) : '—'}</td>
                      <td className="py-3 pr-3">
                        <StateBadge v={r.v} />
                      </td>
                      <td className="py-3 pr-5 text-fg-2">{fmtDate(r.v.reviewedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line xl:hidden">
              {list.map((r) => (
                <li key={r.placeId}>
                  <Link to={r.placeId} className="flex items-center gap-3 px-4 py-3">
                    <img src={img(r.image ?? '', 96, 96)} alt="" className="h-12 w-12 shrink-0 rounded-[12px] object-cover" loading="lazy" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[15px] font-semibold">{r.name}</span>
                      <span className="block truncate text-[13px] text-fg-2">
                        {(r.v.registrationType ?? 'dti').toUpperCase()} {r.v.registrationNo ?? r.v.dtiNo ?? '—'} · Permit until {fmtDate(r.v.permitValidUntil)}
                      </span>
                      <span className="block text-[12px] text-fg-2">{r.v.submittedAt ? `Submitted ${fmtRel(r.v.submittedAt)}` : 'Not submitted'}</span>
                    </span>
                    <StateBadge v={r.v} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </>
  )
}

/* ------------------------------ Detail ------------------------------ */

const REJECT = ['Name mismatch', 'Fake or edited document', 'Expired document', 'Not a real business', 'Other']
type Decision = 'approve' | 'docs' | 'reject' | 'reset'

function DocCard({ title, doc, onZoom }: { title: string; doc?: VerifyDoc; onZoom: (d: VerifyDoc) => void }) {
  return (
    <div className="rounded-[18px] border border-line p-3">
      <p className="mb-2 font-display text-[15px] font-semibold">{title}</p>
      {!doc ? (
        <div className="flex h-36 items-center justify-center rounded-[14px] bg-sunken text-[14px] text-fg-2 dark:bg-elevated">Not uploaded</div>
      ) : doc.signedUrl && doc.type.startsWith('image/') ? (
        <button onClick={() => onZoom(doc)} className="group relative block w-full overflow-hidden rounded-[14px]" aria-label={`View ${doc.name}`}>
          <img src={doc.signedUrl} alt={doc.name} className="h-36 w-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
            <ZoomIn size={26} />
          </span>
        </button>
      ) : doc.signedUrl && doc.type === 'application/pdf' ? (
        <a href={doc.signedUrl} target="_blank" rel="noreferrer" className="flex h-36 flex-col items-center justify-center gap-2 rounded-[14px] bg-sunken text-[14px] text-link dark:bg-elevated">
          <FileText size={28} />
          Open private PDF
        </a>
      ) : doc.signedUrl ? (
        <a href={doc.signedUrl} target="_blank" rel="noreferrer" className="flex h-36 flex-col items-center justify-center gap-2 rounded-[14px] bg-sunken text-[14px] text-link dark:bg-elevated">
          <FileText size={28} />
          Open private document
        </a>
      ) : doc.data ? (
        <button onClick={() => onZoom(doc)} className="group relative block w-full overflow-hidden rounded-[14px]" aria-label={`View ${doc.name}`}>
          <img src={doc.data} alt={doc.name} className="h-36 w-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
            <ZoomIn size={26} />
          </span>
        </button>
      ) : (
        <div className="flex h-36 flex-col items-center justify-center gap-1.5 rounded-[14px] bg-sunken text-center dark:bg-elevated">
          <FileText size={28} className="text-link" />
          <span className="font-display text-[13px] font-semibold">{doc.type.includes('pdf') ? 'PDF' : 'File'}</span>
          <span className="text-[12px] text-fg-2">Preview unavailable</span>
        </div>
      )}
      {doc && (
        <p className="mt-2 truncate text-[13px] text-fg-2">
          {doc.name}
          {doc.size ? ` · ${Math.max(1, Math.round(doc.size / 1024))} KB` : ''}
        </p>
      )}
    </div>
  )
}

export function VerificationDetail() {
  const { placeId = '' } = useParams()
  const { rows, loading } = useVerifications()
  const info = useRowInfo()
  const save = useSaveVerification()
  const { update } = useConsole()
  const dev = useCurrentDev()
  const { showToast } = useStore()
  const navigate = useNavigate()
  const idx = rows.findIndex((r) => r.placeId === placeId)
  const row = rows[idx]
  const [signedRow, setSignedRow] = useState<{ placeId: string; v: Verification } | null>(null)
  const [zoom, setZoom] = useState<VerifyDoc | null>(null)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState(REJECT[0])
  const [missing, setMissing] = useState<DocKey[]>(['permit'])
  const [manual, setManual] = useState<Record<string, boolean>>({})
  useEffect(() => {
    let active = true
    setSignedRow(null)
    if (!row) return () => { active = false }
    void signVerificationDocuments(row.placeId, row.v).then((v) => {
      if (active) setSignedRow({ placeId: row.placeId, v })
    })
    return () => { active = false }
  }, [row])
  if (loading) return <Panel><Empty title="Loading verification request…" /></Panel>
  if (!row) return <Panel><Empty title="Business not found" action={<Button onClick={() => navigate(BASE)}>Back to verification</Button>} /></Panel>
  const v = signedRow?.placeId === row.placeId ? signedRow.v : row.v
  const meta = info(row)
  const state = verifyState(v)

  const registrationNo = v.registrationNo ?? v.dtiNo ?? ''
  const auto = [
    { label: v.registrationType === 'sec' ? 'SEC registration no. is valid' : 'DTI no. has 7 digits', ok: v.registrationType === 'sec' ? /^[A-Za-z0-9][A-Za-z0-9 ./-]{3,29}$/.test(registrationNo) : /^\d{7}$/.test(registrationNo) },
    ...(v.registrationType === 'sec' && !v.dtiValidUntil ? [] : [{ label: 'Registration is still valid', ok: daysUntil(v.dtiValidUntil) >= 0 }]),
    { label: 'Business permit is not expired', ok: daysUntil(v.permitValidUntil) >= 0 },
    { label: `Permit city matches the business city (${meta.city})`, ok: !!v.permitCity && (v.permitCity.toLowerCase().includes(meta.city.toLowerCase().split(' ')[0]) || meta.city.toLowerCase().includes(v.permitCity.toLowerCase().split(' ')[0])) },
    { label: 'Permit issued before it expires', ok: !!v.permitIssued && !!v.permitValidUntil && v.permitIssued < v.permitValidUntil },
  ]
  const manualItems = ['Name on the documents matches the business name', 'Address matches the listing', 'Documents look original (not edited)']

  const decide = async () => {
    if (!decision) return
    if ((decision === 'docs' || decision === 'reject') && !note.trim()) return
    const at = new Date().toISOString()
    const status = decision === 'approve' ? 'verified' : decision === 'docs' ? 'needs-docs' : decision === 'reject' ? 'rejected' : 'none'
    const fullNote = decision === 'reject' ? `${reason}: ${note.trim()}` : note.trim() || undefined
    const next: Verification = {
      ...v,
      status,
      reviewedAt: decision === 'reset' ? undefined : at,
      reviewer: decision === 'reset' ? undefined : (dev?.name ?? 'Bitinary Team'),
      note: fullNote,
      missing: decision === 'docs' ? missing : undefined,
      submittedAt: decision === 'reset' ? undefined : v.submittedAt,
      history: [...v.history, { at, status, by: 'reviewer', byName: dev?.name, note: fullNote }],
    }
    const notif =
      decision === 'approve'
        ? { tl: 'Verified na ang negosyo mo! Makikita na ng mga biyahero ang badge.', en: 'Your business is verified! Travelers now see the badge.' }
        : decision === 'docs'
          ? { tl: `Kailangan pa namin ng ${missing.map((m) => (m === 'dti' ? 'DTI' : 'business permit')).join(' at ')}.`, en: `We need your ${missing.map((m) => (m === 'dti' ? 'DTI' : 'business permit')).join(' and ')} again.` }
          : decision === 'reject'
            ? { tl: `Hindi naaprubahan ang verification: ${reason}.`, en: `Verification not approved: ${reason}.` }
            : { tl: 'Na-reset ang verification mo. Puwede kang magpadala ulit.', en: 'Your verification was reset. You can submit again.' }
    const result = await save(row.placeId, next, notif)
    if (result.error) return showToast({ text: `Couldn’t save the verification decision. Details: ${result.error}`, expression: 'unsure' })
    update((x) => x, { area: 'Verification', action: `${decision === 'approve' ? 'Approved' : decision === 'docs' ? 'Requested documents from' : decision === 'reject' ? 'Rejected' : 'Reset'} ${meta.name}`, target: row.placeId })
    showToast({ text: decision === 'approve' ? `${meta.name} is verified.` : decision === 'docs' ? 'Document request sent to the owner.' : decision === 'reject' ? 'Verification rejected.' : 'Verification reset.', expression: decision === 'approve' ? 'celebrating' : 'pointing' })
    setDecision(null)
    setNote('')
  }

  return (
    <>
      <Link to={BASE} className="mb-3 inline-flex min-h-11 items-center gap-1.5 font-display text-[14px] font-medium text-link">
        <ArrowLeft size={17} /> All businesses
      </Link>
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <img src={img(meta.image ?? '', 160, 160)} alt="" className="h-16 w-16 rounded-[16px] object-cover" />
        <div className="min-w-0 flex-1">
          <h1 className="text-h2">{meta.name}</h1>
          <p className="text-[14px] text-fg-2">
            {meta.owner} · {meta.contact} · {meta.city}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StateBadge v={v} />
            <Badge tone="dark">Database business</Badge>
            {v.method && <Badge>{v.method === 'upload' ? 'Uploaded documents' : 'On-site check'}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {v.method === 'onsite' && state === 'pending' ? (
            <Button icon={<CalendarCheck size={17} />} onClick={() => (setDecision('approve'), setNote('On-site visit done.'))}>
              Visit done, approve
            </Button>
          ) : (
            <Button icon={<BadgeCheck size={17} />} disabled={state === 'none'} onClick={() => setDecision('approve')}>
              Approve
            </Button>
          )}
          <Button variant="secondary" disabled={state === 'none'} onClick={() => setDecision('docs')}>
            Request documents
          </Button>
          <Button variant="danger" icon={<X size={17} />} disabled={state === 'none'} onClick={() => setDecision('reject')}>
            Reject
          </Button>
          <Button variant="ghost" icon={<RotateCcw size={17} />} onClick={() => setDecision('reset')}>
            Reset
          </Button>
        </div>
      </div>
      {v.note && (
        <p className="mt-3 rounded-[14px] bg-sunken px-4 py-3 text-[14px] dark:bg-elevated">
          <b>Last note to owner:</b> {v.note}
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          {v.method === 'onsite' ? (
            <Panel title="On-site check">
              <p className="text-[15px]">
                Visit on <b>{fmtDate(v.onsiteDate)}</b>, {v.onsiteSlot === 'afternoon' ? 'afternoon' : 'morning'}.
              </p>
              <p className="mt-1 text-[13px] text-fg-2">The team checks the DTI certificate and business permit in person.</p>
            </Panel>
          ) : (
            <Panel title="Documents">
              <div className="grid gap-3 sm:grid-cols-2">
                <DocCard title={`${(v.registrationType ?? 'dti').toUpperCase()} registration certificate`} doc={v.docs.dti} onZoom={setZoom} />
                <DocCard title="Business permit" doc={v.docs.permit} onZoom={setZoom} />
              </div>
            </Panel>
          )}
          <Panel title="Details" pad={false}>
            <dl className="grid grid-cols-1 divide-y divide-line text-[14px] sm:grid-cols-2 sm:divide-y-0">
              {[
                [`${(v.registrationType ?? 'dti').toUpperCase()} registration no.`, v.registrationNo ?? v.dtiNo],
                ['Registration date', fmtDate(v.dtiRegistered)],
                ['Registration valid until', fmtDate(v.dtiValidUntil)],
                ['Permit no.', v.permitNo],
                ['Issuing city or town', v.permitCity],
                ['Permit issued', fmtDate(v.permitIssued)],
                ['Permit valid until', fmtDate(v.permitValidUntil)],
                ['Submitted', v.submittedAt ? `${fmtDate(v.submittedAt)} (${fmtRel(v.submittedAt)})` : '—'],
                ['Reviewed', v.reviewedAt ? `${fmtDate(v.reviewedAt)} by ${v.reviewer ?? 'Bitinary Team'}` : '—'],
              ].map(([k, val]) => (
                <div key={k} className="flex justify-between gap-3 px-4 py-2.5 md:px-5 sm:border-b sm:border-line">
                  <dt className="text-fg-2">{k}</dt>
                  <dd className="text-right font-medium">{val || '—'}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Checklist">
            <ul className="space-y-2">
              {auto.map((c) => (
                <li key={c.label} className="flex items-start gap-2.5 text-[14px]">
                  <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full', c.ok ? 'bg-ok text-white' : 'bg-danger text-white')}>{c.ok ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}</span>
                  {c.label}
                </li>
              ))}
              {manualItems.map((m) => (
                <li key={m}>
                  <label className="flex items-start gap-2.5 text-[14px]">
                    <input type="checkbox" checked={!!manual[m]} onChange={(e) => setManual((x) => ({ ...x, [m]: e.target.checked }))} className="mt-0.5 h-5 w-5 shrink-0 accent-[#FF6A00]" />
                    {m}
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-fg-2">Green and red checks are automatic. Tick the rest after looking at the documents.</p>
          </Panel>
          <Panel title="History" pad={false}>
            {v.history.length ? (
              <ol className="space-y-0 divide-y divide-line">
                {[...v.history].reverse().map((h, i) => (
                  <li key={i} className="flex gap-3 px-4 py-3 md:px-5">
                    <ShieldCheck size={17} className={cn('mt-0.5 shrink-0', h.by === 'reviewer' ? 'text-link' : 'text-fg-2')} />
                    <div className="min-w-0 flex-1 text-[14px]">
                      <p>
                        <b>{h.by === 'owner' ? 'Owner submitted' : `${stateMeta(h.status).label}${h.byName ? ` · ${h.byName}` : ''}`}</b>
                      </p>
                      {h.note && <p className="text-fg-2">{h.note}</p>}
                    </div>
                    <span className="shrink-0 text-[12px] text-fg-2">{fmtDate(h.at)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty title="No documents submitted yet" />
            )}
          </Panel>
        </div>
      </div>

      <Sheet open={!!zoom} onClose={() => setZoom(null)} title={zoom?.name}>
        {zoom?.signedUrl && zoom.type.startsWith('image/') ? <img src={zoom.signedUrl} alt={zoom.name} className="max-h-[70dvh] w-full rounded-[14px] object-contain" /> : zoom?.signedUrl && zoom.type === 'application/pdf' ? <iframe src={zoom.signedUrl} title={zoom.name} className="h-[70dvh] w-full rounded-[14px]" /> : zoom?.data ? <img src={zoom.data} alt={zoom.name} className="max-h-[70dvh] w-full rounded-[14px] object-contain" /> : null}
      </Sheet>
      <Sheet
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision === 'approve' ? `Approve ${meta.name}?` : decision === 'docs' ? 'Request documents' : decision === 'reject' ? 'Reject verification' : 'Reset verification?'}
        footer={
          <Button block size="lg" variant={decision === 'reject' ? 'danger' : 'primary'} disabled={(decision === 'docs' || decision === 'reject') && !note.trim()} onClick={decide}>
            {decision === 'approve' ? 'Approve' : decision === 'docs' ? 'Send request' : decision === 'reject' ? 'Reject' : 'Reset'}
          </Button>
        }
      >
        <div className="space-y-4">
          {decision === 'approve' && !auto.every((c) => c.ok) && <p className="rounded-[14px] bg-caution-bg px-3 py-2 text-[14px] font-semibold text-caution">Some automatic checks failed. Approve only if you're sure.</p>}
          {decision === 'docs' && (
            <div className="space-y-2">
              <p className="font-display text-[14px] font-medium">Which documents?</p>
              {(['dti', 'permit'] as DocKey[]).map((k) => (
                <label key={k} className="flex items-center gap-2.5 text-[15px]">
                  <input type="checkbox" checked={missing.includes(k)} onChange={(e) => setMissing((m) => (e.target.checked ? [...m, k] : m.filter((x) => x !== k)))} className="h-5 w-5 accent-[#FF6A00]" />
                  {k === 'dti' ? 'DTI certificate' : 'Business permit'}
                </label>
              ))}
            </div>
          )}
          {decision === 'reject' && (
            <div className="flex flex-wrap gap-2">
              {REJECT.map((r) => (
                <button key={r} onClick={() => setReason(r)} aria-pressed={reason === r} className={cn('h-10 rounded-full px-4 font-display text-[14px] font-medium', reason === r ? 'bg-brown text-cream dark:bg-primary dark:text-ink' : 'bg-sunken dark:bg-elevated')}>
                  {r}
                </button>
              ))}
            </div>
          )}
          {decision !== 'reset' && (
            <Field label={decision === 'approve' ? 'Note to owner (optional)' : 'Message to owner'} htmlFor="v-note" hint="Saved with the record and sent to the business owner.">
              <textarea id="v-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={3} placeholder={decision === 'docs' ? 'Malabo ang kopya ng permit. Mag-upload ng mas malinaw na litrato.' : ''} className={cn(field, 'h-auto resize-none py-2.5')} />
            </Field>
          )}
          {decision === 'reset' && <p className="text-[15px] text-fg-2">The record goes back to "Not submitted" so the owner can start again. History is kept.</p>}
        </div>
      </Sheet>
    </>
  )
}
