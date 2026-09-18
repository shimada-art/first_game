import type { PrivateUserView } from "@souk/shared";
import { apiFetch, setToken } from "./client.js";

interface AuthResponse {
  token: string;
  user: PrivateUserView;
}

export async function signup(input: {
  email: string;
  username: string;
  password: string;
}): Promise<PrivateUserView> {
  const res = await apiFetch<AuthResponse>("/auth/signup", { method: "POST", body: input, auth: false });
  setToken(res.token);
  return res.user;
}

export async function login(input: { email: string; password: string }): Promise<PrivateUserView> {
  const res = await apiFetch<AuthResponse>("/auth/login", { method: "POST", body: input, auth: false });
  setToken(res.token);
  return res.user;
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
  setToken(null);
}

export async function fetchMe(): Promise<PrivateUserView> {
  const res = await apiFetch<{ user: PrivateUserView }>("/me");
  return res.user;
}

export async function updateProfile(input: {
  displayName?: string;
  avatarKey?: string | null;
  bio?: string | null;
}): Promise<PrivateUserView> {
  const res = await apiFetch<{ user: PrivateUserView }>("/me", { method: "PATCH", body: input });
  return res.user;
}
