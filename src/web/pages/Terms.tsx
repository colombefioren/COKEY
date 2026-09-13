import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "../api.js";
import type { ContentStatusResponse, TermsResponse } from "../types.js";
import { ContactGrid } from "../components/Contact.js";
import { Markdown } from "../components/Markdown.js";
import { Panel } from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";
import { CREATOR } from "../links.js";

/**
 * Terms of service.
 *
 * Plain language on purpose. The short version is that COKEY is a local tool
 * that holds your own keys, and that what you do with those keys is your
 * responsibility rather than the author's.
 *
 * The document itself lives in the content repository so it can be corrected
 * without a release. The copy below is the compiled fallback for a checkout with
 * no content beside it — the same text, kept in step by hand, and rendered only
 * when the repository is absent.
 */
const FALLBACK_SECTIONS: Array<{ title: string; body: ReactNode }> = [
  {
    title: "1. What COKEY is",
    body: (
      <>
        COKEY is a local gateway that runs on your machine. It stores API keys you already own,
        encrypts them at rest, and exposes one OpenAI-compatible endpoint that rotates between them.
        It does not create accounts, buy credits, or hold funds on your behalf.
      </>
    ),
  },
  {
    title: "2. Your keys, your responsibility",
    body: (
      <>
        Every credential in this pool belongs to an account you control. You are responsible for
        obtaining those keys lawfully, for the accuracy of the account information you store, and
        for anything a request made with them does upstream. The author of COKEY is not a party to
        any agreement between you and a provider.
      </>
    ),
  },
  {
    title: "3. Provider terms come first",
    body: (
      <>
        Providers set the rules for their own free tiers: rate limits, permitted uses, how many
        accounts one person may hold, whether automated routing is allowed at all. Where COKEY's
        behaviour and a provider's terms disagree, the provider's terms win, and it is your job to
        know them before you add a key. Using this to evade a provider's limits is not a supported
        use.
      </>
    ),
  },
  {
    title: "4. No warranty",
    body: (
      <>
        COKEY is provided as is, without warranty of any kind. It may route a request to a provider
        that is down, return a limit number that the provider has since changed, or lose a cooldown
        window. Rate limits, quotas and latency figures shown in the dashboard are what a provider
        publishes, and published numbers drift. Nothing here is a guarantee of availability.
      </>
    ),
  },
  {
    title: "5. Limitation of liability",
    body: (
      <>
        To the extent permitted by law, the author is not liable for any indirect, incidental or
        consequential loss arising from your use of COKEY. That includes, without limitation, lost
        credits, suspended provider accounts, failed requests, leaked prompts, or legal trouble with
        a third party. You agree to use the software at your own risk and to resolve any dispute
        with a provider directly with that provider.
      </>
    ),
  },
  {
    title: "6. No monitoring, no telemetry",
    body: (
      <>
        COKEY has no analytics, no phone-home, and no server component you did not start yourself.
        Everything is stored in a local SQLite database under your data directory. If you join a
        community to ask a question, you choose what to share.
      </>
    ),
  },
  {
    title: "7. Acceptable use",
    body: (
      <>
        Do not use COKEY to attack a provider, to resell free capacity as a paid service, to
        circumvent an account ban, or for anything unlawful in your jurisdiction or the provider's.
        The automatic egress pool exists so that one provider's per-IP limit does not collapse your
        own legitimate traffic, not as a means of disguising abusive volume.
      </>
    ),
  },
  {
    title: "8. Changes",
    body: (
      <>
        These terms may change with the software. Continuing to use a new version means accepting
        the terms that ship with it. The version you are running is shown in the status bar.
      </>
    ),
  },
];

export function Terms({ refreshKey = 0 }: { refreshKey?: number }) {
  const toast = useToast();
  const [terms, setTerms] = useState<TermsResponse | null>(null);
  const [status, setStatus] = useState<ContentStatusResponse | null>(null);
  const [reloading, setReloading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [document, contentStatus] = await Promise.all([
        api.contentTerms(),
        api.contentStatus(),
      ]);
      setTerms(document);
      setStatus(contentStatus);
    } catch {
      // No content endpoint reachable: the compiled copy below still renders.
      // This is a supported state, not an error worth a toast.
      setTerms(null);
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  /**
   * Re-read the content directory.
   *
   * The filesystem watcher already covers local edits, so this is the manual
   * path for a network mount or a container where watching does not work. It
   * reports honestly: "no change" is a real answer and saying "reloaded" when
   * nothing moved would make the button a lie.
   */
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

  const curated = terms && terms.sections.length > 0 ? terms.sections : null;

  return (
    <>
      <Panel
        hue="lav"
        title="Terms of service"
        actions={
          status ? (
            <span className="small faint">
              {curated
                ? `curated content · ${status.counts.providers} provider dossiers`
                : "compiled copy"}
            </span>
          ) : null
        }
      >
        <p className="small muted" style={{ marginTop: 0 }}>
          The short version: COKEY is a local tool, the keys are yours, the providers' rules come
          first, and legal problems between you and a provider are yours to resolve.
        </p>

        {curated ? (
          <>
            <div className="terms">
              {curated.map((section) => (
                <section key={section.slug}>
                  <h3>
                    {section.order}. {section.title}
                  </h3>
                  <Markdown text={section.body} />
                </section>
              ))}
            </div>
            <div className="row between center small faint" style={{ marginTop: "0.75rem" }}>
              <span>
                {terms?.updatedAt
                  ? `Last content revision: ${terms.updatedAt}`
                  : "No revision date recorded"}
              </span>
              <button className="btn" onClick={() => void reload()} disabled={reloading}>
                {reloading ? "reloading..." : "reload content"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="terms">
              {FALLBACK_SECTIONS.map((section) => (
                <section key={section.title}>
                  <h3>{section.title}</h3>
                  <div>{section.body}</div>
                </section>
              ))}
            </div>
            <p className="small faint">
              This is the compiled copy. Point COKEY at a content checkout (the{" "}
              <code>COKEY_CMS_DIR</code> environment variable) to edit these terms without a
              release.
            </p>
          </>
        )}
      </Panel>

      <Panel hue="butter" title="In one sentence">
        <div className="hint-box">
          You are responsible for the keys you add, you agree to respect each provider's own terms
          and limits, and you accept that the author is not liable for how you use their software or
          for any consequences that follow from it. If a dispute arises with a provider, it is
          between you and that provider.
        </div>
      </Panel>

      <Panel hue="sky" title="Contact the creator">
        <p className="small muted" style={{ marginTop: 0 }}>
          COKEY is built and maintained by one person, <strong>@{CREATOR.name}</strong>. Bug
          reports, provider tips, a free tier that changed under you, and pull requests are all
          welcome - the software is MIT licensed and the source is public.
        </p>
        <ContactGrid />
      </Panel>

      <div className="closing">
        <strong>COKEY</strong>
        <span>a tool for broke lads made by a broke princess</span>
      </div>
    </>
  );
}
