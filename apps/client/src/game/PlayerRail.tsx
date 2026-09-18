import type { GameStateView } from "@souk/engine";
import { MerchantPortrait, colors, fonts } from "@souk/ui";
import { getCharacter, useCharacterAssignment } from "./characters.js";
import { useFxRegistrar } from "./fx.js";

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
  const registerAnchor = useFxRegistrar();

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
      {others.map((p) => {
        const committed = view.raid.committedPlayerIds.includes(p.id);
        const displayName = names[p.id] ?? "…";
        const speaking = pendingClaim?.claimantId === p.id;
        const addressed = pendingClaim?.targetId === p.id;
        const character = getCharacter(assignment[p.seat] ?? "shimada");
        // A structurally real signal (not decorative): this seat is AI and
        // genuinely still owes a decision right now — raid needs everyone
        // committed to resolve, and a pending Whisper claim addressed to
        // this bot is waiting on its response.
        const botDeciding =
          p.isAI && ((view.phase === "raid" && !committed) || (addressed && !speaking));

        return (
          <div
            key={p.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
              minWidth: "72px",
            }}
          >
            <div ref={(el) => registerAnchor(`portrait:${p.id}`, el)}>
              <MerchantPortrait
                color={character.color}
                portraitUrl={character.portraits.idle}
                size="md"
                faded={!p.connected}
                active={speaking || addressed || botDeciding}
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
              {p.whisperCardsRemaining} whisper{p.whisperCardsRemaining === 1 ? "" : "s"}
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
      })}
    </div>
  );
}
