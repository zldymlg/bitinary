export type QuickUpdateFields = {
  status: 'regular' | 'open' | 'closed'
  sold_out: boolean
  long_queue: boolean
  special: string
}

export type QuickUpdate = QuickUpdateFields & { expires_at: string }

export const emptyQuickUpdate: QuickUpdateFields = {
  status: 'regular', sold_out: false, long_queue: false, special: '',
}

export function activeQuickUpdate(update: QuickUpdate | null, now = Date.now()) {
  return update && Date.parse(update.expires_at) > now ? update : null
}

export function normalizeQuickUpdate({ status, sold_out, long_queue, special }: QuickUpdateFields): QuickUpdateFields {
  const trimmed = special.trim()
  if (Array.from(trimmed).length > 160) throw new RangeError('Maximum 160 characters.')
  return { status, sold_out, long_queue, special: trimmed }
}
