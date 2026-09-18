import { randomUUID } from "node:crypto";

interface TicketData {
  userId: string;
  roomId: string;
  expiresAt: number;
}

const TICKET_TTL_MS = 30_000;
const tickets = new Map<string, TicketData>();

/**
 * Short-lived, single-use WebSocket connection ticket. Avoids putting a
 * long-lived bearer session token in a query string, where it's liable to
 * end up in proxy/server access logs.
 */
export function mintWsTicket(userId: string, roomId: string): string {
  const ticket = randomUUID();
  tickets.set(ticket, { userId, roomId, expiresAt: Date.now() + TICKET_TTL_MS });
  return ticket;
}

export function consumeWsTicket(ticket: string): { userId: string; roomId: string } | null {
  const data = tickets.get(ticket);
  tickets.delete(ticket);
  if (!data || data.expiresAt < Date.now()) return null;
  return { userId: data.userId, roomId: data.roomId };
}

setInterval(() => {
  const now = Date.now();
  for (const [ticket, data] of tickets) {
    if (data.expiresAt < now) tickets.delete(ticket);
  }
}, TICKET_TTL_MS).unref();
