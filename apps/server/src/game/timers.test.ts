import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import { prisma } from "@souk/db";
import { createServer } from "../createServer.js";
import { setPhaseTimingForTesting } from "./roomSession.js";
import type { ServerMessage } from "@souk/engine";

// Real games wait 30s for a Raid commitment — inject a short one so this
// test doesn't have to. Set before the server is exercised at all.
setPhaseTimingForTesting({ phase: { raid: 150 }, revealPauseMs: 100 });

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
      email: `timerplayer${userCounter}@example.com`,
      username: `timerplayer_${userCounter}`,
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
    const timeout = setTimeout(() => reject(new Error("timed out waiting for a message")), 3000);
    socket.waiters.push((msg) => {
      clearTimeout(timeout);
      resolve(msg);
    });
  });
}

function waitForPhase(socket: QueuedSocket, phase: string): Promise<ServerMessage & { type: "state" }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`timed out waiting for phase ${phase}`)), 5000);
    const check = async (): Promise<void> => {
      const msg = await nextMessage(socket);
      if (msg.type === "state" && msg.view.phase === phase) {
        clearTimeout(timeout);
        resolve(msg);
      } else {
        void check();
      }
    };
    void check();
  });
}

describe("server-side phase timer auto-pass", () => {
  it("auto-commits {targetId: null, tokens: 0} for a straggler when the Raid timer expires — never ejects them", async () => {
    const players = [];
    for (let i = 0; i < 4; i++) players.push(await signupToken());

    const createRes = await request(server).post("/rooms").set("Authorization", `Bearer ${players[0]!.token}`);
    const code = createRes.body.room.code as string;
    for (let i = 1; i < 4; i++) {
      await request(server).post(`/rooms/${code}/join`).set("Authorization", `Bearer ${players[i]!.token}`);
    }
    await request(server).post(`/rooms/${code}/start`).set("Authorization", `Bearer ${players[0]!.token}`);

    const sockets = await Promise.all(
      players.map(async (p) => {
        const res = await request(server).post(`/rooms/${code}/ws-ticket`).set("Authorization", `Bearer ${p.token}`);
        return connect(res.body.ticket as string);
      }),
    );
    await Promise.all(sockets.map((s) => nextMessage(s))); // drain initial state

    // Round 1 starts in Trade (spec §5.2) — advance straight to Raid.
    sockets[0]!.ws.send(JSON.stringify({ type: "action", action: { kind: "ADVANCE_PHASE" } }));
    await Promise.all(sockets.map((s) => waitForPhase(s, "raid")));

    // Only players 0 and 1 commit; 2 and 3 are stragglers who never act.
    sockets[0]!.ws.send(
      JSON.stringify({ type: "action", action: { kind: "RAID_COMMIT", targetId: players[1]!.userId, tokens: 1 } }),
    );
    sockets[1]!.ws.send(JSON.stringify({ type: "action", action: { kind: "RAID_COMMIT", targetId: null, tokens: 0 } }));

    // Don't advance manually — let the (shortened) Raid timer fire the auto-pass.
    const revealMsg = await waitForPhase(sockets[2]!, "reveal");
    expect(revealMsg.view.reveal).not.toBeNull();
    const raidResults = revealMsg.view.reveal!.raids;
    expect(raidResults).toHaveLength(4); // every player resolved, including the two who never committed
    for (const strayId of [players[2]!.userId, players[3]!.userId]) {
      const result = raidResults.find((r) => r.attackerId === strayId)!;
      expect(result.outcome).toBe("no_action");
      expect(result.tokensCommitted).toBe(0);
    }
    // Nobody was ejected — all 4 are still players in the game.
    expect(revealMsg.view.players).toHaveLength(4);

    await Promise.all(sockets.map(({ ws }) => new Promise<void>((resolve) => {
      ws.once("close", () => resolve());
      ws.close();
    })));
  });
});
