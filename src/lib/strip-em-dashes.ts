// Cognarah content rule: no em dashes (em dash) or en dashes (–) anywhere.
// Replace with a comma+space so the sentence still reads naturally.
// Callers should apply this to every user-visible text field before saving.

export function stripEmDashes(input: unknown): string {
  if (typeof input !== "string") return input as unknown as string;
  return input.replace(/\s*[—–]\s*/g, ", ");
}

export function stripEmDashesInObject<T extends Record<string, unknown>>(
  obj: T,
  fields: readonly (keyof T)[],
): T {
  const out: Record<string, unknown> = { ...obj };
  for (const f of fields) {
    const v = out[f as string];
    if (typeof v === "string") out[f as string] = stripEmDashes(v);
  }
  return out as T;
}
