import { CREATOR, REPO_URL } from "../links.js";

/**
 * Where to reach the person who built this.
 *
 * The README deliberately carries no contact block: the app is where someone
 * using COKEY actually is, so the links live in Terms (and About) instead of in
 * a file only a contributor would open.
 */
function ContactCard({
  label,
  value,
  href: link,
  hint,
}: {
  label: string;
  value: string;
  href: string;
  hint: string;
}) {
  return (
    <a className="contact-card" href={link} target="_blank" rel="noreferrer">
      <span className="contact-label">{label}</span>
      <span className="contact-value mono">{value}</span>
      <span className="contact-hint small faint">{hint}</span>
    </a>
  );
}

export function ContactGrid() {
  return (
    <div className="contact-grid">
      <ContactCard
        label="GitHub"
        value={`@${CREATOR.name}`}
        href={CREATOR.github}
        hint="Issues, pull requests and the source"
      />
      <ContactCard
        label="LinkedIn"
        value={CREATOR.name}
        href={CREATOR.linkedin}
        hint="Work and updates"
      />
      <ContactCard
        label="Facebook"
        value="colombe.fioren"
        href={CREATOR.facebook}
        hint="Say hello"
      />
      <ContactCard
        label="Repository"
        value="colombefioren/COKEY"
        href={REPO_URL}
        hint="Open source, MIT licensed"
      />
    </div>
  );
}
