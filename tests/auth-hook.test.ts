import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { makeAuthHook } from "../src/server/middleware/auth.js";
import { SessionStore } from "../src/server/session.js";

function buildApp() {
  const app = Fastify();
  const sessions = new SessionStore();

  app.addHook(
    "onRequest",
    makeAuthHook({
      sessions,
      verifyApiKey: (presented) => (presented === "good-key" ? { name: "test" } : undefined),
      verifyPassword: (password) => password === "good-password",
    }),
  );

  app.get("/", { config: { public: true } }, async () => ({ ok: true }));
  app.get("/assets/logo.svg", { config: { public: true } }, async () => "svg");
  app.post("/api/session", { config: { public: true } }, async () => ({ authenticated: true }));
  app.get("/api/secret", async () => ({ secret: true }));
  app.get("/api/session/danger", async () => ({ secret: true }));

  return { app, sessions };
}

describe("makeAuthHook", () => {
  it("allows a route explicitly marked public", async () => {
    const { app } = buildApp();
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
  });

  it("allows another route explicitly marked public", async () => {
    const { app } = buildApp();
    const res = await app.inject({ method: "GET", url: "/assets/logo.svg" });
    expect(res.statusCode).toBe(200);
  });

  it("rejects a protected route with no credentials", async () => {
    const { app } = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/secret" });
    expect(res.statusCode).toBe(401);
  });

  it("does not treat a route as public just because its path shares a prefix with one that is", async () => {
    const { app } = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/session/danger" });
    expect(res.statusCode).toBe(401);
  });

  it("accepts a valid API key via bearer auth", async () => {
    const { app } = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/secret",
      headers: { authorization: "Bearer good-key" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("accepts the admin password via bearer auth", async () => {
    const { app } = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/secret",
      headers: { authorization: "Bearer good-password" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects an invalid bearer token", async () => {
    const { app } = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/secret",
      headers: { authorization: "Bearer wrong" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("accepts a valid session cookie", async () => {
    const { app, sessions } = buildApp();
    const token = sessions.create();
    const res = await app.inject({
      method: "GET",
      url: "/api/secret",
      headers: { cookie: `cokey_session=${token}` },
    });
    expect(res.statusCode).toBe(200);
  });
});
