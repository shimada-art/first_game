import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { RoomView } from "@souk/shared";
import { Button, Card, PageShell, colors, fonts } from "@souk/ui";
import { useAuth } from "../auth/AuthContext.js";
import { ApiError } from "../api/client.js";
import { getRoom, joinRoom, leaveRoom, startGame } from "../api/rooms.js";

const POLL_INTERVAL_MS = 2000;

export function RoomPage() {
  const { code = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await getRoom(code);
      setRoom(r);
      if (r.status === "IN_PROGRESS") {
        navigate(`/game/${code}`, { replace: true });
      }
    } catch (err) {
      setError(err instanceof ApiError && err.code === "room_not_found" ? "This room no longer exists." : "Couldn't load the room.");
    }
  }, [code, navigate]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  if (error) {
    return (
      <PageShell>
        <div style={{ margin: "auto", textAlign: "center" }}>
          <p style={{ color: colors.textileText, marginBottom: "16px" }}>{error}</p>
          <Button onClick={() => navigate("/")}>Back to lobby</Button>
        </div>
      </PageShell>
    );
  }

  if (!room) {
    return (
      <PageShell>
        <p style={{ margin: "auto" }}>Opening the room…</p>
      </PageShell>
    );
  }

  const isMember = room.players.some((p) => p.userId === user?.id);
  const isHost = room.hostId === user?.id;
  const canStart = isHost && room.players.length >= room.minPlayers && room.players.length <= room.maxPlayers;
  const inviteLink = `${window.location.origin}/room/${room.code}`;

  async function handleJoin() {
    setBusy(true);
    try {
      await joinRoom(code);
      await refresh();
    } catch {
      setError("Couldn't join this room.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    setBusy(true);
    try {
      await leaveRoom(code);
      navigate("/");
    } catch {
      setError("Couldn't leave the room.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    setBusy(true);
    try {
      await startGame(code);
      navigate(`/game/${code}`);
    } catch (err) {
      setError(err instanceof ApiError ? `Couldn't start: ${err.code.replaceAll("_", " ")}` : "Couldn't start the game.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <div style={{ margin: "auto", width: "min(520px, 92vw)", padding: "24px 0" }}>
        <h1 style={{ fontFamily: fonts.headingLatin, fontSize: "1.8rem", marginBottom: "4px" }}>
          Room {room.code}
        </h1>
        <p style={{ color: colors.inkSoft, marginBottom: "20px" }}>
          Share the code or{" "}
          <button
            onClick={() => void navigator.clipboard.writeText(inviteLink)}
            style={{ background: "none", border: "none", color: colors.spiceText, cursor: "pointer", textDecoration: "underline", padding: 0, font: "inherit" }}
          >
            copy the invite link
          </button>
          .
        </p>

        <Card style={{ marginBottom: "20px" }}>
          <h2 style={{ fontFamily: fonts.headingLatin, fontSize: "1.1rem", marginBottom: "12px" }}>
            Merchants ({room.players.length}/{room.maxPlayers})
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
            {Array.from({ length: room.maxPlayers }, (_, seat) => {
              const player = room.players.find((p) => p.seat === seat);
              return (
                <li
                  key={seat}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: player ? colors.paper2 : "transparent",
                    border: `1px dashed ${colors.line}`,
                    color: player ? colors.ink : colors.inkSoft,
                  }}
                >
                  <span>{player ? player.displayName : "Empty seat"}</span>
                  {player?.isHost && <span style={{ color: colors.gold }}>Host</span>}
                </li>
              );
            })}
          </ul>
        </Card>

        {!isMember && room.status === "WAITING" && (
          <Button onClick={() => void handleJoin()} disabled={busy} style={{ width: "100%", marginBottom: "12px" }}>
            Join this room
          </Button>
        )}

        {isMember && (
          <div style={{ display: "flex", gap: "12px" }}>
            {isHost && (
              <Button onClick={() => void handleStart()} disabled={!canStart || busy} style={{ flex: 1 }}>
                {canStart ? "Start game" : `Need ${room.minPlayers}-${room.maxPlayers} players`}
              </Button>
            )}
            <Button variant="secondary" onClick={() => void handleLeave()} disabled={busy} style={{ flex: isHost ? undefined : 1 }}>
              Leave room
            </Button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
