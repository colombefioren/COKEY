import type { FastifyInstance } from "fastify";
import type { Cokey } from "../../core/cokey.js";
import { withErrors } from "./http-errors.js";

/**
 * The curated content surface.
 *
 * Provider dossiers, the terms document and the ranking boards all come from a
 * separate content repository that can be edited while COKEY is running. These
 * routes are how the dashboard sees that content, and how a user finds out why
 * they are *not* seeing it: `/api/content/status` names the directory being
 * watched and lists every file that failed to parse.
 */
export function registerContentRoutes(app: FastifyInstance, cokey: Cokey): void {
  /**
   * Where the content came from, and what was wrong with it.
   *
   * `available: false` is not an error state — a fresh clone with no content
   * checkout serves the compiled catalog — but it is worth surfacing, because a
   * user who edited a dossier and saw nothing change needs to know whether the
   * file was read at all.
   */
  app.get(
    "/api/content/status",
    withErrors(() => {
      const status = cokey.contentStatus();
      return {
        ...status,
        /** Providers the content documents that the compiled catalog cannot serve. */
        unsupportedProviders: cokey.undocumentedProviders(),
      };
    }),
  );

  /** The terms document, in reading order. */
  app.get(
    "/api/content/terms",
    withErrors(() => {
      const sections = cokey.termsSections();
      return {
        sections,
        updatedAt: sections.reduce<string | undefined>(
          (newest, section) => (!newest || section.updatedAt > newest ? section.updatedAt : newest),
          undefined,
        ),
      };
    }),
  );

  /**
   * Force a re-read of the content directory.
   *
   * The filesystem watcher covers local edits; this exists for the cases a
   * watcher cannot see — a network mount, a container with a read-only bind, or
   * a `git checkout` in a directory the watcher lost. It reports whether
   * anything actually changed so the UI can tell "reloaded" from "no change"
   * instead of showing a spinner that means nothing.
   */
  app.post(
    "/api/content/reload",
    withErrors(() => {
      const changed = cokey.reloadContent();
      const status = cokey.contentStatus();
      if (changed) {
        cokey.events.emit({
          type: "content.updated",
          level: "success",
          message: "Content reloaded on request",
          data: { providers: status.counts.providers },
        });
      }
      return { changed, ...status };
    }),
  );

  /**
   * One provider's dossier.
   *
   * Returned on its own because the provider detail window opens long after the
   * catalog list was fetched, and re-fetching the whole list to open a panel is
   * how a dashboard starts feeling slow.
   */
  app.get(
    "/api/content/providers/:providerId",
    withErrors((request) => {
      const { providerId } = request.params as { providerId: string };
      const dossier = cokey.curateProvider(providerId);
      return {
        providerId,
        dossier,
        /** Whether the provider exists in the live catalog at all. */
        known: cokey.providerStatuses().some((provider) => provider.id === providerId),
      };
    }),
  );
}
