import { createServer as createHttpServer, type Server } from "node:http";
import express, { type NextFunction, type Request, type Response } from "express";
import { GAME_NAME } from "@souk/shared";
import { authRouter } from "./auth/routes.js";

export function createServer(): Server {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", game: GAME_NAME });
  });

  app.use(authRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  });

  return createHttpServer(app);
}
