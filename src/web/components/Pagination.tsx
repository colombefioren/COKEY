import type { PageParams } from "../types.js";
import { useLang } from "../lang.js";

const PAGE_SIZES = [10, 25, 50, 100];

/**
 * The one pager every list in the dashboard uses.
 *
 * It reports a true total rather than "load more", because knowing that there
 * are 4,120 requests and you are on page 3 is the difference between a tool and
 * a scroll bar. Windowed page numbers keep it usable at any length.
 */
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
  noun = "rows",
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (params: PageParams) => void;
  noun?: string;
}) {
  const { t } = useLang();
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <div className="pager">
      <span className="pager-count">
        {total.toLocaleString()} {t(noun)} · {first.toLocaleString()} {t("to")}{" "}
        {last.toLocaleString()}
      </span>

      <span className="spacer" />

      <label className="pager-size">
        <span className="faint small">{t("per page")}</span>
        <select
          value={pageSize}
          onChange={(event) => onChange({ page: 1, pageSize: Number(event.target.value) })}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <div className="pager-nav">
        <button
          type="button"
          className="ghost"
          disabled={page <= 1}
          onClick={() => onChange({ page: 1 })}
          title={t("First page")}
        >
          «
        </button>
        <button
          type="button"
          className="ghost"
          disabled={page <= 1}
          onClick={() => onChange({ page: page - 1 })}
          title={t("Previous page")}
        >
          ‹
        </button>
        {pageWindow(page, totalPages).map((value) => (
          <button
            key={value}
            type="button"
            className={value === page ? "secondary" : "ghost"}
            aria-current={value === page ? "page" : undefined}
            onClick={() => onChange({ page: value })}
          >
            {value}
          </button>
        ))}
        <button
          type="button"
          className="ghost"
          disabled={page >= totalPages}
          onClick={() => onChange({ page: page + 1 })}
          title={t("Next page")}
        >
          ›
        </button>
        <button
          type="button"
          className="ghost"
          disabled={page >= totalPages}
          onClick={() => onChange({ page: totalPages })}
          title={t("Last page")}
        >
          »
        </button>
      </div>
    </div>
  );
}

/** Five page numbers centred on the current page, clamped to the ends. */
function pageWindow(page: number, totalPages: number): number[] {
  const size = Math.min(5, totalPages);
  let start = Math.max(1, page - Math.floor(size / 2));
  if (start + size - 1 > totalPages) start = Math.max(1, totalPages - size + 1);
  return Array.from({ length: size }, (_, index) => start + index);
}
