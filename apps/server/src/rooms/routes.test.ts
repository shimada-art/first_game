import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "@souk/db";
import { MAX_PLAYERS } from "@souk/shared";
import { createServer } from "../createServer.js";

const app = createServer();

let userCounter = 0;

async function signupToken(): Promise<{ token: string; userId: string }> {
  userCounter += 1;
  const res = await request(app)
    .post("/auth/signup")
    .send({
      email: `player${userCounter}@example.com`,
      username: `player_${userCounter}`,
      password: "correcthorsebattery",
    });
  return { token: res.body.token as string, userId: res.body.user.id as string };
}

beforeEach(async () => {
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();
  userCounter = 0;
});

afterAll(async () => {
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

describe("POST /rooms", () => {
  it("creates a room with the caller as host at seat 0", async () => {
    const host = await signupToken();

    const res = await request(app).post("/rooms").set("Authorization", `Bearer ${host.token}`);

    expect(res.status).toBe(201);
    expect(res.body.room.status).toBe("WAITING");
    expect(res.body.room.hostId).toBe(host.userId);
    expect(res.body.room.players).toEqual([
      expect.objectContaining({ userId: host.userId, seat: 0, isHost: true }),
    ]);
    expect(res.body.room.code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).post("/rooms");
    expect(res.status).toBe(401);
  });
});

describe("GET /rooms/:code", () => {
  it("returns 404 for an unknown code", async () => {
    const host = await signupToken();
    const res = await request(app)
      .get("/rooms/ZZZZZZ")
      .set("Authorization", `Bearer ${host.token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("room_not_found");
  });

  it("rejects a malformed code", async () => {
    const host = await signupToken();
    const res = await request(app)
      .get("/rooms/bad-code!")
      .set("Authorization", `Bearer ${host.token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_room_code");
  });

  it("is case-insensitive on the code", async () => {
    const host = await signupToken();
    const createRes = await request(app).post("/rooms").set("Authorization", `Bearer ${host.token}`);
    const code = createRes.body.room.code as string;

    const res = await request(app)
      .get(`/rooms/${code.toLowerCase()}`)
      .set("Authorization", `Bearer ${host.token}`);

    expect(res.status).toBe(200);
    expect(res.body.room.code).toBe(code);
  });
});

describe("POST /rooms/:code/join", () => {
  it("seats a second player at seat 1", async () => {
    const host = await signupToken();
    const guest = await signupToken();
    const createRes = await request(app).post("/rooms").set("Authorization", `Bearer ${host.token}`);
    const code = createRes.body.room.code as string;

    const res = await request(app)
      .post(`/rooms/${code}/join`)
      .set("Authorization", `Bearer ${guest.token}`);

    expect(res.status).toBe(200);
    expect(res.body.room.players).toHaveLength(2);
    expect(res.body.room.players[1]).toEqual(
      expect.objectContaining({ userId: guest.userId, seat: 1, isHost: false }),
    );
  });

  it("is idempotent for a player already in the room", async () => {
    const host = await signupToken();
    const createRes = await request(app).post("/rooms").set("Authorization", `Bearer ${host.token}`);
    const code = createRes.body.room.code as string;

    const res = await request(app)
      .post(`/rooms/${code}/join`)
      .set("Authorization", `Bearer ${host.token}`);

    expect(res.status).toBe(200);
    expect(res.body.room.players).toHaveLength(1);
  });

  it("rejects joining once the room is full", async () => {
    const host = await signupToken();
    const createRes = await request(app).post("/rooms").set("Authorization", `Bearer ${host.token}`);
    const code = createRes.body.room.code as string;

    for (let i = 1; i < MAX_PLAYERS; i++) {
      const guest = await signupToken();
      const joinRes = await request(app)
        .post(`/rooms/${code}/join`)
        .set("Authorization", `Bearer ${guest.token}`);
      expect(joinRes.status).toBe(200);
    }

    const overflow = await signupToken();
    const res = await request(app)
      .post(`/rooms/${code}/join`)
      .set("Authorization", `Bearer ${overflow.token}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("room_full");
  });
});

describe("POST /rooms/:code/leave", () => {
  it("removes a non-host player and frees their seat", async () => {
    const host = await signupToken();
    const guest = await signupToken();
    const createRes = await request(app).post("/rooms").set("Authorization", `Bearer ${host.token}`);
    const code = createRes.body.room.code as string;
    await request(app).post(`/rooms/${code}/join`).set("Authorization", `Bearer ${guest.token}`);

    const res = await request(app)
      .post(`/rooms/${code}/leave`)
      .set("Authorization", `Bearer ${guest.token}`);

    expect(res.status).toBe(200);
    expect(res.body.room.players).toHaveLength(1);
    expect(res.body.room.hostId).toBe(host.userId);
  });

  it("reassigns host to the earliest remaining seat when the host leaves", async () => {
    const host = await signupToken();
    const guest = await signupToken();
    const createRes = await request(app).post("/rooms").set("Authorization", `Bearer ${host.token}`);
    const code = createRes.body.room.code as string;
    await request(app).post(`/rooms/${code}/join`).set("Authorization", `Bearer ${guest.token}`);

    const res = await request(app)
      .post(`/rooms/${code}/leave`)
      .set("Authorization", `Bearer ${host.token}`);

    expect(res.status).toBe(200);
    expect(res.body.room.hostId).toBe(guest.userId);
    expect(res.body.room.players).toEqual([
      expect.objectContaining({ userId: guest.userId, isHost: true }),
    ]);
  });

  it("closes the room once the last player leaves", async () => {
    const host = await signupToken();
    const createRes = await request(app).post("/rooms").set("Authorization", `Bearer ${host.token}`);
    const code = createRes.body.room.code as string;

    const res = await request(app)
      .post(`/rooms/${code}/leave`)
      .set("Authorization", `Bearer ${host.token}`);

    expect(res.status).toBe(200);
    expect(res.body.room.status).toBe("CLOSED");
    expect(res.body.room.players).toHaveLength(0);
  });

  it("rejects leaving a room you're not a member of", async () => {
    const host = await signupToken();
    const outsider = await signupToken();
    const createRes = await request(app).post("/rooms").set("Authorization", `Bearer ${host.token}`);
    const code = createRes.body.room.code as string;

    const res = await request(app)
      .post(`/rooms/${code}/leave`)
      .set("Authorization", `Bearer ${outsider.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("not_a_room_member");
  });
});

describe("POST /rooms/:code/start", () => {
  async function roomWithPlayers(count: number) {
    const host = await signupToken();
    const createRes = await request(app).post("/rooms").set("Authorization", `Bearer ${host.token}`);
    const code = createRes.body.room.code as string;
    const guests = [];
    for (let i = 1; i < count; i++) {
      const guest = await signupToken();
      await request(app).post(`/rooms/${code}/join`).set("Authorization", `Bearer ${guest.token}`);
      guests.push(guest);
    }
    return { host, guests, code };
  }

  it("only the host can start the game", async () => {
    const { code, guests } = await roomWithPlayers(4);
    const res = await request(app)
      .post(`/rooms/${code}/start`)
      .set("Authorization", `Bearer ${guests[0]!.token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("not_room_host");
  });

  it("rejects starting with too few players", async () => {
    const { code, host } = await roomWithPlayers(2);
    const res = await request(app).post(`/rooms/${code}/start`).set("Authorization", `Bearer ${host.token}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("invalid_player_count");
  });

  it("creates a game and marks the room IN_PROGRESS, blocking further joins/leaves", async () => {
    const { code, host, guests } = await roomWithPlayers(4);
    const res = await request(app).post(`/rooms/${code}/start`).set("Authorization", `Bearer ${host.token}`);
    expect(res.status).toBe(201);
    expect(res.body.gameId).toEqual(expect.any(String));

    const roomRes = await request(app).get(`/rooms/${code}`).set("Authorization", `Bearer ${host.token}`);
    expect(roomRes.body.room.status).toBe("IN_PROGRESS");

    const leaveRes = await request(app)
      .post(`/rooms/${code}/leave`)
      .set("Authorization", `Bearer ${guests[0]!.token}`);
    expect(leaveRes.status).toBe(409);
    expect(leaveRes.body.error).toBe("game_in_progress");
  });

  it("rejects starting a room that isn't WAITING", async () => {
    const { code, host } = await roomWithPlayers(4);
    await request(app).post(`/rooms/${code}/start`).set("Authorization", `Bearer ${host.token}`);
    const res = await request(app).post(`/rooms/${code}/start`).set("Authorization", `Bearer ${host.token}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("room_not_waiting");
  });
});

describe("POST /rooms/:code/ws-ticket", () => {
  it("mints a ticket for a room member", async () => {
    const host = await signupToken();
    const createRes = await request(app).post("/rooms").set("Authorization", `Bearer ${host.token}`);
    const code = createRes.body.room.code as string;

    const res = await request(app).post(`/rooms/${code}/ws-ticket`).set("Authorization", `Bearer ${host.token}`);
    expect(res.status).toBe(201);
    expect(res.body.ticket).toEqual(expect.any(String));
  });

  it("rejects a non-member", async () => {
    const host = await signupToken();
    const outsider = await signupToken();
    const createRes = await request(app).post("/rooms").set("Authorization", `Bearer ${host.token}`);
    const code = createRes.body.room.code as string;

    const res = await request(app).post(`/rooms/${code}/ws-ticket`).set("Authorization", `Bearer ${outsider.token}`);
    expect(res.status).toBe(403);
  });
});
