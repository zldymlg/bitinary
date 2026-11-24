export function quickReply(message: string, locale: unknown): string | null {
  const normalized = message.trim().toLowerCase().replace(/[.!?]+$/, "").trim();
  if (/^(hi|hello|hey|kumusta|kamusta)$/.test(normalized)) {
    return locale === "en" ? "Hi! Where would you like to go?" : "Kumusta! Saan ang gusto mong puntahan?";
  }
  if (/^(thanks|thank you|salamat|maraming salamat)$/.test(normalized)) {
    return locale === "en" ? "You're welcome!" : "Walang anuman!";
  }
  return null;
}

export function standaloneSearch(args: Record<string, unknown>, message: string): boolean {
  return args.purpose === "recommendation" &&
    typeof args.area === "string" && Boolean(args.area.trim()) && !/[%_\\]/.test(args.area) &&
    !/itinerar|\b(?:plan|plano|add|swap|replace|revise|instead|palitan|idagdag|dagdagan|mas mura)\b/i.test(message);
}

export function searchTermsMatch(query: string, ...fields: string[]): boolean {
  const tokens = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const searchable = new Set(fields.join(" ").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  return tokens.every((token) => searchable.has(token));
}
