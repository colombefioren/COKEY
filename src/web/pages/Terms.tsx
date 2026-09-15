import { ContactGrid } from "../components/Contact.js";
import { CokeyLogo } from "../components/Logo.js";
import { Markdown } from "../components/Markdown.js";
import { Panel } from "../components/Primitives.js";
import { CREATOR } from "../links.js";
import { useLang } from "../lang.js";

const TERMS_SECTIONS: Array<{ order: number; title: string; body: string }> = [
  {
    order: 1,
    title: "What COKEY is",
    body: `COKEY is a **local gateway that runs on your machine**. It stores API keys you
already own, encrypts them at rest, and exposes one OpenAI-compatible endpoint
that rotates between them.

It does not create accounts, buy credits, or hold funds on your behalf. There is
no service behind it to sign up to, and nobody is running a COKEY server that
your requests travel through.`,
  },
  {
    order: 2,
    title: "Your keys, your responsibility",
    body: `Every credential in this pool belongs to an account **you** control.

You are responsible for:

- obtaining those keys lawfully;
- the accuracy of the account information you store;
- anything a request made with them does upstream.

The author of COKEY is not a party to any agreement between you and a provider.
Adding a key is you acting on your own account, in your own name, under your own
agreement with that provider.`,
  },
  {
    order: 3,
    title: "Provider terms come first",
    body: `Providers set the rules for their own free tiers: rate limits, permitted uses,
how many accounts one person may hold, and whether automated routing is allowed
at all.

**Where COKEY's behaviour and a provider's terms disagree, the provider's terms
win.** It is your job to know them before you add a key.

Using COKEY to evade a provider's limits is not a supported use. Rotation exists
so that a rate limit on one key does not take down your own legitimate traffic;
it is not a way to obtain more capacity than the provider has offered you.`,
  },
  {
    order: 4,
    title: "No warranty",
    body: `COKEY is provided **as is**, without warranty of any kind.

It may route a request to a provider that is down, report a limit number the
provider has since changed, or lose a cooldown window. Rate limits, quotas and
latency figures shown in the dashboard are what a provider publishes — and
published numbers drift.

Nothing here is a guarantee of availability, correctness or fitness for a
particular purpose.`,
  },
  {
    order: 5,
    title: "Limitation of liability",
    body: `To the extent permitted by law, the author is not liable for any indirect,
incidental or consequential loss arising from your use of COKEY.

That includes, without limitation:

- lost credits or paid capacity;
- suspended or terminated provider accounts;
- failed, delayed or misrouted requests;
- prompts or responses exposed by a provider;
- legal trouble with a third party.

You agree to use the software at your own risk, and to resolve any dispute with
a provider directly with that provider.`,
  },
  {
    order: 6,
    title: "No monitoring, no telemetry",
    body: `COKEY has **no analytics, no phone-home, and no server component you did not
start yourself**.

Everything is stored in a local SQLite database under your data directory. Your
keys, your prompts, your request history and your provider catalog live on your
disk and nowhere else.

The dashboard's own fonts and icons are served from the gateway rather than a
CDN, for the same reason: rendering a page should not tell a third party that
you opened it.

If you join a community to ask a question, you choose what to share.`,
  },
  {
    order: 7,
    title: "Acceptable use",
    body: `Do not use COKEY to:

- attack, probe or overload a provider;
- resell free capacity as a paid service;
- circumvent an account ban;
- do anything unlawful in your jurisdiction or the provider's.

The automatic egress pool exists so that one provider's per-IP limit does not
collapse your own legitimate traffic — not as a means of disguising abusive
volume. Spreading abuse across exits is still abuse.`,
  },
  {
    order: 8,
    title: "Changes",
    body: `These terms may change with the software. Continuing to use a new version means
accepting the terms that ship with it.

Because this repository is public and versioned, the exact wording at any point
in the project's history is one \`git log\` away:

\`\`\`bash
git log --follow -p src/web/pages/Terms.tsx
\`\`\`

The version you are running is shown in the gateway's status bar.`,
  },
];

export function Terms() {
  const { t } = useLang();
  return (
    <>
      <Panel hue="lav" title={t("Terms of service")}>
        <p className="small muted" style={{ marginTop: 0 }}>
          {t(
            "The short version: COKEY is a local tool, the keys are yours, the providers' rules come first, and legal problems between you and a provider are yours to resolve.",
          )}
        </p>

        <div className="terms">
          {TERMS_SECTIONS.map((section) => (
            <section key={section.order}>
              <h3>
                {section.order}. {t(section.title)}
              </h3>
              <Markdown text={t(section.body)} />
            </section>
          ))}
        </div>
      </Panel>

      <Panel hue="butter" title={t("In one sentence")}>
        <div className="hint-box">
          {t(
            "You are responsible for the keys you add, you agree to respect each provider's own terms and limits, and you accept that the author is not liable for how you use their software or for any consequences that follow from it. If a dispute arises with a provider, it is between you and that provider.",
          )}
        </div>
      </Panel>

      <Panel hue="sky" title={t("Contact the creator")}>
        <p className="small muted" style={{ marginTop: 0 }}>
          {t("COKEY is built and maintained by one person,")} <strong>@{CREATOR.name}</strong>.{" "}
          {t(
            "Bug reports, provider tips, a free tier that changed under you, and pull requests are all welcome - the software is MIT licensed and the source is public. If a provider changed its limits, the fastest fix is a pull request against the catalog rather than an issue.",
          )}
        </p>
        <ContactGrid />
      </Panel>

      <div className="closing">
        <CokeyLogo height={28} className="closing-logo" />
        <span>{t("a tool for broke lads made by a broke princess")}</span>
      </div>
    </>
  );
}
