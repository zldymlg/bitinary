import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { Ajv2020 } from "ajv/dist/2020.js";
import { SYSTEM_PROMPT } from "./system_prompt.ts";
import { quickReply, searchTermsMatch, standaloneSearch } from "./latency.ts";
import {
  normalizeItineraryDraft,
  pickDiverseStops,
  type PlaceMeta,
} from "./normalize.ts";
import TOOLS from "./tools.json" with { type: "json" };
import RESPONSE_SCHEMA_RAW from "./response-schema.json" with { type: "json" };

type Json = Record<string, unknown>;

type ChatHistoryItem = {
  role?: string;
  content?: string;
};

type JimbotRequest = {
  locale?: "en" | "tl";
  message?: string;
  conversationId?: string | null;
  planningContext?: Json | null;
  explicitConfirmed?: boolean;
  history?: ChatHistoryItem[] | null;
};

type ToolContext = {
  supabase: SupabaseClient;
  userId: string | null;
  trustedBusinessIds: Set<string>;
  requestConfirmedSave: boolean;
  idempotencyKey: string | null;
  userMessage: string;
  savedItineraryId: string | null;
};

type ToolResult = {
  ok: boolean;
  code?: string;
  retryAfterMs?: number;
  message?: string;
  [key: string]: unknown;
};

const OPENCODE_MODEL = Deno.env.get("OPENCODE_MODEL") ?? "hy4-flash-free";
const OPENCODE_BASE_URL = Deno.env.get("OPENCODE_BASE_URL") ?? "https://opencode.ai/zen/go/v1";
const provider = Deno.env.get("JIMBOT_PROVIDER") === "openai" ? "openai" : "opencode";
const model = provider === "openai" ? "gpt-6-luna" : OPENCODE_MODEL;
const modelKey = Deno.env.get(provider === "openai" ? "OPENAI_API_KEY" : "OPENCODE_API_KEY");
const MAX_TOOL_ROUNDS = 2; // total model calls = 1 initial + up to 2 continuations
const EMBEDDING_API_KEY = Deno.env.get("EMBEDDING_API_KEY");
const EMBEDDING_BASE_URL = (Deno.env.get("EMBEDDING_BASE_URL") ?? "https://openrouter.ai/api/v1").replace(/\/$/, "");
const EMBEDDING_MODEL = Deno.env.get("EMBEDDING_MODEL") ?? "nvidia/nemotron-3.5-embed-1b:free";
const EMBEDDING_DIMENSIONS = 1536; // business_embeddings.embedding is vector(1536)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY.");
}

// Bundle static assets via imports — Deno.readTextFile fails under supabase functions serve
// (compile dir only has the TS entry, not sibling .md/.json files).

const TOOLS_FOR_CHAT = buildChatTools(TOOLS);
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateFinalResponse = ajv.compile<Record<string, any>>(withServerOnlyDraftFields(RESPONSE_SCHEMA_RAW));

// OpenAI SDK used as an OpenAI-compatible client for the OpenCode gateway.
const client = modelKey
  ? new OpenAI({ apiKey: modelKey, baseURL: provider === "openai" ? "https://api.openai.com/v1" : OPENCODE_BASE_URL })
  : null;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "X-Jimbot-Trace-Id, Server-Timing",
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 25;
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

const saveIdempotencyStore = new Map<
  string,
  { userId: string; createdAt: number; response: Record<string, unknown> }
>();
const IDEMPOTENCY_TTL_MS = 30 * 60_000;

const FALLBACK_RESPONSE = {
  message: "May konting aberya lang ngayon, paki-try ulit in a bit.",
  quickReplies: [],
  places: [],
  itineraryDraft: null,
  budget: null,
  map: { businessIds: [] },
  actions: [],
  warnings: ["Temporary issue while planning. Try again shortly."],
  refusal: null,
};

function requestTiming() {
  const started = performance.now();
  const traceId = crypto.randomUUID();
  const durations: Record<string, number> = {};
  const events: string[] = [];
  const usage: { input: number; output: number; cached?: number }[] = [];
  let modelCalls = 0;
  return {
    events,
    async measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
      const start = performance.now();
      try {
        return await operation();
      } finally {
        durations[name] = (durations[name] ?? 0) + Math.round(performance.now() - start);
      }
    },
    async complete(messages: ChatMessage[], tools: boolean, headers: Record<string, string>) {
      const params = {
        model,
        messages: messages as any,
        ...(tools ? { tools: TOOLS_FOR_CHAT as any } : {}),
      };
      const response = await this.measure(`model_${++modelCalls}`, () => provider === "openai"
        // SDK v4 predates the "none" reasoning effort accepted by this endpoint.
        ? client!.post<typeof params & { reasoning_effort: "none" }, OpenAI.ChatCompletion>(
          "/chat/completions", { body: { ...params, reasoning_effort: "none" } }
        )
        : client!.chat.completions.create(params, { headers }));
      if (response.usage) {
        usage.push({
          input: response.usage.prompt_tokens,
          output: response.usage.completion_tokens,
          cached: response.usage.prompt_tokens_details?.cached_tokens,
        });
      }
      return response;
    },
    respond(body: unknown, status = 200, headers: Record<string, string> = {}, outcome = "reply") {
      durations.total = Math.round(performance.now() - started);
      console.log(JSON.stringify({
        event: "jimbot_timing", traceId, provider, model, status, modelCalls, durations, usage, events,
        outcome: status >= 400 ? "http_error" : body === FALLBACK_RESPONSE ? "fallback" : outcome,
      }));
      return jsonResponse(body, status, {
        ...headers,
        "X-Jimbot-Trace-Id": traceId,
        "Server-Timing": Object.entries(durations).map(([key, ms]) => `${key};dur=${ms}`).join(", "),
      });
    },
  };
}

type RequestTiming = ReturnType<typeof requestTiming>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  const timing = requestTiming();
  try {
    return await handleRequest(req, timing);
  } catch {
    return timing.respond(FALLBACK_RESPONSE);
  }
});

async function handleRequest(req: Request, timing: RequestTiming) {
  const jsonResponse = timing.respond;
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const rate = checkRateLimit(req);
  if (!rate.ok) {
    return jsonResponse(
      {
        ...FALLBACK_RESPONSE,
        warnings: ["Masyadong sunod-sunod ang requests. Sandali lang then try ulit."],
      },
      429,
      { "Retry-After": String(rate.retryAfterSeconds ?? 10) },
    );
  }

  let body: JimbotRequest;
  try {
    body = (await req.json()) as JimbotRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body?.message || typeof body.message !== "string") {
    return jsonResponse({ error: "Missing required field: message" }, 400);
  }

  if (body.explicitConfirmed !== true) {
    const greeting = quickReply(body.message, body.locale);
    if (greeting) {
      return jsonResponse({ ...FALLBACK_RESPONSE, message: greeting, warnings: [] }, 200, {}, "greeting");
    }
  }

  const bearerToken = getBearerToken(req.headers.get("Authorization"));
  const supabase = createSupabaseClient(bearerToken);
  const userId = await timing.measure("auth", () => getUserId(supabase));

  // OpenCode Go routes by conversation and needs a distinct user agent.
  const modelRequestHeaders = {
    "User-Agent": "bitinary-jimbot/1.0",
    "x-opencode-session":
      typeof body.conversationId === "string" && body.conversationId.trim()
        ? body.conversationId.trim()
        : `jimbot-${userId ?? "anon"}`,
  };

  const idempotencyKey = req.headers.get("x-idempotency-key");
  const trustedBusinessIds = new Set<string>();
  // Seed from client planningContext (last draft/places), then re-verify live+verified in DB.
  const contextCandidateIds = collectBusinessIds(body.planningContext ?? {});
  if (contextCandidateIds.length > 0) {
    for (const id of await timing.measure("context", () => fetchVerifiedBusinessIdSet(supabase, contextCandidateIds))) {
      trustedBusinessIds.add(id);
    }
  }

  const toolContext: ToolContext = {
    supabase,
    userId,
    trustedBusinessIds,
    requestConfirmedSave: body.explicitConfirmed === true,
    idempotencyKey: idempotencyKey ?? null,
    userMessage: body.message,
    savedItineraryId: null,
  };

  // Deterministic save: don't rely on the model calling save_itinerary.
  if (body.explicitConfirmed === true) {
    const saved = await saveFromPlanningContext(body.planningContext ?? null, toolContext);
    if (saved.ok && typeof saved.itineraryId === "string") {
      const ctx = body.planningContext ?? {};
      return jsonResponse({
        message: "Saved na ang itinerary mo! Tingnan mo sa itinerary page.",
        quickReplies: ["Mag-plan ulit", "Tingnan ang budget"],
        places: Array.isArray((ctx as any).places) ? (ctx as any).places : [],
        itineraryDraft: (ctx as any).itineraryDraft ?? null,
        budget: (ctx as any).budget ?? null,
        map: (ctx as any).map ?? { businessIds: [] },
        actions: [],
        warnings: [],
        refusal: null,
        savedItineraryId: saved.itineraryId,
      }, 200);
    }
    return jsonResponse({
      message: saved.message ?? "Hindi ko ma-save ang itinerary ngayon. Subukan ulit.",
      quickReplies: ["Subukan ulit", "Mag-plan ulit"],
      places: [],
      itineraryDraft: (body.planningContext as any)?.itineraryDraft ?? null,
      budget: (body.planningContext as any)?.budget ?? null,
      map: (body.planningContext as any)?.map ?? { businessIds: [] },
      actions: [{ type: "confirm_save", label: "I-save ulit", businessId: null }],
      warnings: [saved.message ?? "Save failed"],
      refusal: null,
    }, 200);
  }

  if (!client) {
    console.error("jimbot: model credential missing", provider);
    return jsonResponse(FALLBACK_RESPONSE, 200);
  }

  try {
    const messages = buildChatMessages(body);

    let response = await timing.complete(messages, true, modelRequestHeaders);

    let earlyPlan: Record<string, unknown> | null = null;
    let directSearch: Record<string, unknown> | null = null;
    // Skip early synth on save confirms (handled above); keep for normal plan asks.
    const wantsPlan = looksLikePlanRequest(body.message);

    for (let i = 0; i < MAX_TOOL_ROUNDS; i += 1) {
      const assistantMessage = response.choices?.[0]?.message;
      const calls = assistantMessage?.tool_calls ?? [];
      if (calls.length === 0) {
        break;
      }

      messages.push({
        role: "assistant",
        content: assistantMessage.content ?? null,
        tool_calls: calls,
      } as any);
      for (const call of calls) {
        const args = parseToolArgs(call.function?.arguments);
        const direct = i === 0 && calls.length === 1 &&
          call.function?.name === "search_verified_businesses" &&
          !!args && standaloneSearch(args, body.message);
        const toolResult = await timing.measure("tools", () =>
          runToolCall(call.function?.name, args, toolContext, timing, direct)
        );
        if (direct && !toolResult.ok) return jsonResponse(FALLBACK_RESPONSE);
        if (direct && toolResult.exact === true && Array.isArray(toolResult.businesses)) {
          const places = toolResult.businesses.map(({ businessId }: { businessId: string }) => ({ businessId, reason: null }));
          const message = places.length
            ? (body.locale === "en" ? "Here are the verified places I found." : "Eto ang mga verified na lugar na nahanap ko.")
            : (body.locale === "en" ? "No verified places matched. Try another city or category?" : "Walang verified na tugma. Subukan natin ang ibang lungsod o kategorya?");
          directSearch = { ...FALLBACK_RESPONSE, message, places, warnings: [] };
          break;
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(toolResult),
        } as any);
      }
      if (directSearch) break;

      // Prefer correctness + latency: once search returned enough places for a plan, synthesize locally.
      if (wantsPlan && toolContext.trustedBusinessIds.size >= 3) {
        console.error(
          `jimbot: early synthesize after tools (trusted=${toolContext.trustedBusinessIds.size})`,
        );
        earlyPlan = await timing.measure("draft", () => buildFallbackPlanFromTrustedIds(supabase, toolContext, body.message));
        break;
      }

      // Last continuation: omit tools so the model must emit structured JSON (still within 3 calls).
      const isLastRound = i === MAX_TOOL_ROUNDS - 1;
      if (isLastRound) {
        console.error("jimbot: tool loop final round, forcing structured output without tools");
        messages.push({
          role: "user",
          content:
            "Stop calling tools. Return the final jimbot_response JSON now using only verified business IDs from tool results. Include itineraryDraft, budget, map, and confirm_save when this is a plan request.",
        });
      }

      response = await timing.complete(messages, !isLastRound, modelRequestHeaders);
    }

    let parsed = directSearch ?? earlyPlan ?? parseStructuredResponse(response);
    if (!parsed && toolContext.trustedBusinessIds.size > 0) {
      console.error("jimbot: synthesizing plan from trusted tool IDs after parse miss");
      parsed = await timing.measure("draft", () => buildFallbackPlanFromTrustedIds(supabase, toolContext, body.message));
    }
    if (!parsed) {
      console.error("jimbot: failed to parse structured response", {
        finishReason: response.choices?.[0]?.finish_reason,
        toolCalls: (response.choices?.[0]?.message?.tool_calls ?? []).map(
          (call: any) => call?.function?.name,
        ),
        trustedCount: toolContext.trustedBusinessIds.size,
      });
      return jsonResponse(FALLBACK_RESPONSE, 200);
    }

    const sanitized = await timing.measure("normalize", () =>
      sanitizeAndRevalidateBusinessIds(parsed, supabase, toolContext, directSearch !== null)
    );
    if (directSearch && Array.isArray(directSearch.places) && directSearch.places.length > 0 && sanitized.places.length === 0) {
      return jsonResponse(FALLBACK_RESPONSE);
    }
    if (!validateFinalResponse(sanitized)) {
      console.error("jimbot: schema validation failed", validateFinalResponse.errors);
      return jsonResponse(FALLBACK_RESPONSE, 200);
    }

    if (toolContext.savedItineraryId) {
      (sanitized as any).savedItineraryId = toolContext.savedItineraryId;
    }
    if (sanitized.refusal) {
      sanitized.actions = [
        ...(Array.isArray(sanitized.actions) ? sanitized.actions : []),
        { type: "open_help", label: "Kailangan ng tao?", businessId: null },
      ];
    }
    return jsonResponse(sanitized, 200, {}, directSearch ? "recommendation" : sanitized.refusal ? "refusal" : "reply");
  } catch (error) {
    console.error("jimbot: model loop failed", error instanceof Error ? error.name : "unknown");
    return jsonResponse(FALLBACK_RESPONSE, 200);
  }
}

function createSupabaseClient(accessToken: string | null): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function getUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }
  return data.user.id;
}

function getBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function checkRateLimit(req: Request): { ok: boolean; retryAfterSeconds?: number } {
  const key = req.headers.get("x-forwarded-for") ?? "unknown";
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || now - existing.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - existing.windowStart);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
  return { ok: true };
}

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: unknown;
  tool_call_id?: string;
};

function buildChatMessages(body: JimbotRequest): ChatMessage[] {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\n## Output schema\n\nReply with only JSON that validates against this JSON Schema. No prose, no markdown fences.\n\n${JSON.stringify(RESPONSE_SCHEMA_RAW)}`,
    },
  ];

  if (Array.isArray(body.history)) {
    for (const item of body.history.slice(-12)) {
      if (!item || typeof item.content !== "string") continue;
      if (item.role !== "user" && item.role !== "assistant") continue;
      messages.push({ role: item.role, content: item.content });
    }
  }

  const metadata: Json = {
    conversationId: body.conversationId ?? null,
    planningContext: body.planningContext ?? null,
    explicitConfirmed: body.explicitConfirmed === true,
  };

  messages.push({
    role: "user",
    content: `User message: ${body.message}\n\nRuntime context JSON:\n${JSON.stringify(metadata, (key, value) =>
      key === "photo" || key === "pins" ? undefined : value
    )}`,
  });

  return messages;
}

function parseToolArgs(raw: string | undefined): Record<string, unknown> | null {
  try {
    const value = raw ? JSON.parse(raw) : {};
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

async function runToolCall(name: string | undefined, args: Record<string, unknown> | null, context: ToolContext, timing: RequestTiming, strictSearch: boolean): Promise<ToolResult> {
  if (!args) return { ok: false, code: "invalid_argument", message: "Invalid JSON arguments" };
  switch (name) {
    case "search_verified_businesses":
      return await timing.measure("search", () => searchVerifiedBusinesses(args, context, timing, strictSearch));
    case "get_business_details":
      return await getBusinessDetails(args, context);
    case "get_user_preferences":
      return await getUserPreferences(args, context);
    case "get_saved_itineraries":
      return await getSavedItineraries(args, context);
    case "build_itinerary_draft":
      return await buildItineraryDraft(args, context);
    case "show_map_points":
      return await showMapPoints(args, context);
    case "save_itinerary":
      return await saveItinerary(args, context);
    default:
      return { ok: false, code: "invalid_argument", message: "Unknown tool name" };
  }
}

const BUSINESS_TYPE_ALIASES: Record<string, string[]> = {
  kainan: ["kainan", "restaurant", "food", "eatery", "carinderia", "dining"],
  kapihan: ["kapihan", "cafe", "coffee", "coffee shop"],
  pasyalan: ["pasyalan", "attraction", "park", "tour", "museum", "sightseeing"],
  resort: ["resort", "hotel", "staycation"],
};

function businessTypePatterns(raw: string): string[] {
  const needle = raw.trim().toLowerCase();
  if (!needle) return [];
  for (const aliases of Object.values(BUSINESS_TYPE_ALIASES)) {
    if (aliases.some((alias) => needle.includes(alias) || alias.includes(needle))) {
      return aliases;
    }
  }
  return [needle];
}

/** Nemotron returns 2048 dims; the vector column is 1536. Truncate + re-L2-normalize. */
function fitEmbedding(embedding: unknown): number[] | null {
  if (!Array.isArray(embedding) || embedding.length < EMBEDDING_DIMENSIONS) return null;
  const vector = (embedding as number[]).slice(0, EMBEDDING_DIMENSIONS);
  const norm = Math.sqrt(vector.reduce((sum, n) => sum + n * n, 0));
  if (!Number.isFinite(norm) || norm === 0) return null;
  return vector.map((n) => n / norm);
}

async function embedQueryText(text: string): Promise<number[] | "timeout" | null> {
  if (!EMBEDDING_API_KEY || !text.trim()) return null;
  const signal = AbortSignal.timeout(1000);
  try {
    const res = await fetch(`${EMBEDDING_BASE_URL}/embeddings`, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${EMBEDDING_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 2000),
      }),
    });
    if (!res.ok) {
      console.error("jimbot: embedding HTTP", res.status);
      return null;
    }
    const json = await res.json();
    const embedding = fitEmbedding(json?.data?.[0]?.embedding);
    if (!embedding) console.error("jimbot: embedding dimensions mismatch, using ilike fallback");
    return embedding;
  } catch {
    if (signal.aborted) return "timeout";
    console.error("jimbot: embedding failed");
    return null;
  }
}

function mapBusinessRows(rows: any[], context: ToolContext) {
  return rows.map((row) => {
    const businessId = String(row.id);
    context.trustedBusinessIds.add(businessId);
    return {
      businessId,
      name: row.name,
      businessType: row.business_type,
      area: row.city,
      priceRange: row.price_range,
      coordinates:
        row.latitude != null && row.longitude != null
          ? { latitude: row.latitude, longitude: row.longitude }
          : null,
    };
  });
}

async function searchVerifiedBusinesses(args: Record<string, unknown>, context: ToolContext, timing: RequestTiming, strict: boolean): Promise<ToolResult> {
  const area = typeof args.area === "string" ? args.area.trim() : null;
  const query = typeof args.query === "string" ? args.query.trim() : null;
  const businessType = typeof args.businessType === "string" ? args.businessType.trim() : null;
  const maxResults = typeof args.maxResults === "number" ? Math.min(Math.max(args.maxResults, 1), 10) : 8;

  if (!area) {
    return { ok: false, code: "need_area", message: "area is required; ask the user which city" };
  }

  // Hybrid path: city filter + vector rank when embeddings exist.
  const phrase = [area, businessType, query].filter(Boolean).join(" ");
  const embedding = query && EMBEDDING_API_KEY ? await timing.measure("embedding", () => embedQueryText(phrase)) : null;
  if (embedding === "timeout") timing.events.push("embedding_timeout");
  if (Array.isArray(embedding)) {
    const { data: hybrid, error: hybridError } = await context.supabase.rpc("search_businesses_hybrid", {
      p_area: area,
      p_query_embedding: embedding,
      p_limit: maxResults,
    });
    if (!hybridError && Array.isArray(hybrid) && hybrid.length > 0) {
      let rows = hybrid as any[];
      if (businessType) {
        const patterns = businessTypePatterns(businessType);
        const typed = rows.filter((row) => {
          const t = String(row.business_type ?? "").toLowerCase();
          return patterns.some((p) => t.includes(p.toLowerCase()));
        });
        if (strict || typed.length) rows = typed;
      }
      if (strict && query) {
        rows = rows.filter((row) => searchTermsMatch(query, row.name ?? "", row.about ?? "", (row.specialties ?? []).join(" ")));
      }
      if (!strict || rows.length) {
        return { ok: true, exact: strict, businesses: mapBusinessRows(rows.slice(0, maxResults), context), rankedBy: "embedding" };
      }
    }
    if (hybridError) console.error("jimbot: hybrid search fallback", hybridError.message);
  }
  if (query && EMBEDDING_API_KEY) timing.events.push("keyword_fallback");

  // Keyword fallback: city + live + verified, then filter type/query in memory.
  const { data, error } = await context.supabase
    .from("businesses")
    .select("id,name,business_type,price_range,city,latitude,longitude,about,specialties")
    .eq("live", true)
    .eq("verification_status", "verified")
    .ilike("city", `%${area}%`)
    .limit(40);

  if (error) {
    return { ok: false, code: "tool_unavailable", message: "Failed to search businesses" };
  }

  let rows = data ?? [];
  if (businessType) {
    const patterns = businessTypePatterns(businessType);
    const typed = rows.filter((row) => {
      const t = String(row.business_type ?? "").toLowerCase();
      return patterns.some((p) => t.includes(p.toLowerCase()));
    });
    if (strict || typed.length) rows = typed;
  }
  if (query && strict) {
    rows = rows.filter((row) => searchTermsMatch(query, row.name ?? "", row.about ?? "", (row.specialties ?? []).join(" ")));
  } else if (query) {
    const escaped = query.replace(/[^\p{L}\p{N}\s'-]/gu, " ").trim().toLowerCase();
    if (escaped) {
      const tokens = escaped.split(/\s+/).filter(Boolean);
      const matched = rows.filter((row) => {
        const hay = `${row.name ?? ""} ${row.about ?? ""} ${(row.specialties ?? []).join(" ")}`.toLowerCase();
        return tokens.every((tok) => hay.includes(tok));
      });
      if (matched.length) rows = matched;
    }
  }

  return {
    ok: true,
    exact: strict && (rows.length > 0 || (data?.length ?? 0) < 40),
    businesses: mapBusinessRows(rows.slice(0, maxResults), context),
    rankedBy: "ilike",
  };
}

async function getBusinessDetails(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
  const businessId = typeof args.businessId === "string" ? args.businessId : null;
  if (!businessId) {
    return { ok: false, code: "invalid_argument", message: "businessId is required" };
  }
  if (!context.trustedBusinessIds.has(businessId)) {
    return { ok: false, code: "not_found", message: "businessId not in current tool context" };
  }

  const { data, error } = await context.supabase
    .from("businesses")
    .select("id,name,address,city,business_type,price_range,latitude,longitude")
    .eq("id", businessId)
    .eq("live", true)
    .eq("verification_status", "verified")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, code: "not_found", message: "Business not found or unavailable" };
  }

  const { data: hoursData } = await context.supabase
    .from("business_hours")
    .select("day_of_week,opens_at,closes_at,is_closed,all_day")
    .eq("business_id", businessId)
    .order("day_of_week", { ascending: true });

  return {
    ok: true,
    business: {
      businessId: data.id,
      name: data.name,
      type: data.business_type,
      address: data.address,
      area: data.city,
      priceRange: data.price_range,
      coordinates:
        data.latitude != null && data.longitude != null
          ? { latitude: data.latitude, longitude: data.longitude }
          : null,
      hours: hoursData ?? [],
    },
  };
}

async function getUserPreferences(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
  if (args.consentGranted !== true) {
    return { ok: false, code: "forbidden", message: "Consent is required to read preferences" };
  }
  if (!context.userId) {
    return { ok: false, code: "unauthenticated", message: "Sign in is required" };
  }

  const { data, error } = await context.supabase
    .from("traveler_preferences")
    .select("daily_budget,meal_budget,foods,diet,interests,companions,transport,pace,needs")
    .eq("user_id", context.userId)
    .maybeSingle();

  if (error) {
    return { ok: false, code: "tool_unavailable", message: "Failed to load preferences" };
  }

  return { ok: true, preferences: data ?? null };
}

async function getSavedItineraries(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
  if (!context.userId) {
    return { ok: false, code: "unauthenticated", message: "Sign in is required" };
  }

  const area = typeof args.area === "string" ? args.area.trim() : null;
  const maxResults = typeof args.maxResults === "number" ? Math.min(Math.max(args.maxResults, 1), 10) : 5;

  let query = context.supabase
    .from("itineraries")
    .select("id,title,area,budget,created_at")
    .eq("user_id", context.userId)
    .order("created_at", { ascending: false })
    .limit(maxResults);

  if (area) {
    query = query.ilike("area", `%${area}%`);
  }

  const { data: itineraries, error } = await query;
  if (error) {
    return { ok: false, code: "tool_unavailable", message: "Failed to load saved itineraries" };
  }

  const itineraryIds = (itineraries ?? []).map((it) => it.id);
  const { data: stops } = itineraryIds.length
    ? await context.supabase
        .from("itinerary_stops")
        .select("itinerary_id,business_id,stop_time,kind,cost,note,sort_order")
        .in("itinerary_id", itineraryIds)
        .order("sort_order", { ascending: true })
    : { data: [] as any[] };

  const candidateBusinessIds = new Set<string>();
  for (const stop of stops ?? []) {
    if (stop.business_id) candidateBusinessIds.add(String(stop.business_id));
  }

  const verifiedBusinessIds = await fetchVerifiedBusinessIdSet(context.supabase, [...candidateBusinessIds]);
  for (const id of verifiedBusinessIds) {
    context.trustedBusinessIds.add(id);
  }

  const stopsByItinerary = new Map<string, unknown[]>();
  for (const stop of stops ?? []) {
    if (!stop.business_id || !verifiedBusinessIds.has(String(stop.business_id))) {
      continue;
    }
    const list = stopsByItinerary.get(stop.itinerary_id) ?? [];
    list.push({
      businessId: stop.business_id,
      stopTime: stop.stop_time,
      kind: stop.kind,
      costPhp: Number(stop.cost ?? 0),
      note: stop.note ?? null,
    });
    stopsByItinerary.set(stop.itinerary_id, list);
  }

  return {
    ok: true,
    itineraries: (itineraries ?? []).map((it) => ({
      itineraryId: it.id,
      title: it.title,
      area: it.area,
      budgetPhp: Number(it.budget ?? 0),
      stops: stopsByItinerary.get(it.id) ?? [],
    })),
  };
}

async function buildItineraryDraft(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
  const area = typeof args.area === "string" ? args.area.trim() : "";
  const days = typeof args.days === "number" ? Math.min(Math.max(args.days, 1), 14) : 1;
  const budgetPhp =
    args.budgetPhp == null ? null : typeof args.budgetPhp === "number" ? Math.max(0, args.budgetPhp) : null;
  const businessIds = Array.isArray(args.businessIds)
    ? args.businessIds.filter((id): id is string => typeof id === "string")
    : [];

  if (!area || businessIds.length === 0) {
    return { ok: false, code: "invalid_argument", message: "area and businessIds are required" };
  }

  for (const id of businessIds) {
    if (!context.trustedBusinessIds.has(id)) {
      return { ok: false, code: "invalid_argument", message: "All businessIds must be from trusted tool results" };
    }
  }

  const verifiedBusinessIds = await fetchVerifiedBusinessIdSet(context.supabase, businessIds);
  const validIds = businessIds.filter((id) => verifiedBusinessIds.has(id));
  if (validIds.length === 0) {
    return { ok: false, code: "not_found", message: "No valid verified business IDs" };
  }

  const placesMeta = await fetchPlaceMeta(context.supabase, validIds);
  if (placesMeta.length === 0) {
    return { ok: false, code: "tool_unavailable", message: "Failed to load businesses for draft" };
  }

  const userHints = parsePlanHints(context.userMessage);
  const result = normalizeItineraryDraft({
    draft: {
      title: `${days}-Day ${area} Plan`,
      area,
      days: [{
        day: 1,
        stops: validIds.map((id) => ({ time: null, businessId: id, note: null, estCost: null })),
      }],
    },
    placesMeta,
    hints: { ...userHints, days, budgetPhp: budgetPhp ?? userHints.budgetPhp },
  });

  return {
    ok: true,
    draft: result.draft,
    budget: {
      ...result.budgetPatch,
      overBudget: result.budgetPatch.limit != null && result.budgetPatch.total > result.budgetPatch.limit,
    },
    warnings: result.warnings,
  };
}

async function showMapPoints(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
  const businessIds = Array.isArray(args.businessIds)
    ? args.businessIds.filter((id): id is string => typeof id === "string")
    : [];

  if (businessIds.length === 0) {
    return { ok: false, code: "invalid_argument", message: "businessIds are required" };
  }

  for (const id of businessIds) {
    if (!context.trustedBusinessIds.has(id)) {
      return { ok: false, code: "invalid_argument", message: "All businessIds must be from trusted tool results" };
    }
  }

  const { data, error } = await context.supabase
    .from("businesses")
    .select("id,name,latitude,longitude")
    .in("id", businessIds)
    .eq("live", true)
    .eq("verification_status", "verified")
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (error) {
    return { ok: false, code: "tool_unavailable", message: "Failed to load map points" };
  }

  return {
    ok: true,
    points: (data ?? []).map((row) => ({
      businessId: row.id,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
    })),
  };
}

type NormalizedSaveStop = {
  businessId: string;
  stopTime: string;
  kind: string;
  costPhp: number;
  note: string | null;
};

async function persistItinerary(
  context: ToolContext,
  input: { title: string; area: string; budgetPhp: number; stops: NormalizedSaveStop[] },
): Promise<ToolResult> {
  if (!context.userId) {
    return { ok: false, code: "unauthenticated", message: "Mag-sign in muna para ma-save ang itinerary." };
  }
  if (!input.title || !input.area || input.stops.length === 0) {
    return { ok: false, code: "invalid_argument", message: "Walang draft na puwedeng i-save. Mag-plan muna." };
  }

  for (const stop of input.stops) {
    if (!stop.businessId || !context.trustedBusinessIds.has(stop.businessId)) {
      return { ok: false, code: "invalid_argument", message: "Stop businessId is not trusted" };
    }
  }

  const verifiedBusinessIds = await fetchVerifiedBusinessIdSet(
    context.supabase,
    input.stops.map((s) => s.businessId),
  );
  if (verifiedBusinessIds.size !== input.stops.length) {
    return { ok: false, code: "invalid_argument", message: "Some businesses are no longer valid verified listings" };
  }

  const idempotencyKey = context.idempotencyKey?.trim();
  cleanupIdempotencyStore();
  if (idempotencyKey) {
    const prior = saveIdempotencyStore.get(idempotencyKey);
    if (prior && prior.userId === context.userId) {
      return { ok: true, deduped: true, ...prior.response };
    }
  }

  const businessNames = await fetchBusinessNames(context.supabase, [...verifiedBusinessIds]);

  const { data: itinerary, error: itineraryError } = await context.supabase
    .from("itineraries")
    .insert({
      user_id: context.userId,
      title: input.title,
      area: input.area,
      budget: input.budgetPhp,
      is_saved: true,
    })
    .select("id,title,area,budget,created_at")
    .single();

  if (itineraryError || !itinerary) {
    console.error("jimbot: itinerary insert failed", itineraryError?.message);
    return { ok: false, code: "internal_error", message: "Failed to save itinerary" };
  }

  const stopRows = input.stops.map((stop, index) => ({
    itinerary_id: itinerary.id,
    business_id: stop.businessId,
    stop_time: stop.stopTime || `${String(9 + index * 2).padStart(2, "0")}:00`,
    name: businessNames.get(stop.businessId) ?? "Unknown",
    kind: stop.kind || "stop",
    cost: stop.costPhp,
    note: stop.note,
    sort_order: index,
  }));

  const { error: stopsError } = await context.supabase.from("itinerary_stops").insert(stopRows);
  if (stopsError) {
    console.error("jimbot: itinerary_stops insert failed", stopsError.message);
    await context.supabase.from("itineraries").delete().eq("id", itinerary.id).eq("user_id", context.userId);
    return { ok: false, code: "internal_error", message: "Failed to save itinerary stops" };
  }

  const responsePayload = {
    itineraryId: itinerary.id,
    title: itinerary.title,
    area: itinerary.area,
    budgetPhp: Number(itinerary.budget ?? 0),
    stopsSaved: stopRows.length,
  };

  if (idempotencyKey) {
    saveIdempotencyStore.set(idempotencyKey, {
      userId: context.userId,
      createdAt: Date.now(),
      response: responsePayload,
    });
  }

  context.savedItineraryId = String(itinerary.id);
  return { ok: true, ...responsePayload };
}

/** Save the client's last draft without requiring the model to call save_itinerary. */
async function saveFromPlanningContext(
  planningContext: Json | null,
  context: ToolContext,
): Promise<ToolResult> {
  if (!context.userId) {
    return { ok: false, code: "unauthenticated", message: "Mag-sign in muna para ma-save ang itinerary." };
  }
  if (!context.requestConfirmedSave) {
    return { ok: false, code: "forbidden", message: "Save blocked: explicitConfirmed required" };
  }

  const draft = (planningContext as any)?.itineraryDraft;
  const budget = (planningContext as any)?.budget;
  if (!draft || !Array.isArray(draft.days)) {
    return { ok: false, code: "invalid_argument", message: "Walang draft na puwedeng i-save. Mag-plan muna." };
  }

  const stops: NormalizedSaveStop[] = [];
  const seen = new Set<string>();
  for (const day of draft.days) {
    if (!Array.isArray(day?.stops)) continue;
    for (const stop of day.stops) {
      const businessId = typeof stop?.businessId === "string" ? stop.businessId : "";
      if (!businessId || seen.has(businessId)) continue;
      seen.add(businessId);
      stops.push({
        businessId,
        stopTime: typeof stop.time === "string" ? stop.time : "",
        kind: typeof stop.note === "string" ? stop.note : "stop",
        costPhp: typeof stop.estCost === "number" ? Math.max(0, stop.estCost) : 0,
        note: typeof stop.note === "string" ? stop.note : null,
      });
    }
  }
  const lodgingId = typeof draft.lodgingBusinessId === "string" ? draft.lodgingBusinessId : null;
  if (lodgingId && !seen.has(lodgingId)) {
    stops.push({
      businessId: lodgingId,
      stopTime: "Check-in",
      kind: "stay",
      costPhp: 0,
      note: "lodging",
    });
  }

  // Re-verify any draft IDs that weren't already trusted (e.g. empty context seed).
  for (const id of await fetchVerifiedBusinessIdSet(context.supabase, stops.map((s) => s.businessId))) {
    context.trustedBusinessIds.add(id);
  }

  const area =
    (typeof draft.area === "string" && draft.area.trim()) ||
    (typeof (planningContext as any)?.places?.[0]?.city === "string" && (planningContext as any).places[0].city) ||
    "Biyahe";
  const title =
    (typeof draft.title === "string" && draft.title.trim()) ||
    `${Array.isArray(draft.days) ? draft.days.length : 1}-day ${area} plan`;
  const budgetPhp =
    typeof budget?.total === "number"
      ? Math.max(0, budget.total)
      : typeof budget?.limit === "number"
        ? Math.max(0, budget.limit)
        : 0;

  return persistItinerary(context, { title, area, budgetPhp, stops });
}

async function saveItinerary(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
  if (!context.userId) {
    return { ok: false, code: "unauthenticated", message: "Mag-sign in muna para ma-save ang itinerary." };
  }

  if (context.requestConfirmedSave !== true || args.explicitConfirmed !== true) {
    return {
      ok: false,
      code: "forbidden",
      message: "Save blocked: explicitConfirmed must be true in request and model tool call",
    };
  }

  const title = typeof args.title === "string" ? args.title.trim() : "";
  const area = typeof args.area === "string" ? args.area.trim() : "";
  const budgetPhp = typeof args.budgetPhp === "number" ? Math.max(0, args.budgetPhp) : 0;
  const stops = Array.isArray(args.stops) ? args.stops : [];

  const normalizedStops: NormalizedSaveStop[] = [];
  for (const stop of stops) {
    if (!stop || typeof stop !== "object") {
      return { ok: false, code: "invalid_argument", message: "Invalid stop payload" };
    }
    const businessId = typeof stop.businessId === "string" ? stop.businessId : "";
    normalizedStops.push({
      businessId,
      stopTime: typeof stop.stopTime === "string" ? stop.stopTime : "",
      kind: typeof stop.kind === "string" ? stop.kind : "stop",
      costPhp: typeof stop.costPhp === "number" ? Math.max(0, stop.costPhp) : 0,
      note: typeof stop.note === "string" ? stop.note : null,
    });
  }

  return persistItinerary(context, { title, area, budgetPhp, stops: normalizedStops });
}

function cleanupIdempotencyStore() {
  const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
  for (const [key, value] of saveIdempotencyStore.entries()) {
    if (value.createdAt < cutoff) {
      saveIdempotencyStore.delete(key);
    }
  }
}

async function fetchVerifiedBusinessIdSet(
  supabase: SupabaseClient,
  businessIds: string[],
): Promise<Set<string>> {
  if (businessIds.length === 0) return new Set();
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .in("id", businessIds)
    .eq("live", true)
    .eq("verification_status", "verified");
  return new Set((data ?? []).map((row) => String(row.id)));
}

async function fetchBusinessNames(supabase: SupabaseClient, businessIds: string[]): Promise<Map<string, string>> {
  if (businessIds.length === 0) return new Map();
  const { data } = await supabase.from("businesses").select("id,name").in("id", businessIds);
  return new Map((data ?? []).map((row) => [String(row.id), String(row.name ?? "Unknown")]));
}

const PLACE_META_COLUMNS = "id,name,business_type,price_range,city,latitude,longitude";

/** Owner-posted menu_items prices keyed by business_id (public RLS). */
async function fetchMenuPricesByBusinessIds(
  supabase: SupabaseClient,
  businessIds: string[],
): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  if (businessIds.length === 0) return out;
  const { data, error } = await supabase
    .from("menu_items")
    .select("business_id, price")
    .in("business_id", businessIds);
  if (error || !data) {
    if (error) console.error("jimbot: menu_items fetch failed", error.message);
    return out;
  }
  for (const row of data) {
    const id = String(row.business_id);
    const price = Number(row.price);
    if (!Number.isFinite(price) || price < 0) continue;
    const list = out.get(id) ?? [];
    list.push(price);
    out.set(id, list);
  }
  return out;
}

async function fetchPlaceMeta(supabase: SupabaseClient, businessIds: string[]): Promise<PlaceMeta[]> {
  if (businessIds.length === 0) return [];
  const unique = [...new Set(businessIds.map(String))];
  const [{ data }, menuById] = await Promise.all([
    supabase.from("businesses").select(PLACE_META_COLUMNS).in("id", unique),
    fetchMenuPricesByBusinessIds(supabase, unique),
  ]);
  return (data ?? []).map((row: any) => ({
    ...row,
    id: String(row.id),
    menuPrices: menuById.get(String(row.id)) ?? [],
  }));
}

/** Last scheduling pass: caps, lodging, times, day split, and budget rebuilt from listed prices. */
function applyNormalizedDraft(clone: any, placesMeta: PlaceMeta[], hints: PlanHints) {
  if (!clone.itineraryDraft) return;
  const result = normalizeItineraryDraft({
    draft: clone.itineraryDraft,
    placesMeta,
    hints,
    previousBudget: clone.budget,
  });
  clone.itineraryDraft = result.draft;
  clone.budget = result.budgetPatch;
  if (!Array.isArray(clone.warnings)) clone.warnings = [];
  for (const w of result.warnings) {
    if (!clone.warnings.includes(w)) clone.warnings.push(w);
  }
}

async function sanitizeAndRevalidateBusinessIds(
  payload: any,
  supabase: SupabaseClient,
  toolContext?: ToolContext,
  recommendationOnly = false,
): Promise<any> {
  const clone = structuredClone(payload ?? {});
  const ids = collectBusinessIds(clone);
  // Also trust IDs discovered during this turn's tool loop.
  if (toolContext && !recommendationOnly) {
    for (const id of toolContext.trustedBusinessIds) ids.push(id);
  }
  const validIds = await fetchVerifiedBusinessIdSet(supabase, [...new Set(ids)]);
  let stripped = 0;

  clone.places = Array.isArray(clone.places)
    ? clone.places.filter((place: any) => {
        const keep = typeof place?.businessId === "string" && validIds.has(place.businessId);
        if (!keep) stripped += 1;
        return keep;
      })
    : [];

  // Hydrate places from tool-trusted IDs when the model returned none.
  if (!recommendationOnly && clone.places.length === 0 && toolContext) {
    const trusted = [...toolContext.trustedBusinessIds].filter((id) => validIds.has(id));
    if (trusted.length > 0) {
      clone.places = trusted.map((businessId) => ({ businessId, reason: null }));
    }
  }

  // If model returned places/budget but forgot the draft, synthesize a 1-day plan from verified place IDs.
  const placeIds = (clone.places ?? [])
    .map((p: any) => p?.businessId)
    .filter((id: unknown): id is string => typeof id === "string" && validIds.has(id));
  const draftHasStops =
    Array.isArray(clone.itineraryDraft?.days) &&
    clone.itineraryDraft.days.some((d: any) => Array.isArray(d?.stops) && d.stops.length > 0);
  if (!recommendationOnly && !draftHasStops && placeIds.length > 0) {
    clone._planHints = parsePlanHints(toolContext?.userMessage ?? "");
    clone.itineraryDraft = await synthesizeDraftFromIds(supabase, placeIds, clone);
    delete clone._planHints;
    // Cap places/map to synthesized stops (not the full search dump).
    const stopIds = collectBusinessIds({ itineraryDraft: clone.itineraryDraft });
    if (stopIds.length > 0) {
      clone.places = stopIds.map((businessId) => ({ businessId, reason: null }));
      clone.map = { businessIds: stopIds };
    }
  }

  if (clone.itineraryDraft?.days && Array.isArray(clone.itineraryDraft.days)) {
    for (const day of clone.itineraryDraft.days) {
      if (!Array.isArray(day?.stops)) continue;
      day.stops = day.stops.filter((stop: any) => {
        const keep = typeof stop?.businessId === "string" && validIds.has(stop.businessId);
        if (!keep) stripped += 1;
        return keep;
      });
    }
    if (
      typeof clone.itineraryDraft.lodgingBusinessId === "string" &&
      !validIds.has(clone.itineraryDraft.lodgingBusinessId)
    ) {
      clone.itineraryDraft.lodgingBusinessId = null;
      stripped += 1;
    }
    // Drop empty draft shells
    if (!clone.itineraryDraft.days.some((d: any) => Array.isArray(d?.stops) && d.stops.length > 0)) {
      clone.itineraryDraft = null;
    }
  }

  if (clone.itineraryDraft) {
    const draftIds = collectBusinessIds({ itineraryDraft: clone.itineraryDraft });
    const lodgingId = clone.itineraryDraft.lodgingBusinessId;
    if (typeof lodgingId === "string") draftIds.push(lodgingId);
    applyNormalizedDraft(
      clone,
      await fetchPlaceMeta(supabase, draftIds),
      parsePlanHints(toolContext?.userMessage ?? ""),
    );
    // Lodging left the timed stops but still needs a card + pin.
    const lodging = clone.itineraryDraft.lodgingBusinessId;
    if (typeof lodging === "string" && Array.isArray(clone.places)) {
      if (!clone.places.some((p: any) => p?.businessId === lodging)) {
        clone.places.unshift({ businessId: lodging, reason: null });
      }
    }
  }

  if (clone.budget?.lines && Array.isArray(clone.budget.lines)) {
    clone.budget.lines = clone.budget.lines.map((line: any) => {
      if (!line || typeof line !== "object") return line;
      if (typeof line.businessId === "string" && !validIds.has(line.businessId)) {
        stripped += 1;
        return { ...line, businessId: null };
      }
      return line;
    });
  }

  if (!clone.map || typeof clone.map !== "object") {
    clone.map = { businessIds: [] };
  } else if (Array.isArray(clone.map.businessIds)) {
    clone.map.businessIds = clone.map.businessIds.filter((id: unknown) => {
      const keep = typeof id === "string" && validIds.has(id);
      if (!keep) stripped += 1;
      return keep;
    });
  } else {
    clone.map.businessIds = [];
  }

  // Always pin verified places/stops on the map when the model forgets map.businessIds.
  const pinIds = [
    ...new Set([
      ...((clone.places ?? []).map((p: any) => p?.businessId).filter((id: unknown) => typeof id === "string")),
      ...collectBusinessIds({ itineraryDraft: clone.itineraryDraft }),
      ...(Array.isArray(clone.map?.businessIds) ? clone.map.businessIds : []),
    ]),
  ].filter((id) => validIds.has(id));
  clone.map = { businessIds: pinIds };

  if (!Array.isArray(clone.actions)) clone.actions = [];
  clone.actions = clone.actions.map((action: any) => {
    if (!action || typeof action !== "object") return action;
    if (typeof action.businessId === "string" && !validIds.has(action.businessId)) {
      stripped += 1;
      return { ...action, businessId: null };
    }
    return action;
  });

  // Draft ready → ensure user can confirm save + jump to map pins.
  if (clone.itineraryDraft) {
    const hasConfirm = clone.actions.some((action: any) => action?.type === "confirm_save");
    if (!hasConfirm) {
      clone.actions.push({ type: "confirm_save", label: "I-save", businessId: null });
    }
  }
  if (Array.isArray(clone.map?.businessIds) && clone.map.businessIds.length > 0) {
    const hasMap = clone.actions.some((action: any) => action?.type === "open_map");
    if (!hasMap) {
      clone.actions.push({ type: "open_map", label: "Tingnan sa mapa", businessId: null });
    }
  }

  // If the model put stops in the draft but skipped places[], hydrate cards from stop IDs.
  if ((!Array.isArray(clone.places) || clone.places.length === 0) && clone.itineraryDraft) {
    const stopIds = collectBusinessIds({ itineraryDraft: clone.itineraryDraft }).filter((id) =>
      validIds.has(id)
    );
    clone.places = stopIds.map((businessId) => ({ businessId, reason: null }));
  }

  enforceShortChatMessage(clone);

  if (clone.refusal) {
    clone.places = [];
    clone.itineraryDraft = null;
    clone.budget = null;
    clone.map = { businessIds: [] };
    clone.actions = [];
  }

  if (!Array.isArray(clone.quickReplies)) clone.quickReplies = [];
  if (!Array.isArray(clone.warnings)) clone.warnings = [];
  if (stripped > 0) {
    clone.warnings.push("May ilang listings na naalis kasi hindi na verified/live.");
  }

  return clone;
}

type PlanHints = {
  budgetPhp: number | null;
  people: number | null;
  areaHint: string | null;
  // Omit days when the user did not state one, so the prompt can clarify intent.
  days?: number;
  foodTrip: boolean;
  overnight: boolean;
};

function looksLikePlanRequest(message: string): boolean {
  const m = message.toLowerCase();
  return /itinerar|plano|plan\b|day\b|araw|budget|biyahe|trip|lakad|gala/.test(m);
}

/** Extract budget / party size / city phrase from the user turn (Taglish + English). */
function parsePlanHints(message: string): PlanHints {
  const raw = message ?? "";
  const m = raw.toLowerCase();

  let budgetPhp: number | null = null;
  const budgetPatterns = [
    /(?:budget|budgete?)\s*(?:of|na|ay|=|:)?\s*(?:₱|php)?\s*([\d,]+)/i,
    /(?:₱|php)\s*([\d,]+)/i,
    /([\d,]+)\s*(?:php|pesos?)/i,
  ];
  for (const re of budgetPatterns) {
    const hit = raw.match(re);
    if (hit?.[1]) {
      const n = Number(hit[1].replace(/,/g, ""));
      if (Number.isFinite(n) && n >= 100 && n <= 1_000_000) {
        budgetPhp = n;
        break;
      }
    }
  }

  let people: number | null = null;
  const peopleHit =
    m.match(/(?:para\s+sa|for)\s+(\d{1,2})\s*(?:tao|people|persons?|pax)?/) ||
    m.match(/(\d{1,2})\s*(?:tao|people|persons?|pax)\b/);
  if (peopleHit?.[1]) {
    const n = Number(peopleHit[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 20) people = n;
  }

  let areaHint: string | null = null;
  const areaHit =
    raw.match(/\b(?:sa|in|near|around)\s+([A-Za-zÑñ][A-Za-zÑñ\s.'-]{2,40}?)(?:\s*[,.]|\s+budget|\s+para|\s+for|$)/i) ||
    raw.match(/\b(Quezon City|Baguio|Manila|Makati|Cebu|Iloilo|Davao)\b/i);
  if (areaHit?.[1]) {
    areaHint = areaHit[1].replace(/\s+/g, " ").trim();
  }

  const daysHit = m.match(/\b(\d+)\s*(?:days?|araw)\b/);
  const parsedDays = daysHit?.[1] ? Number(daysHit[1]) : null;
  const days = parsedDays && Number.isFinite(parsedDays) && parsedDays >= 1 ? parsedDays : undefined;
  const foodTrip = /food\s*trip|food\s*crawl|kainan\s*crawl/i.test(raw);

  return {
    budgetPhp,
    people,
    areaHint,
    days,
    foodTrip,
    overnight: /hotel|hostel|overnight|tulog|stay|magpalipas/i.test(raw),
  };
}

async function buildFallbackPlanFromTrustedIds(
  supabase: SupabaseClient,
  toolContext: ToolContext,
  userMessage = "",
): Promise<Record<string, unknown> | null> {
  const ids = [...toolContext.trustedBusinessIds];
  if (ids.length === 0) return null;
  const validIds = await fetchVerifiedBusinessIdSet(supabase, ids);
  const placeIds = ids.filter((id) => validIds.has(id));
  if (placeIds.length === 0) return null;

  const hints = parsePlanHints(userMessage);
  const shell: any = {
    message: "",
    quickReplies: [],
    places: [],
    itineraryDraft: null,
    budget: null,
    map: { businessIds: [] },
    actions: [{ type: "confirm_save", label: "I-save", businessId: null }],
    warnings: [],
    refusal: null,
    _planHints: hints,
  };
  shell.itineraryDraft = await synthesizeDraftFromIds(supabase, placeIds, shell);
  const stopIds = collectBusinessIds({ itineraryDraft: shell.itineraryDraft });
  shell.places = stopIds.map((businessId) => ({ businessId, reason: null }));
  shell.map = { businessIds: stopIds };

  const area =
    (typeof shell.itineraryDraft?.area === "string" && shell.itineraryDraft.area) ||
    hints.areaHint ||
    "biyahe mo";
  const n = stopIds.length;
  const dayCount = Array.isArray(shell.itineraryDraft?.days) ? shell.itineraryDraft.days.length : 1;
  shell.message = `Eto ang ${dayCount}-day plan mo sa ${area} (${n} stop${n === 1 ? "" : "s"}). Tingnan mo ang cards, tapos sabihin kung i-save.`;
  enforceShortChatMessage(shell);
  delete shell._planHints;
  return shell;
}

async function synthesizeDraftFromIds(
  supabase: SupabaseClient,
  placeIds: string[],
  clone: any,
): Promise<Record<string, unknown>> {
  const meta = await fetchPlaceMeta(supabase, placeIds);
  const byId = new Map(meta.map((row) => [row.id, row]));
  const ordered = placeIds.map((id) => byId.get(id)).filter((row): row is PlaceMeta => !!row);
  const hints: PlanHints =
    clone._planHints ??
    parsePlanHints(typeof clone._userMessage === "string" ? clone._userMessage : "");
  const selected = pickDiverseStops(ordered, {
    days: hints.days,
    overnight: hints.overnight === true,
    foodTrip: hints.foodTrip === true,
  });

  const area =
    (typeof clone.itineraryDraft?.area === "string" && clone.itineraryDraft.area) ||
    selected[0]?.city ||
    hints.areaHint ||
    null;
  clone.itineraryDraft = {
    title: "",
    area,
    days: [{
      day: 1,
      stops: selected.map((row) => ({ time: null, businessId: row.id, note: row.business_type, estCost: null })),
    }],
  };
  applyNormalizedDraft(clone, meta, hints);
  const dayLabel = `${clone.itineraryDraft.days.length}-day plan`;
  clone.itineraryDraft.title = area ? `${dayLabel} · ${area}` : dayLabel;
  return clone.itineraryDraft;
}

/** Models often dump markdown into message; keep chat text short and card-friendly. */
function enforceShortChatMessage(clone: any) {
  const msg = typeof clone.message === "string" ? clone.message.trim() : "";
  const hasCards =
    !!clone.itineraryDraft ||
    (Array.isArray(clone.places) && clone.places.length > 0) ||
    !!clone.budget;
  const looksLikeMarkdown =
    /[#*_`]/.test(msg) ||
    /\n\s*([-*•]|\d+\.)\s/.test(msg) ||
    msg.includes("\n\n");
  if (hasCards && (looksLikeMarkdown || msg.length > 180)) {
    if (clone.itineraryDraft) {
      const area =
        typeof clone.itineraryDraft.area === "string" && clone.itineraryDraft.area
          ? clone.itineraryDraft.area
          : "biyahe mo";
      clone.message = `Eto ang plan mo sa ${area}. Tingnan mo ang cards, tapos sabihin kung i-save.`;
      return;
    }
    if (clone.budget) {
      clone.message = "Eto ang budget breakdown. Gusto mo bang i-adjust?";
      return;
    }
    clone.message = "Narito ang verified na options. Tingnan mo sa cards.";
    return;
  }
  if (msg.length > 180) clone.message = msg.slice(0, 177) + "...";
}

function collectBusinessIds(payload: any): string[] {
  const ids = new Set<string>();

  if (Array.isArray(payload?.places)) {
    for (const place of payload.places) {
      if (typeof place?.businessId === "string") ids.add(place.businessId);
    }
  }

  if (Array.isArray(payload?.itineraryDraft?.days)) {
    for (const day of payload.itineraryDraft.days) {
      if (!Array.isArray(day?.stops)) continue;
      for (const stop of day.stops) {
        if (typeof stop?.businessId === "string") ids.add(stop.businessId);
      }
    }
  }
  if (typeof payload?.itineraryDraft?.lodgingBusinessId === "string") {
    ids.add(payload.itineraryDraft.lodgingBusinessId);
  }

  if (Array.isArray(payload?.budget?.lines)) {
    for (const line of payload.budget.lines) {
      if (typeof line?.businessId === "string") ids.add(line.businessId);
    }
  }

  if (Array.isArray(payload?.map?.businessIds)) {
    for (const id of payload.map.businessIds) {
      if (typeof id === "string") ids.add(id);
    }
  }

  if (Array.isArray(payload?.actions)) {
    for (const action of payload.actions) {
      if (typeof action?.businessId === "string") ids.add(action.businessId);
    }
  }

  return [...ids];
}

function parseStructuredResponse(response: any): Record<string, unknown> | null {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return null;
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Some gateways wrap JSON in a markdown fence or add surrounding prose.
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // fall through to brace extraction
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/** Convert tools.json to Chat Completions function tools. */
function buildChatTools(tools: unknown): unknown {
  if (!Array.isArray(tools)) return [];
  return tools.map((tool: any) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: sanitizeToolsForOpenAI(tool.parameters),
    },
  }));
}

/** Strip keywords function tools reject (e.g. uniqueItems). */
function sanitizeToolsForOpenAI(tools: unknown): unknown {
  if (Array.isArray(tools)) {
    return tools.map(sanitizeToolsForOpenAI);
  }
  if (!tools || typeof tools !== "object") {
    return tools;
  }
  const blocked = new Set(["uniqueItems"]);
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(tools as Record<string, unknown>)) {
    if (blocked.has(key)) continue;
    clean[key] = sanitizeToolsForOpenAI(value);
  }
  return clean;
}

/** Server-added draft fields the model never emits (kept out of the response schema sent to the model). */
function withServerOnlyDraftFields(schema: any): any {
  const clone = structuredClone(schema);
  const draft = clone?.properties?.itineraryDraft;
  if (draft?.properties) {
    draft.properties.lodgingBusinessId = { type: ["string", "null"] };
    const stopProps = draft.properties.days?.items?.properties?.stops?.items?.properties;
    if (stopProps && typeof stopProps === "object") {
      stopProps.costState = { type: "string", enum: ["listed", "estimated", "unknown"] };
    }
  }
  const lineProps = clone?.properties?.budget?.properties?.lines?.items?.properties;
  if (lineProps && typeof lineProps === "object") {
    lineProps.costState = { type: "string", enum: ["listed", "estimated", "unknown"] };
  }
  return clone;
}

function jsonResponse(body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}
