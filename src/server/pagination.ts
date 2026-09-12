/**
 * Shared pagination for the management API.
 *
 * Every list endpoint that can grow without bound accepts `page` and
 * `pageSize`, and every paginated response carries the same envelope so the UI
 * can render one reusable pager. `pageSize=0` is the explicit "everything"
 * escape hatch, which is what the CLI and the export path use.
 */

export interface PageQuery {
  page: number;
  pageSize: number;
  /** Free-text filter the caller applied, echoed back for the UI. */
  query?: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface Paginated<T> extends PageMeta {
  data: T[];
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;

function toInt(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

/**
 * Read `page` / `pageSize` from anything that looks like a query object.
 *
 * Unknown or malformed values fall back to the defaults rather than erroring:
 * a pager should never be able to break a page load.
 */
export function parsePageQuery(query: unknown, defaults: Partial<PageQuery> = {}): PageQuery {
  const source = (query ?? {}) as Record<string, unknown>;
  const pageSizeDefault = defaults.pageSize ?? DEFAULT_PAGE_SIZE;

  const rawSize = source.pageSize ?? source.limit;
  let pageSize = toInt(rawSize, pageSizeDefault);
  if (pageSize < 0) pageSize = pageSizeDefault;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  const page = Math.max(1, toInt(source.page, defaults.page ?? 1));

  const search = source.q ?? source.query;
  return {
    page,
    pageSize,
    query: typeof search === "string" && search.trim() ? search.trim() : undefined,
  };
}

/** True when the caller asked for the whole collection. */
export function isUnpaged(query: PageQuery): boolean {
  return query.pageSize === 0;
}

/** Slice a list and describe the slice. */
export function paginate<T>(items: T[], query: PageQuery): Paginated<T> {
  const total = items.length;
  if (isUnpaged(query)) {
    return { data: [...items], page: 1, pageSize: total, total, totalPages: 1, hasMore: false };
  }

  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), totalPages);
  const start = (page - 1) * query.pageSize;

  return {
    data: items.slice(start, start + query.pageSize),
    page,
    pageSize: query.pageSize,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}

/** Case-insensitive substring match over any of the supplied fields. */
export function matchesQuery(query: string | undefined, ...fields: Array<string | undefined>): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  return fields.some((field) => (field ?? "").toLowerCase().includes(needle));
}
