import { createServer as createHttpServer, type Server } from "node:http";
import express, { type NextFunction, type Request, type Response } from "express";
import { GAME_NAME } from "@souk/shared";
import { authRouter } from "./auth/routes.js";
import { roomsRouter } from "./rooms/routes.js";
import { AppError } from "./errors.js";
import { attachWsGateway } from "./game/wsGateway.js";

export function createServer(): Server {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", game: GAME_NAME });
  });

  app.use(authRouter);
  app.use(roomsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.code });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  });

  const server = createHttpServer(app);
  attachWsGateway(server);
  return server;
}
