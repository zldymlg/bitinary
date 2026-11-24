import type { Expression } from '@/components/mascot/Jimbot'

export type ChatBusinessResult = {
  kind: 'business'
  id: string
  name: string
  city: string | null
  address: string | null
  type: string | null
  priceRange: string | null
  photo: string | null
  verified: boolean
}

export type ChatItineraryResult = {
  kind: 'itinerary'
  id: string
  title: string
  subtitle: string | null
  area: string | null
  budget: number
}

export type ChatResult = ChatBusinessResult | ChatItineraryResult

/** AI contract (supabase/functions/jimbot/response-schema.json). Display fields are hydrated by UI from DB. */
export type JimbotPlaceDisplay = {
  name?: string
  city?: string | null
  address?: string | null
  photo?: string | null
  type?: string | null
  priceRange?: string | null
  lat?: number
  lng?: number
}

export type JimbotPlaceRef = JimbotPlaceDisplay & { businessId: string; reason: string | null }

export type JimbotCostState = 'listed' | 'estimated' | 'unknown'

export type JimbotItineraryStop = JimbotPlaceDisplay & {
  time: string | null
  businessId: string
  note: string | null
  estCost: number | null
  costState?: JimbotCostState
}

export type JimbotItineraryDraft = {
  title: string
  area: string | null
  days: { day: number; stops: JimbotItineraryStop[] }[]
  /** Server-added (not in the model's response schema): hotel/hostel kept out of timed stops. */
  lodgingBusinessId?: string | null
}

export type JimbotBudget = {
  currency: 'PHP'
  limit: number | null
  total: number
  perPerson: number | null
  isEstimate: boolean
  lines: { label: string; amount: number; businessId: string | null; costState?: JimbotCostState }[]
}

export type JimbotMap = { businessIds: string[]; pins?: ({ businessId: string } & JimbotPlaceDisplay)[] }

export type JimbotActionType = 'confirm_save' | 'revise_cheaper' | 'open_business' | 'open_map' | 'open_help'
export type JimbotAction = { type: JimbotActionType; label: string; businessId: string | null }

export type JimbotWarning = string

export type JimbotRefusal = { category: 'medical' | 'legal' | 'weather_forecast' | 'unrelated' | 'unsafe' }

export type Msg =
  | { id: string; role: 'user'; text: string }
  | {
      id: string
      role: 'bot'
      expression: Expression
      text: string
      quickReplies?: string[]
      results?: ChatResult[]
      places?: JimbotPlaceRef[]
      itineraryDraft?: JimbotItineraryDraft | null
      budget?: JimbotBudget | null
      map?: JimbotMap | null
      actions?: JimbotAction[]
      warnings?: JimbotWarning[]
      refusal?: JimbotRefusal | null
      retryText?: string
      feedback?: 'up' | 'down'
      feedbackError?: string
    }
