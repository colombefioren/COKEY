import { useCallback, useEffect, useState } from "react";
import { api, timeAgo } from "../api.js";
import type { ContentStatusResponse } from "../types.js";
import { Panel, Stat } from "./Primitives.js";
import { IconInfo } from "./Icons.js";
import { useToast } from "./Toast.js";

/**
 * Where the curated content came from.
 *
 * The provider dossiers, the terms and the ranking boards are read from a
 * content repository that lives outside this project. That is a good arrangement
 * and an invisible one, which is a problem: a user who edits a dossier and sees
 * nothing change has no way to tell whether the file was read, whether it parsed,
 * or whether COKEY is even looking at the right directory.
 *
 * So the dashboard states it: the directory, what was read from it, what failed,
 * and a button to force a re-read for the filesystems a watcher cannot see.
 */
export function ContentSource({ refreshKey = 0 }: { refreshKey?: number }) {
  const toast = useToast();
  const [status, setStatus] = useState<ContentStatusResponse | null>(null);
  const [reloading, setReloading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await api.contentStatus());
    } catch {
      // An unreachable content endpoint means an older gateway build; there is
      // nothing useful to say about it, so the panel stays as it was.
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const reload = useCallback(async () => {
    setReloading(true);
    try {
      const result = await api.reloadContent();
      toast[result.changed ? "ok" : "info"](
        result.changed
          ? `Content reloaded: ${result.counts.providers} providers`
          : "Content reloaded: nothing changed",
      );
      await load();
    } catch (error) {
      toast.err(error instanceof Error ? error.message : String(error));
    } finally {
      setReloading(false);
    }
  }, [load, toast]);

  if (!status) return null;

  const issues = status.issues;
  const shown = expanded ? issues : issues.slice(0, 4);

  return (
    <Panel
      hue="lav"
      icon={<IconInfo size={14} />}
      title="Curated content"
      actions={
        <div className="row" style={{ gap: 8 }}>
          <span className="small faint" title={status.directory}>
            {status.watching ? "watching for edits" : "not watching"}
          </span>
          <button className="secondary" onClick={() => void reload()} disabled={reloading}>
            {reloading ? "reloading…" : "reload"}
          </button>
        </div>
      }
    >
      {!status.available ? (
        <div className="hint-box">
          No content repository is checked out, so COKEY is serving the catalog compiled into this
          build. Point <code>COKEY_CMS_DIR</code> at a content checkout to edit dossiers, terms and
          rankings without a release.
          <div className="small faint mono" style={{ marginTop: 8, overflowWrap: "anywhere" }}>
            looked in {status.directory}
          </div>
        </div>
      ) : (
        <>
          <div className="grid cards">
            <Stat
              label="Dossiers"
              value={status.counts.providers}
              hint={`${status.counts.models} curated free model(s)`}
            />
            <Stat label="Terms sections" value={status.counts.terms} hint="read in order" />
            <Stat
              label="Ranked entries"
              value={status.counts.ranked}
              hint={`${status.counts.skill} skill entry(s)`}
            />
            <Stat
              label="Loaded"
              value={timeAgo(status.loadedAt)}
              hint={status.watching ? "auto-reloads on edit" : "reload by hand"}
            />
          </div>

          <div className="small faint mono" style={{ marginTop: 12, overflowWrap: "anywhere" }}>
            {status.directory}
          </div>

          {/*
           * Content problems are listed rather than counted. Every one of them
           * names the file that caused it, because "3 issues" is not something
           * anyone can act on.
           */}
          {issues.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div className="row between">
                <span className="small">
                  {issues.length} file{issues.length === 1 ? "" : "s"} need attention
                </span>
                {issues.length > 4 ? (
                  <button className="ghost small" onClick={() => setExpanded(!expanded)}>
                    {expanded ? "show less" : "show all"}
                  </button>
                ) : null}
              </div>
              <ul className="small faint" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {shown.map((issue, index) => (
                  <li key={`${issue.file}-${index}`}>
                    <span className="mono">{issue.file}</span> — {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="small faint" style={{ marginTop: 10 }}>
              Every file parsed cleanly.
            </div>
          )}

          {/*
           * A provider documented in the content repository that this build
           * cannot talk to. Worth surfacing: it is a five-minute fix and
           * completely invisible otherwise.
           */}
          {status.unsupportedProviders.length > 0 ? (
            <div className="small faint" style={{ marginTop: 10 }}>
              Documented but not served by this build: {status.unsupportedProviders.join(", ")}
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
}
