import { useCallback, useEffect, useRef, useState } from "react";
import type { EngineAction, GameStateView, ServerMessage } from "@souk/engine";
import type { ResourceId } from "@souk/shared";
import { WS_URL } from "../env.js";
import { mintWsTicket } from "../api/rooms.js";

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface GameSocket {
  status: ConnectionStatus;
  view: GameStateView | null;
  phaseDeadlineAt: number | null;
  lastError: { code: string; message?: string | undefined } | null;
  appraiserResult: { targetId: string; tokens: ResourceId[] } | null;
  sendAction: (action: EngineAction) => void;
  clearError: () => void;
}

const RECONNECT_DELAY_MS = 1500;

export function useGameSocket(code: string): GameSocket {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [view, setView] = useState<GameStateView | null>(null);
  const [phaseDeadlineAt, setPhaseDeadlineAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<{ code: string; message?: string | undefined } | null>(null);
  const [appraiserResult, setAppraiserResult] = useState<{ targetId: string; tokens: ResourceId[] } | null>(
    null,
  );

  const wsRef = useRef<WebSocket | null>(null);
  const closedByUsRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    closedByUsRef.current = false;

    async function connect(): Promise<void> {
      setStatus((prev) => (prev === "open" ? prev : "connecting"));
      let ticket: string;
      try {
        ticket = await mintWsTicket(code);
      } catch {
        scheduleReconnect();
        return;
      }
      if (closedByUsRef.current) return;

      const ws = new WebSocket(`${WS_URL}/ws?ticket=${ticket}`);
      wsRef.current = ws;

      ws.onopen = () => setStatus("open");

      ws.onmessage = (event) => {
        const msg = JSON.parse(String(event.data)) as ServerMessage;
        if (msg.type === "state") {
          setView(msg.view);
          setPhaseDeadlineAt(msg.phaseDeadlineAt);
        } else if (msg.type === "error") {
          setLastError({ code: msg.code, message: msg.message });
        } else if (msg.type === "appraiserResult") {
          setAppraiserResult({ targetId: msg.targetId, tokens: msg.tokens });
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (closedByUsRef.current) {
          setStatus("closed");
        } else {
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    function scheduleReconnect(): void {
      if (closedByUsRef.current) return;
      setStatus("reconnecting");
      reconnectTimerRef.current = setTimeout(() => void connect(), RECONNECT_DELAY_MS);
    }

    void connect();

    return () => {
      closedByUsRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [code]);

  const sendAction = useCallback((action: EngineAction) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "action", action }));
    }
  }, []);

  const clearError = useCallback(() => setLastError(null), []);

  return { status, view, phaseDeadlineAt, lastError, appraiserResult, sendAction, clearError };
}
