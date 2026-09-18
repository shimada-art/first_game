import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, PageShell, TextField, colors, fonts } from "@souk/ui";
import { GAME_NAME, isValidRoomCode, normalizeRoomCode } from "@souk/shared";
import { useAuth } from "../auth/AuthContext.js";
import { createRoom, joinRoom } from "../api/rooms.js";
import { ApiError } from "../api/client.js";

export function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    setError(null);
    setBusy(true);
    try {
      const room = await createRoom();
      navigate(`/room/${room.code}`);
    } catch {
      setError("Couldn't create a room right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const code = normalizeRoomCode(joinCode);
    if (!isValidRoomCode(code)) {
      setError("That doesn't look like a room code — check for typos.");
      return;
    }
    setBusy(true);
    try {
      await joinRoom(code);
      navigate(`/room/${code}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "room_not_found") {
        setError("No room found with that code.");
      } else if (err instanceof ApiError && err.code === "room_full") {
        setError("That room is already full.");
      } else if (err instanceof ApiError && err.code === "room_not_joinable") {
        setError("That game has already started.");
      } else {
        setError("Couldn't join that room right now.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <div style={{ margin: "auto", width: "min(480px, 90vw)", padding: "24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "24px" }}>
          <h1 style={{ fontFamily: fonts.headingLatin, fontSize: "1.8rem" }}>{GAME_NAME}</h1>
          <button
            onClick={() => void logout()}
            style={{ background: "none", border: "none", color: colors.inkSoft, cursor: "pointer", textDecoration: "underline" }}
          >
            Log out
          </button>
        </div>

        <p style={{ marginBottom: "24px" }}>Welcome back, {user?.displayName}.</p>

        <Card style={{ marginBottom: "16px" }}>
          <h2 style={{ fontFamily: fonts.headingLatin, fontSize: "1.2rem", marginBottom: "12px" }}>
            Host a table
          </h2>
          <p style={{ color: colors.inkSoft, marginBottom: "16px" }}>
            Start a new room and invite 3–5 other merchants.
          </p>
          <Button onClick={() => void handleCreate()} disabled={busy} style={{ width: "100%" }}>
            Create room
          </Button>
        </Card>

        <Card>
          <h2 style={{ fontFamily: fonts.headingLatin, fontSize: "1.2rem", marginBottom: "12px" }}>
            Join a table
          </h2>
          <form onSubmit={(e) => void handleJoin(e)}>
            <TextField
              label="Room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
            />
            <Button type="submit" variant="secondary" disabled={busy} style={{ width: "100%" }}>
              Join room
            </Button>
          </form>
        </Card>

        {error && (
          <p role="alert" style={{ color: colors.textileText, marginTop: "16px" }}>
            {error}
          </p>
        )}
      </div>
    </PageShell>
  );
}
