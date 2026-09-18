import { useParams } from "react-router-dom";
import { Button, PageShell, colors, fonts } from "@souk/ui";
import { useGameSocket } from "../game/useGameSocket.js";
import { usePlayerNames } from "../game/usePlayerNames.js";
import { TopBar } from "../game/TopBar.js";
import { MarketBoard } from "../game/MarketBoard.js";
import { PlayerRail } from "../game/PlayerRail.js";
import { ResourceTray } from "../game/ResourceTray.js";
import { TradePanel } from "../game/panels/TradePanel.js";
import { RaidPanel } from "../game/panels/RaidPanel.js";
import { WhisperPanel } from "../game/panels/WhisperPanel.js";
import { RevealPanel } from "../game/panels/RevealPanel.js";
import { VictoryPanel } from "../game/panels/VictoryPanel.js";

export function GamePage() {
  const { code = "" } = useParams();
  const { status, view, phaseDeadlineAt, lastError, appraiserResult, sendAction, clearError } = useGameSocket(code);
  const names = usePlayerNames(code);

  if (!view) {
    return (
      <PageShell>
        <p style={{ margin: "auto" }}>
          {status === "reconnecting" ? "Reconnecting to the souk…" : "Stepping into the souk…"}
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <TopBar view={view} phaseDeadlineAt={phaseDeadlineAt} />

      {status === "reconnecting" && (
        <div style={{ background: colors.textileBg, color: colors.textileText, textAlign: "center", padding: "6px" }}>
          Connection lost — reconnecting…
        </div>
      )}

      <div style={{ maxWidth: "760px", margin: "0 auto", width: "100%", padding: "16px", flex: 1 }}>
        <MarketBoard view={view} names={names} />
        <PlayerRail view={view} youId={view.you.id} names={names} />

        {lastError && (
          <div
            role="alert"
            style={{
              background: colors.textileBg,
              color: colors.textileText,
              padding: "10px 14px",
              borderRadius: "8px",
              marginBottom: "14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{lastError.message ?? lastError.code.replaceAll("_", " ")}</span>
            <button onClick={clearError} style={{ background: "none", border: "none", cursor: "pointer", color: colors.textileText }}>
              ✕
            </button>
          </div>
        )}

        {appraiserResult && (
          <div style={{ background: colors.secretBg, color: colors.secret, padding: "10px 14px", borderRadius: "8px", marginBottom: "14px" }}>
            Appraised {names[appraiserResult.targetId] ?? "them"}: {appraiserResult.tokens.join(", ") || "nothing"}
          </div>
        )}

        {view.phase === "market" && (
          <p style={{ textAlign: "center", color: colors.inkSoft, fontFamily: fonts.bodyLatin, padding: "20px 0" }}>
            The market is updating prices for the new round…
          </p>
        )}
        {view.phase === "whisper" && <WhisperPanel view={view} sendAction={sendAction} names={names} />}
        {view.phase === "trade" && <TradePanel view={view} sendAction={sendAction} names={names} />}
        {view.phase === "raid" && <RaidPanel view={view} sendAction={sendAction} names={names} />}
        {view.phase === "reveal" && <RevealPanel view={view} names={names} />}
        {view.phase === "gameover" && <VictoryPanel view={view} names={names} />}

        {view.phase !== "gameover" && (
          <div style={{ textAlign: "center", marginTop: "16px" }}>
            <Button variant="secondary" onClick={() => sendAction({ kind: "ADVANCE_PHASE" })} style={{ fontSize: "0.85rem", padding: "6px 14px" }}>
              Move to next phase
            </Button>
          </div>
        )}
      </div>

      <ResourceTray view={view} />
    </PageShell>
  );
}
