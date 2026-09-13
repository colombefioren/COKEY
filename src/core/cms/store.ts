import { createHash } from "node:crypto";
import { existsSync, watch, type FSWatcher } from "node:fs";
import {
  loadCmsSnapshot,
  resolveCmsDirectory,
  type CmsSnapshot,
} from "./load.js";

/**
 * The live content store.
 *
 * The dashboard's promise is that a change is visible without a restart, and
 * the content repository is one of the places a change lands — often from
 * another editor or another process entirely (`git pull` in the CMS checkout).
 * So the store watches its directory and reloads on write.
 *
 * Two decisions worth stating:
 *
 *   - Reloads are debounced. A `git checkout` produces a burst of filesystem
 *     events, and re-reading fifty-six JSON files per event is a waste that also
 *     spams subscribers.
 *   - A reload that produces an identical snapshot does not notify anyone.
 *     Editors write files on save even when nothing changed, and telling the UI
 *     to refetch on every keystroke-save would undo the point of the watch.
 */

export interface CmsStoreOptions {
  /** Overrides directory discovery; primarily for tests. */
  directory?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  /** Called after a reload that actually changed something. */
  onChange?: (snapshot: CmsSnapshot) => void;
  /** Quiet period after the last filesystem event before reloading. */
  debounceMs?: number;
}

export interface CmsStatus {
  /** True when a content directory was found and produced at least one provider. */
  available: boolean;
  directory: string;
  /** True while a watcher is attached. */
  watching: boolean;
  loadedAt: number;
  counts: {
    providers: number;
    models: number;
    terms: number;
    ranked: number;
    skill: number;
    issues: number;
  };
  /** Content problems, newest snapshot only. */
  issues: Array<{ file: string; message: string }>;
}

export class CmsStore {
  private snapshot: CmsSnapshot;
  private signature: string;
  private watcher?: FSWatcher;
  private timer?: NodeJS.Timeout;
  private readonly listeners = new Set<(snapshot: CmsSnapshot) => void>();
  private readonly debounceMs: number;

  constructor(private readonly options: CmsStoreOptions = {}) {
    const directory =
      options.directory ?? resolveCmsDirectory(options.env ?? process.env, options.cwd);
    this.debounceMs = options.debounceMs ?? 250;
    this.snapshot = loadCmsSnapshot(directory);
    this.signature = snapshotSignature(this.snapshot);
    if (options.onChange) this.listeners.add(options.onChange);
  }

  get current(): CmsSnapshot {
    return this.snapshot;
  }

  get directory(): string {
    return this.snapshot.directory;
  }

  subscribe(listener: (snapshot: CmsSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Re-read the content directory.
   *
   * Returns whether anything actually changed, so a caller can decide against
   * emitting an event. Safe to call when watching is disabled.
   */
  reload(): boolean {
    const next = loadCmsSnapshot(this.snapshot.directory);
    const nextSignature = snapshotSignature(next);
    const changed = nextSignature !== this.signature;
    this.snapshot = next;
    this.signature = nextSignature;
    if (changed) {
      for (const listener of [...this.listeners]) {
        try {
          listener(next);
        } catch {
          // A subscriber that throws must not stop the others from being told.
        }
      }
    }
    return changed;
  }

  /**
   * Watch the content directory for edits.
   *
   * Watching is best-effort: if the directory is missing, or the platform
   * refuses a recursive watch, the store keeps its current snapshot and the
   * manual reload endpoint remains available. Failing to watch is a degraded
   * feature, not an error worth throwing at start-up.
   */
  watch(): void {
    if (this.watcher || !existsSync(this.snapshot.directory)) return;

    const onChange = (): void => {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.reload();
      }, this.debounceMs);
      this.timer.unref?.();
    };

    try {
      this.watcher = watch(this.snapshot.directory, { recursive: true }, onChange);
    } catch {
      try {
        // Some filesystems reject recursive watches; the top level still covers
        // the common case of editing an existing file in place.
        this.watcher = watch(this.snapshot.directory, onChange);
      } catch {
        this.watcher = undefined;
        return;
      }
    }

    this.watcher.on("error", () => {
      this.watcher?.close();
      this.watcher = undefined;
    });
    this.watcher.unref?.();
  }

  close(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.watcher?.close();
    this.watcher = undefined;
    this.listeners.clear();
  }

  status(): CmsStatus {
    const snapshot = this.snapshot;
    return {
      available: snapshot.providers.size > 0,
      directory: snapshot.directory,
      watching: this.watcher !== undefined,
      loadedAt: snapshot.loadedAt,
      counts: {
        providers: snapshot.providers.size,
        models: [...snapshot.providers.values()].reduce(
          (sum, provider) => sum + provider.models.length,
          0,
        ),
        terms: snapshot.terms.length,
        ranked: snapshot.rankings?.combined.length ?? 0,
        skill: snapshot.rankings?.skill.length ?? 0,
        issues: snapshot.issues.length,
      },
      issues: snapshot.issues,
    };
  }
}

/**
 * A cheap fingerprint of a snapshot.
 *
 * Every field a reader can see is folded in, because the whole point is to
 * answer "did anything observable change?" — and the edit that matters most is
 * the smallest one: flipping a verdict from `usable` to `limited` moves no
 * counts and changes no review date, so a signature built from sizes alone would
 * silently ignore it.
 *
 * `loadedAt` is deliberately excluded, because it changes on every read. The
 * projection is hashed so the value stays small enough to compare and log.
 */
export function snapshotSignature(snapshot: CmsSnapshot): string {
  const providers = [...snapshot.providers.values()]
    .map((provider) => ({
      id: provider.id,
      displayName: provider.displayName,
      operator: provider.operator,
      origin: provider.origin,
      kind: provider.kind,
      summary: provider.summary,
      verdict: provider.verdict,
      verdictReason: provider.verdictReason,
      sourceUrl: provider.sourceUrl,
      reviewedAt: provider.reviewedAt,
      freeTier: provider.freeTier,
      notes: provider.notes,
      models: provider.models,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const terms = snapshot.terms.map((section) => ({
    slug: section.slug,
    title: section.title,
    order: section.order,
    updatedAt: section.updatedAt,
    body: section.body,
  }));

  const rankings = snapshot.rankings
    ? {
        tiers: snapshot.rankings.tiers,
        skill: snapshot.rankings.skill,
        rateLimit: snapshot.rankings.rateLimit,
        combined: snapshot.rankings.combined,
        redundancy: snapshot.rankings.redundancy,
        dropList: snapshot.rankings.dropList,
        bottomLine: snapshot.rankings.bottomLine,
        disclaimer: snapshot.rankings.disclaimer,
        sources: snapshot.rankings.sources,
      }
    : null;

  return createHash("sha1").update(JSON.stringify({ providers, terms, rankings })).digest("hex");
}
