import Papa from "papaparse";

export interface ParsedRecipients {
  valid: string[];
  invalidCount: number;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Supports two simple formats, chosen because they cover the common cases
 * without much complexity: a bare list of email addresses (one per line, or
 * comma-separated), or a CSV with a header row containing an "email"
 * column. Anything that isn't a syntactically valid email is dropped and
 * counted, not silently ignored — the caller surfaces that count to the
 * user. Duplicates (case-insensitive) are also silently de-duplicated.
 */
export function parseRecipientsFile(text: string): ParsedRecipients {
  const result = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  const rows = result.data;

  if (rows.length === 0) return { valid: [], invalidCount: 0 };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const emailColIdx = header.indexOf("email");

  let candidates: string[];
  if (emailColIdx !== -1) {
    candidates = rows.slice(1).map((row) => (row[emailColIdx] ?? "").trim());
  } else {
    candidates = rows.flat().map((cell) => cell.trim());
  }
  candidates = candidates.filter((c) => c.length > 0);

  const valid: string[] = [];
  const seen = new Set<string>();
  let invalidCount = 0;

  for (const candidate of candidates) {
    if (!EMAIL_REGEX.test(candidate)) {
      invalidCount++;
      continue;
    }
    const key = candidate.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      valid.push(candidate);
    }
  }

  return { valid, invalidCount };
}
