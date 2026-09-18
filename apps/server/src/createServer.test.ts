import { describe, expect, it, afterEach } from "vitest";
import type { AddressInfo } from "node:net";
import { createServer } from "./createServer.js";

describe("createServer", () => {
  const server = createServer();

  afterEach(() => {
    server.closeAllConnections?.();
  });

  it("responds to GET /health with status ok", async () => {
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    const res = await fetch(`http://localhost:${port}/health`);
    const body = (await res.json()) as { status: string; game: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("responds 404 for unknown routes", async () => {
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    const res = await fetch(`http://localhost:${port}/nope`);

    expect(res.status).toBe(404);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
