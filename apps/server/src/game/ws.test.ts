import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import { prisma } from "@souk/db";
import { createServer } from "../createServer.js";
import type { ServerMessage } from "@souk/engine";

const server = createServer();
let wsUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  wsUrl = `ws://localhost:${port}/ws`;
});

afterAll(async () => {
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(async () => {
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();
});

let userCounter = 0;
async function signupToken(): Promise<{ token: string; userId: string }> {
  userCounter += 1;
  const res = await request(server)
    .post("/auth/signup")
    .send({
      email: `wsplayer${userCounter}@example.com`,
      username: `wsplayer_${userCounter}`,
      password: "correcthorsebattery",
    });
  return { token: res.body.token as string, userId: res.body.user.id as string };
}

async function setUpStartedGame(playerCount: number) {
  const players = [];
  for (let i = 0; i < playerCount; i++) players.push(await signupToken());

  const createRes = await request(server).post("/rooms").set("Authorization", `Bearer ${players[0]!.token}`);
  const code = createRes.body.room.code as string;
  for (let i = 1; i < playerCount; i++) {
    await request(server).post(`/rooms/${code}/join`).set("Authorization", `Bearer ${players[i]!.token}`);
  }
  await request(server).post(`/rooms/${code}/start`).set("Authorization", `Bearer ${players[0]!.token}`);

  return { players, code };
}

async function ticketFor(code: string, token: string): Promise<string> {
  const res = await request(server).post(`/rooms/${code}/ws-ticket`).set("Authorization", `Bearer ${token}`);
  return res.body.ticket as string;
}

// The server can push the initial state the instant the connection is
// accepted — before a caller has had a chance to `await connect(...)` and
// then separately attach a listener. Queue every message from the moment
// the socket is created (synchronously, before `open` even fires) so
// `nextMessage` can never race a message that already arrived.
interface QueuedSocket {
  ws: WebSocket;
  queue: ServerMessage[];
  waiters: Array<(msg: ServerMessage) => void>;
}

function connect(ticket: string): Promise<QueuedSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsUrl}?ticket=${ticket}`);
    const socket: QueuedSocket = { ws, queue: [], waiters: [] };
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString()) as ServerMessage;
      const waiter = socket.waiters.shift();
      if (waiter) waiter(msg);
      else socket.queue.push(msg);
    });
    ws.once("open", () => resolve(socket));
    ws.once("error", reject);
  });
}

function nextMessage(socket: QueuedSocket): Promise<ServerMessage> {
  const queued = socket.queue.shift();
  if (queued) return Promise.resolve(queued);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timed out waiting for a message")), 3000);
    socket.waiters.push((msg) => {
      clearTimeout(timeout);
      resolve(msg);
    });
  });
}

async function closeAll(sockets: QueuedSocket[]): Promise<void> {
  await Promise.all(
    sockets.map(
      ({ ws }) =>
        new Promise<void>((resolve) => {
          ws.once("close", () => resolve());
          ws.close();
        }),
    ),
  );
}

describe("WebSocket gateway", () => {
  it("rejects a connection with no ticket or an invalid one", async () => {
    const ws = new WebSocket(`${wsUrl}?ticket=not-a-real-ticket`);
    const closeCode = await new Promise<number>((resolve) => ws.once("close", (code) => resolve(code)));
    expect(closeCode).toBe(4001);
  });

  it("sends each player their own private initial state on connect, hiding others' resources", async () => {
    const { players, code } = await setUpStartedGame(4);
    const ticket = await ticketFor(code, players[0]!.token);
    const ws = await connect(ticket);

    const first = await nextMessage(ws);
    expect(first.type).toBe("state");
    if (first.type !== "state") throw new Error("expected state");
    expect(first.view.you.id).toBe(players[0]!.userId);
    expect(first.view.you.resources.spice).toBe(2); // starting resources per spec §4
    const otherPublic = first.view.players.find((p) => p.id === players[1]!.userId)!;
    expect(otherPublic).not.toHaveProperty("resources");

    await closeAll([ws]);
  });

  it("broadcasts a state update to every connected player after an action", async () => {
    const { players, code } = await setUpStartedGame(4);
    const sockets = await Promise.all(
      players.map(async (p) => connect(await ticketFor(code, p.token))),
    );
    // drain each socket's initial state message
    await Promise.all(sockets.map((ws) => nextMessage(ws)));

    // round 1 starts directly in the Trade phase (spec §5.2) — a Bank buy is legal immediately
    sockets[0]!.ws.send(JSON.stringify({ type: "action", action: { kind: "BANK_TRADE", resource: "spice", direction: "buy" } }));

    const updates = await Promise.all(sockets.map((ws) => nextMessage(ws)));
    for (const msg of updates) {
      expect(msg.type).toBe("state");
    }
    const actorsView = updates[0];
    if (actorsView?.type !== "state") throw new Error("expected state");
    expect(actorsView.view.you.resources.spice).toBe(3);

    await closeAll(sockets);
  });

  it("sends a private error to the acting player when an action is invalid, without affecting others", async () => {
    const { players, code } = await setUpStartedGame(4);
    const sockets = await Promise.all(
      players.map(async (p) => connect(await ticketFor(code, p.token))),
    );
    await Promise.all(sockets.map((ws) => nextMessage(ws)));

    // Not the Raid phase yet (round 1 starts in Trade) — RAID_COMMIT should be rejected
    sockets[0]!.ws.send(JSON.stringify({ type: "action", action: { kind: "RAID_COMMIT", targetId: players[1]!.userId, tokens: 1 } }));
    const errorMsg = await nextMessage(sockets[0]!);
    expect(errorMsg).toMatchObject({ type: "error", code: "wrong_phase" });

    await closeAll(sockets);
  });

  it("flips connected to false on disconnect and true again on reconnect", async () => {
    const { players, code } = await setUpStartedGame(4);
    const wsA = await connect(await ticketFor(code, players[0]!.token));
    const wsB = await connect(await ticketFor(code, players[1]!.token));
    await nextMessage(wsA);
    await nextMessage(wsB);

    wsA.ws.close();
    const afterDisconnect = await nextMessage(wsB);
    if (afterDisconnect.type !== "state") throw new Error("expected state");
    expect(afterDisconnect.view.players.find((p) => p.id === players[0]!.userId)!.connected).toBe(false);

    const wsA2 = await connect(await ticketFor(code, players[0]!.token));
    await nextMessage(wsA2); // A's own fresh snapshot
    const afterReconnect = await nextMessage(wsB);
    if (afterReconnect.type !== "state") throw new Error("expected state");
    expect(afterReconnect.view.players.find((p) => p.id === players[0]!.userId)!.connected).toBe(true);

    await closeAll([wsA2, wsB]);
  });
});
