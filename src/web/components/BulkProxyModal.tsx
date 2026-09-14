import { useState } from "react";
import { api, ApiError } from "../api.js";
import type { ProxyPoolResponse } from "../types.js";
import { Modal } from "./Primitives.js";
import { useToast } from "./Toast.js";
import { useLang } from "../lang.js";

/**
 * Paste a vendor's whole endpoint list at once.
 *
 * Residential and datacenter vendors hand out 20-100 sticky endpoints; adding
 * them one box at a time is the only thing the single-line input cannot do.
 * Each line is validated and deduplicated on the server, so a bad row is
 * skipped rather than failing the batch.
 */
export function BulkProxyModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: (data: ProxyPoolResponse) => void;
}) {
  const toast = useToast();
  const { t } = useLang();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await api.addProxiesBulk(text);
      onChanged(result);
      if (result.added === 0) {
        toast.err(
          result.skipped === 0
            ? t("Nothing to add")
            : `${t("No new exits —")} ${result.skipped} ${t("skipped (duplicate or invalid)")}`,
        );
      } else {
        toast.ok(
          result.skipped === 0
            ? `${t("Added")} ${result.added} ${result.added === 1 ? t("exit") : t("exits")}`
            : `${t("Added")} ${result.added}, ${t("skipped")} ${result.skipped}`,
        );
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={t("Bulk add egress proxies")}
      subtitle={t(
        "One proxy per line. Credentials stay on the server; only host:port is ever shown.",
      )}
      onClose={onClose}
      wide
    >
      <div className="field">
        <label htmlFor="bulk-proxies">{t("Proxy URLs")}</label>
        <textarea
          id="bulk-proxies"
          value={text}
          rows={10}
          spellCheck={false}
          placeholder={`socks5://user:pass@gateway.example:1080\nhttp://user:pass@gateway.example:8080`}
          onChange={(event) => setText(event.target.value)}
        />
        <span className="small faint">
          {lines.length === 0
            ? t("Paste one proxy per line.")
            : `${lines.length} ${lines.length === 1 ? t("line") : t("lines")} ${t("pasted.")}`}
        </span>
      </div>

      {error ? <div className="verify err">{error}</div> : null}

      <div className="modal-actions">
        <button className="secondary" onClick={onClose} disabled={busy}>
          {t("Cancel")}
        </button>
        <button onClick={() => void submit()} disabled={busy || lines.length === 0}>
          {busy ? t("Adding…") : t("Add proxies")}
        </button>
      </div>
    </Modal>
  );
}
