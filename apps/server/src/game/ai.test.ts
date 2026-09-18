import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import { prisma } from "@souk/db";
import { createServer } from "../createServer.js";
import { setPhaseTimingForTesting } from "./roomSession.js";
import type { ServerMessage } from "@souk/engine";

const server = createServer();
let wsUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  wsUrl = `ws://localhost:${port}/ws`;
  // Bots think for real in production (700-1800ms) so a human sees a
  // pause; here we only care that they act autonomously, so make that
  // wait negligible instead of slowing the test suite down.
  setPhaseTimingForTesting({ aiThinkDelayMs: [5, 15] });
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
      email: `aiplayer${userCounter}@example.com`,
      username: `aiplayer_${userCounter}`,
      password: "correcthorsebattery",
    });
  return { token: res.body.token as string, userId: res.body.user.id as string };
}

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
    const timeout = setTimeout(() => reject(new Error("timed out waiting for a message")), 5000);
    socket.waiters.push((msg) => {
      clearTimeout(timeout);
      resolve(msg);
    });
  });
}

/** Keeps reading state broadcasts until `predicate` matches one, or times out. */
async function waitForState(
  socket: QueuedSocket,
  predicate: (view: Extract<ServerMessage, { type: "state" }>["view"]) => boolean,
): Promise<Extract<ServerMessage, { type: "state" }>["view"]> {
  const deadline = Date.now() + 5000;
  for (;;) {
    if (Date.now() > deadline) throw new Error("timed out waiting for matching state");
    const msg = await nextMessage(socket);
    if (msg.type === "state" && predicate(msg.view)) return msg.view;
  }
}

describe("AI opponents", () => {
  it("a bot commits its own raid autonomously, with no client acting on its behalf", async () => {
    const host = await signupToken();
    const guest1 = await signupToken();
    const guest2 = await signupToken();

    const createRes = await request(server).post("/rooms").set("Authorization", `Bearer ${host.token}`);
    const code = createRes.body.room.code as string;
    await request(server).post(`/rooms/${code}/join`).set("Authorization", `Bearer ${guest1.token}`);
    await request(server).post(`/rooms/${code}/join`).set("Authorization", `Bearer ${guest2.token}`);

    const botRes = await request(server)
      .post(`/rooms/${code}/bots`)
      .set("Authorization", `Bearer ${host.token}`)
      .send({ difficulty: "medium" });
    const botUserId = botRes.body.room.players[3].userId as string;

    await request(server).post(`/rooms/${code}/start`).set("Authorization", `Bearer ${host.token}`);

    const ticket = await request(server)
      .post(`/rooms/${code}/ws-ticket`)
      .set("Authorization", `Bearer ${host.token}`);
    const ws = await connect(ticket.body.ticket as string);
    await nextMessage(ws); // initial state snapshot

    // Round 1 starts in Trade — advance straight to Raid.
    ws.ws.send(JSON.stringify({ type: "action", action: { kind: "ADVANCE_PHASE" } }));
    await waitForState(ws, (view) => view.phase === "raid");

    // Nobody (including this test) ever sends a RAID_COMMIT for the bot —
    // it must appear because the server decided and applied it on its own.
    const afterBotActs = await waitForState(ws, (view) => view.raid.committedPlayerIds.includes(botUserId));
    expect(afterBotActs.raid.committedPlayerIds).toContain(botUserId);

    await new Promise<void>((resolve) => {
      ws.ws.once("close", () => resolve());
      ws.ws.close();
    });
  });
});
