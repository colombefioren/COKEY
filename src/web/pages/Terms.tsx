import type { ReactNode } from "react";
import { ContactGrid } from "../components/Contact.js";
import { Panel } from "../components/Primitives.js";
import { CREATOR } from "../links.js";

/**
 * Terms of service.
 *
 * Plain language on purpose. The short version is that COKEY is a local tool
 * that holds your own keys, and that what you do with those keys is your
 * responsibility rather than the author's.
 */
const SECTIONS: Array<{ title: string; body: ReactNode }> = [
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
        obtaining those keys lawfully, for the accuracy of the account information you store, and for
        anything a request made with them does upstream. The author of COKEY is not a party to any
        agreement between you and a provider.
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
        a third party. You agree to use the software at your own risk and to resolve any dispute with
        a provider directly with that provider.
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
        These terms may change with the software. Continuing to use a new version means accepting the
        terms that ship with it. The version you are running is shown in the sidebar footer.
      </>
    ),
  },
];

export function Terms() {
  return (
    <>
      <Panel title="Terms of service">
        <p className="small muted" style={{ marginTop: 0 }}>
          The short version: COKEY is a local tool, the keys are yours, the providers' rules come
          first, and legal problems between you and a provider are yours to resolve.
        </p>
        <div className="terms">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              <div>{section.body}</div>
            </section>
          ))}
        </div>
      </Panel>

      <Panel title="In one sentence">
        <div className="hint-box">
          You are responsible for the keys you add, you agree to respect each provider's own terms
          and limits, and you accept that the author is not liable for how you use their software or
          for any consequences that follow from it. If a dispute arises with a provider, it is
          between you and that provider.
        </div>
      </Panel>

      <Panel title="Contact the creator">
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
