import type { GameStateView } from "@souk/engine";
import { colors, fonts } from "@souk/ui";

export function PlayerRail({
  view,
  youId,
  names,
}: {
  view: GameStateView;
  youId: string;
  names: Record<string, string>;
}) {
  const others = view.players.filter((p) => p.id !== youId).sort((a, b) => a.seat - b.seat);

  return (
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center", padding: "12px 0" }}>
      {others.map((p) => {
        const committed = view.raid.committedPlayerIds.includes(p.id);
        const displayName = names[p.id] ?? "…";
        return (
          <div
            key={p.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              opacity: p.connected ? 1 : 0.45,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: colors.paper2,
                border: `2px solid ${colors.line}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: fonts.headingLatin,
                fontWeight: 600,
                position: "relative",
              }}
              title={p.connected ? undefined : "Disconnected"}
            >
              {displayName.slice(0, 1).toUpperCase()}
              {view.phase === "raid" && committed && (
                <span
                  style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    background: colors.gem,
                    color: "#fff",
                    borderRadius: "50%",
                    width: 16,
                    height: 16,
                    fontSize: "0.65rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Committed a raid"
                >
                  ✓
                </span>
              )}
            </div>
            <span style={{ fontSize: "0.8rem" }}>{displayName}</span>
            <span style={{ fontSize: "0.7rem", color: colors.inkSoft }}>
              {p.whisperCardsRemaining} whisper{p.whisperCardsRemaining === 1 ? "" : "s"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
