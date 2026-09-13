import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { DatabaseClient } from "../src/core/db/database.js";
import { ProxyPoolRepo } from "../src/core/db/proxy-pool.repo.js";
import {
  collectHealthy,
  mapWithConcurrency,
} from "../src/core/providers/proxy-health.js";
import { ProxyPoolService } from "../src/core/providers/proxy-pool.js";

function poolService(): {
  pool: ProxyPoolService;
  db: DatabaseClient;
  cleanup: () => void;
} {
  const dir = mkdtempSync(join(tmpdir(), "cokey-proxy-health-"));
  const db = new DatabaseClient(join(dir, "cokey.db"));
  const pool = new ProxyPoolService(new ProxyPoolRepo(db));
  return {
    pool,
    db,
    cleanup: () => db.close(),
  };
}

describe("mapWithConcurrency", () => {
  it("returns results in input order regardless of completion order", async () => {
    const out = await mapWithConcurrency(
      [1, 2, 3, 4],
      2,
      (value) => new Promise((resolve) => setTimeout(() => resolve(value * 10), (5 - value) * 5)),
    );
    expect(out).toEqual([10, 20, 30, 40]);
  });

  it("runs at most `limit` in flight at once", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 3, async (value) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return value;
    });
    expect(peak).toBe(3);
  });

  it("handles an empty input without launching workers", async () => {
    const out = await mapWithConcurrency([], 4, async () => 1);
    expect(out).toEqual([]);
  });
});

describe("collectHealthy", () => {
  it("keeps only the proxies that answer and counts the ones probed", async () => {
    const { healthy, checked } = await collectHealthy(
      ["socks5://a.test:1", "socks5://b.test:2", "socks5://c.test:3"],
      { concurrency: 3, probe: (url) => Promise.resolve({ ok: url.includes("b.test") }) },
    );
    expect(checked).toBe(3);
    expect(healthy).toEqual(["socks5://b.test:2"]);
  });

  it("stops probing once the limit of healthy exits is found", async () => {
    const probed: string[] = [];
    const { healthy, checked } = await collectHealthy(
      [
        "socks5://a.test:1",
        "socks5://b.test:2",
        "socks5://c.test:3",
        "socks5://d.test:4",
        "socks5://e.test:5",
      ],
      {
        limit: 2,
        concurrency: 1,
        probe: (url) => {
          probed.push(url);
          return Promise.resolve({ ok: true });
        },
      },
    );
    expect(healthy).toEqual(["socks5://a.test:1", "socks5://b.test:2"]);
    expect(probed).toEqual(["socks5://a.test:1", "socks5://b.test:2"]);
    expect(checked).toBe(2);
  });
});

describe("ProxyPoolService.verify", () => {
  it("deletes failing entries when pruning and reports counts", async () => {
    const { pool, db, cleanup } = poolService();
    try {
      pool.add("socks5://a.test:1");
      pool.add("socks5://b.test:2");
      pool.add("socks5://c.test:3");

      const verdicts = new Map<string, { ok: boolean }>([
        ["socks5://a.test:1", { ok: true }],
        ["socks5://b.test:2", { ok: false }],
        ["socks5://c.test:3", { ok: true }],
      ]);

      const result = await pool.verify((url) => Promise.resolve(verdicts.get(url) ?? { ok: false }));
      expect(result.checked).toBe(3);
      expect(result.healthy).toBe(2);
      expect(result.removed).toBe(1);
      expect(result.dead).toHaveLength(1);
      expect(db.db.prepare(`SELECT COUNT(*) AS n FROM proxy_pool`).get()).toEqual({ n: 2 });
    } finally {
      cleanup();
    }
  });

  it("reports without deleting when prune is false", async () => {
    const { pool, db, cleanup } = poolService();
    try {
      pool.add("socks5://a.test:1");
      pool.add("socks5://b.test:2");

      const result = await pool.verify(
        (url) => Promise.resolve({ ok: url.endsWith(".test:1") }),
        { prune: false },
      );
      expect(result.healthy).toBe(1);
      expect(result.removed).toBe(0);
      expect(db.db.prepare(`SELECT COUNT(*) AS n FROM proxy_pool`).get()).toEqual({ n: 2 });
    } finally {
      cleanup();
    }
  });

  it("ignores disabled entries", async () => {
    const { pool, cleanup } = poolService();
    try {
      pool.add("socks5://good.test:1");
      const disabled = pool.add("socks5://disabled.test:2");
      pool.setEnabled(disabled.row.id, false);

      const result = await pool.verify((url) => Promise.resolve({ ok: url.endsWith(".test:1") }));
      expect(result.checked).toBe(1);
      expect(result.healthy).toBe(1);
      expect(result.removed).toBe(0);
    } finally {
      cleanup();
    }
  });
});