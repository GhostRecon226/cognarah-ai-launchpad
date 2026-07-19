export const PAGE_SIZE_LIST = 12;
export const PAGE_SIZE_SEARCH = 24;

export function parsePage(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function getRange(page: number, size: number): { from: number; to: number } {
  const from = (page - 1) * size;
  return { from, to: from + size - 1 };
}

export function totalPages(count: number | null | undefined, size: number): number {
  const c = count ?? 0;
  return Math.max(1, Math.ceil(c / size));
}
