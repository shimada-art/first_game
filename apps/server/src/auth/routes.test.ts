import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "@souk/db";
import { createServer } from "../createServer.js";

const app = createServer();

async function signup(overrides: Partial<{ email: string; username: string; password: string }> = {}) {
  return request(app)
    .post("/auth/signup")
    .send({
      email: "merchant@example.com",
      username: "spice_trader",
      password: "correcthorsebattery",
      ...overrides,
    });
}

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

describe("POST /auth/signup", () => {
  it("creates a user and returns a session token", async () => {
    const res = await signup();

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      email: "merchant@example.com",
      username: "spice_trader",
      displayName: "spice_trader",
    });
    expect(res.body.user.passwordHash).toBeUndefined();

    const stored = await prisma.user.findUnique({ where: { email: "merchant@example.com" } });
    expect(stored?.passwordHash).not.toBe("correcthorsebattery");
  });

  it("rejects a duplicate email with 409", async () => {
    await signup();
    const res = await signup({ username: "another_trader" });

    expect(res.status).toBe(409);
    expect(res.body.field).toBe("email");
  });

  it("rejects invalid input with 400", async () => {
    const res = await signup({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("logs in with correct credentials", async () => {
    await signup();

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "merchant@example.com", password: "correcthorsebattery" });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it("rejects an incorrect password with 401", async () => {
    await signup();

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "merchant@example.com", password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("rejects an unknown email with 401 (not a distinguishable 404)", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "ghost@example.com", password: "whatever12" });

    expect(res.status).toBe(401);
  });
});

describe("GET /me", () => {
  it("rejects a request with no token", async () => {
    const res = await request(app).get("/me");
    expect(res.status).toBe(401);
  });

  it("rejects a bogus token", async () => {
    const res = await request(app).get("/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("returns the caller's own profile for a valid token", async () => {
    const signupRes = await signup();
    const { token } = signupRes.body;

    const res = await request(app).get("/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("merchant@example.com");
  });
});

describe("PATCH /me", () => {
  it("updates the caller's own profile fields", async () => {
    const signupRes = await signup();
    const { token } = signupRes.body;

    const res = await request(app)
      .patch("/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ displayName: "Amira the Bold", bio: "Trades in whispers." });

    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe("Amira the Bold");
    expect(res.body.user.bio).toBe("Trades in whispers.");
  });

  it("rejects an empty update body", async () => {
    const signupRes = await signup();
    const { token } = signupRes.body;

    const res = await request(app).patch("/me").set("Authorization", `Bearer ${token}`).send({});

    expect(res.status).toBe(400);
  });
});

describe("POST /auth/logout", () => {
  it("revokes the session so the token no longer works", async () => {
    const signupRes = await signup();
    const { token } = signupRes.body;

    const logoutRes = await request(app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    expect(logoutRes.status).toBe(204);

    const meRes = await request(app).get("/me").set("Authorization", `Bearer ${token}`);
    expect(meRes.status).toBe(401);
  });
});
