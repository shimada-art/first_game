import type { GameStateView } from "@souk/engine";
import { PhaseTimer, colors, fonts } from "@souk/ui";
import { SettingsPanel } from "./SettingsPanel.js";

const PHASE_LABEL: Record<GameStateView["phase"], string> = {
  market: "Market",
  whisper: "Whisper",
  trade: "Trade",
  raid: "Raid",
  reveal: "Reveal",
  gameover: "Game Over",
};

const ROLE_LABEL: Record<string, string> = {
  smuggler: "The Smuggler",
  silverTongue: "The Silver Tongue",
  appraiser: "The Appraiser",
  bodyguard: "The Bodyguard",
  broker: "The Broker",
  doubleWhisper: "Double Whisper",
  underwriter: "The Underwriter",
  speculator: "The Speculator",
  locksmith: "The Locksmith",
  fence: "The Fence",
  closer: "The Closer",
  opportunist: "The Opportunist",
};

export function TopBar({ view, phaseDeadlineAt }: { view: GameStateView; phaseDeadlineAt: number | null }) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        flexWrap: "wrap",
        padding: "14px 56px 14px 24px",
        background: `linear-gradient(180deg, ${colors.woodDark}, ${colors.nightVeil})`,
        borderBottom: `2px solid ${colors.brass}`,
        boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
      }}
    >
      <div>
        <span style={{ fontFamily: fonts.headingLatin, fontWeight: 600, color: colors.paper }}>
          Round {view.round}/{view.config.roundCount}
        </span>
        <span style={{ marginLeft: "12px", color: colors.lantern, letterSpacing: "0.03em" }}>
          {PHASE_LABEL[view.phase]}
        </span>
      </div>
      <PhaseTimer deadlineAt={phaseDeadlineAt} onDark />
      <div style={{ fontSize: "0.85rem", color: colors.paper, opacity: 0.8, fontStyle: "italic" }}>
        {ROLE_LABEL[view.you.role] ?? view.you.role}
      </div>
      {/* Absolutely positioned against the bar itself (not the flex flow) so it
          stays pinned to the true top-right corner even when the round/phase,
          timer, and role text wrap onto their own lines on a narrow screen. */}
      <div style={{ position: "absolute", top: "10px", right: "16px" }}>
        <SettingsPanel />
      </div>
    </div>
  );
}
