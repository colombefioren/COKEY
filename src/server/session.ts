import { randomBytes } from "node:crypto";

/** In-memory browser sessions. A restart invalidates every cookie. */
export class SessionStore {
  private readonly sessions = new Map<string, number>();

  constructor(private readonly ttlMs = 7 * 24 * 60 * 60 * 1000) {}

  create(): string {
    const token = randomBytes(32).toString("hex");
    this.sessions.set(token, Date.now());
    return token;
  }

  has(token: string | undefined): boolean {
    if (!token) return false;
    const createdAt = this.sessions.get(token);
    if (createdAt === undefined) return false;
    if (Date.now() - createdAt > this.ttlMs) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }

  delete(token: string | undefined): void {
    if (token) this.sessions.delete(token);
  }
}
