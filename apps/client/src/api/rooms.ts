import type { AiDifficulty, RoomView } from "@souk/shared";
import { apiFetch } from "./client.js";

export async function createRoom(): Promise<RoomView> {
  const res = await apiFetch<{ room: RoomView }>("/rooms", { method: "POST" });
  return res.room;
}

export async function getRoom(code: string): Promise<RoomView> {
  const res = await apiFetch<{ room: RoomView }>(`/rooms/${code}`);
  return res.room;
}

export async function joinRoom(code: string): Promise<RoomView> {
  const res = await apiFetch<{ room: RoomView }>(`/rooms/${code}/join`, { method: "POST" });
  return res.room;
}

export async function leaveRoom(code: string): Promise<RoomView> {
  const res = await apiFetch<{ room: RoomView }>(`/rooms/${code}/leave`, { method: "POST" });
  return res.room;
}

export async function startGame(code: string): Promise<{ gameId: string }> {
  return apiFetch<{ gameId: string }>(`/rooms/${code}/start`, { method: "POST" });
}

export async function mintWsTicket(code: string): Promise<string> {
  const res = await apiFetch<{ ticket: string }>(`/rooms/${code}/ws-ticket`, { method: "POST" });
  return res.ticket;
}

export async function addBot(code: string, difficulty: AiDifficulty): Promise<RoomView> {
  const res = await apiFetch<{ room: RoomView }>(`/rooms/${code}/bots`, {
    method: "POST",
    body: { difficulty },
  });
  return res.room;
}

export async function removeBot(code: string, botUserId: string): Promise<RoomView> {
  const res = await apiFetch<{ room: RoomView }>(`/rooms/${code}/bots/${botUserId}`, { method: "DELETE" });
  return res.room;
}
