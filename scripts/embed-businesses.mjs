/**
 * Embed live verified businesses for Jimbot hybrid search.
 * Usage: node scripts/embed-businesses.mjs
 * Reads EMBEDDING_API_KEY from .env.local or supabase/functions/.env (or process env).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  // Function-specific file wins over the shared repo-root .env.local.
  for (const envPath of [path.join(root, "supabase/functions/.env"), path.join(root, ".env.local")]) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 0) continue;
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY;
const EMBEDDING_BASE_URL = (process.env.EMBEDDING_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
const EMBED_MODEL = process.env.EMBEDDING_MODEL || "nvidia/nemotron-3.5-embed-1b:free";
// business_embeddings.embedding is vector(1536); Nemotron returns 2048 dims.
const EMBEDDING_DIMENSIONS = 1536;

if (!EMBEDDING_API_KEY) {
  console.error("EMBEDDING_API_KEY missing");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function contentFor(row) {
  return [
    row.name,
    row.business_type,
    row.city,
    row.about,
    Array.isArray(row.specialties) ? row.specialties.join(", ") : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function hash(text) {
  // Key the cache by provider + model so switching models forces a full re-embed.
  return crypto.createHash("sha256").update(`${EMBEDDING_BASE_URL}|${EMBED_MODEL}\n${text}`).digest("hex");
}

function fitEmbedding(embedding) {
  if (!Array.isArray(embedding) || embedding.length < EMBEDDING_DIMENSIONS) return null;
  const vector = embedding.slice(0, EMBEDDING_DIMENSIONS);
  const norm = Math.sqrt(vector.reduce((sum, n) => sum + n * n, 0));
  if (!Number.isFinite(norm) || norm === 0) return null;
  return vector.map((n) => n / norm);
}

async function embed(text) {
  const res = await fetch(`${EMBEDDING_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${EMBEDDING_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  const raw = json?.data?.[0]?.embedding;
  const fitted = fitEmbedding(raw);
  if (!fitted) {
    throw new Error(
      `Embedding from ${EMBED_MODEL} has ${Array.isArray(raw) ? raw.length : "unknown"} dimensions; ` +
        `expected at least ${EMBEDDING_DIMENSIONS}. Check EMBEDDING_MODEL and the vector column size.`,
    );
  }
  return fitted;
}

const { data: businesses, error } = await supabase
  .from("businesses")
  .select("id,name,business_type,city,about,specialties")
  .eq("live", true)
  .eq("verification_status", "verified");

if (error) {
  console.error(error);
  process.exit(1);
}

const { data: existing } = await supabase.from("business_embeddings").select("business_id,content_hash");
const byId = new Map((existing ?? []).map((r) => [r.business_id, r.content_hash]));

let written = 0;
let skipped = 0;
for (const row of businesses ?? []) {
  const text = contentFor(row);
  const content_hash = hash(text);
  if (byId.get(row.id) === content_hash) {
    skipped += 1;
    continue;
  }
  const embedding = await embed(text);
  const { error: upErr } = await supabase.from("business_embeddings").upsert({
    business_id: row.id,
    embedding,
    content_hash,
    updated_at: new Date().toISOString(),
  });
  if (upErr) {
    console.error("upsert failed", row.id, upErr.message);
    continue;
  }
  written += 1;
  console.log("embedded", row.name);
}

console.log(`done: wrote ${written}, skipped ${skipped}, total ${businesses?.length ?? 0}`);
