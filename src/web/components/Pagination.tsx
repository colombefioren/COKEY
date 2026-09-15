import type { PageParams } from "../types.js";
import { useLang } from "../lang.js";
import { Select } from "./Primitives.js";

const PAGE_SIZES = [10, 25, 50, 100];

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

      <div className="pager-size">
        <span className="faint small">{t("per page")}</span>
        <Select
          value={String(pageSize)}
          onChange={(value) => onChange({ page: 1, pageSize: Number(value) })}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </div>

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

function pageWindow(page: number, totalPages: number): number[] {
  const size = Math.min(5, totalPages);
  let start = Math.max(1, page - Math.floor(size / 2));
  if (start + size - 1 > totalPages) start = Math.max(1, totalPages - size + 1);
  return Array.from({ length: size }, (_, index) => start + index);
}
