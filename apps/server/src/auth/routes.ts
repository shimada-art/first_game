import { Router } from "express";
import { prisma, type Prisma } from "@souk/db";
import { loginSchema, signupSchema, updateProfileSchema } from "@souk/shared";
import { asyncHandler } from "../asyncHandler.js";
import { getBearerToken, requireAuth, type AuthedRequest } from "./middleware.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createSession, revokeSession } from "./session.js";
import { toPrivateUserView } from "./userView.js";

export const authRouter = Router();

authRouter.post(
  "/auth/signup",
  asyncHandler(async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_input", issues: parsed.error.flatten() });
      return;
    }
    const { email, username, password } = parsed.data;

    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existing) {
      const field = existing.email === email ? "email" : "username";
      res.status(409).json({ error: "already_taken", field });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, username, passwordHash, displayName: username },
    });
    const session = await createSession(user.id);

    res.status(201).json({ token: session.token, user: toPrivateUserView(user) });
  }),
);

authRouter.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_input", issues: parsed.error.flatten() });
      return;
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    const valid = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !valid) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    const session = await createSession(user.id);
    res.status(200).json({ token: session.token, user: toPrivateUserView(user) });
  }),
);

authRouter.post(
  "/auth/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const token = getBearerToken(req);
    if (token) {
      await revokeSession(token);
    }
    res.status(204).end();
  }),
);

authRouter.get("/me", requireAuth, (req, res) => {
  const { user } = req as AuthedRequest;
  res.status(200).json({ user: toPrivateUserView(user) });
});

authRouter.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_input", issues: parsed.error.flatten() });
      return;
    }
    const { user } = req as AuthedRequest;

    // Build the update data conditionally: with exactOptionalPropertyTypes,
    // Prisma's *UpdateInput rejects a key explicitly set to `undefined`.
    const data: Prisma.UserUpdateInput = {};
    if (parsed.data.displayName !== undefined) data.displayName = parsed.data.displayName;
    if (parsed.data.avatarKey !== undefined) data.avatarKey = parsed.data.avatarKey;
    if (parsed.data.bio !== undefined) data.bio = parsed.data.bio;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
    });

    res.status(200).json({ user: toPrivateUserView(updated) });
  }),
);
