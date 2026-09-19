import type { GameStateView, PendingClaim } from "@souk/engine";
import { MerchantPortrait, colors, fonts } from "@souk/ui";
import { getCharacter, useCharacterAssignment, type CharacterId } from "./characters.js";
import { useFxExpression, useFxRegistrar } from "./fx.js";
import { useAnimationSpeedMultiplier } from "../settings/SettingsContext.js";

export function PlayerRail({
  view,
  youId,
  roomCode,
  names,
}: {
  view: GameStateView;
  youId: string;
  roomCode: string;
  names: Record<string, string>;
}) {
  const others = view.players.filter((p) => p.id !== youId).sort((a, b) => a.seat - b.seat);
  const pendingClaim = view.whisper.pending?.claim ?? null;
  const assignment = useCharacterAssignment(roomCode, view.players.length);

  return (
    <div
      style={{
        display: "flex",
        gap: "18px",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "4px 0 22px",
      }}
    >
      {others.map((p) => (
        <OpponentCard
          key={p.id}
          view={view}
          playerId={p.id}
          isAI={p.isAI}
          connected={p.connected}
          whisperCardsRemaining={p.whisperCardsRemaining}
          displayName={names[p.id] ?? "…"}
          characterId={assignment[p.seat] ?? "shimada"}
          pendingClaim={pendingClaim}
        />
      ))}
    </div>
  );
}

function OpponentCard({
  view,
  playerId,
  isAI,
  connected,
  whisperCardsRemaining,
  displayName,
  characterId,
  pendingClaim,
}: {
  view: GameStateView;
  playerId: string;
  isAI: boolean;
  connected: boolean;
  whisperCardsRemaining: number;
  displayName: string;
  characterId: CharacterId;
  pendingClaim: PendingClaim | null;
}) {
  const registerAnchor = useFxRegistrar();
  const expression = useFxExpression(playerId);
  const speed = useAnimationSpeedMultiplier();
  const character = getCharacter(characterId);
  const committed = view.raid.committedPlayerIds.includes(playerId);
  const speaking = pendingClaim?.claimantId === playerId;
  const addressed = pendingClaim?.targetId === playerId;
  // A structurally real signal (not decorative): this seat is AI and
  // genuinely still owes a decision right now — raid needs everyone
  // committed to resolve, and a pending Whisper claim addressed to this
  // bot is waiting on its response.
  const botDeciding = isAI && ((view.phase === "raid" && !committed) || (addressed && !speaking));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        minWidth: "72px",
      }}
    >
      <div ref={(el) => registerAnchor(`portrait:${playerId}`, el)}>
        <MerchantPortrait
          color={character.color}
          portraitUrl={character.portraits[expression] ?? character.portraits.idle}
          size="md"
          faded={!connected}
          active={speaking || addressed || botDeciding}
          expression={botDeciding ? "thinking" : expression}
          speedMultiplier={speed}
          badge={
            view.phase === "raid" && committed ? (
              <span
                style={{
                  background: colors.gem,
                  color: "#fff",
                  borderRadius: "50%",
                  width: 18,
                  height: 18,
                  fontSize: "0.65rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `2px solid ${colors.nightVeil}`,
                }}
                title="Committed a raid"
              >
                ✓
              </span>
            ) : undefined
          }
        />
      </div>
      <span
        style={{
          fontFamily: fonts.headingLatin,
          fontSize: "0.85rem",
          fontWeight: 600,
          color: colors.paper,
          textShadow: "0 1px 2px rgba(0,0,0,0.6)",
        }}
      >
        {displayName}
      </span>
      <span
        style={{
          fontSize: "0.66rem",
          color: character.color,
          textShadow: "0 1px 2px rgba(0,0,0,0.6)",
        }}
        title={character.title}
      >
        {character.name}
      </span>
      <span
        style={{
          fontSize: "0.68rem",
          color: "rgba(237,230,214,0.75)",
        }}
      >
        {whisperCardsRemaining} whisper{whisperCardsRemaining === 1 ? "" : "s"}
      </span>
      {speaking && (
        <span style={{ fontSize: "0.68rem", color: colors.lantern, fontStyle: "italic" }}>
          whispering…
        </span>
      )}
      {!speaking && botDeciding && (
        <span style={{ fontSize: "0.68rem", color: colors.brass, fontStyle: "italic" }}>
          deciding…
        </span>
      )}
    </div>
  );
}
