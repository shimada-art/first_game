import type { GameStateView } from "@souk/engine";
import { Card, colors, fonts } from "@souk/ui";

export function VictoryPanel({ view, names }: { view: GameStateView; names: Record<string, string> }) {
  const tally = view.finalTally;
  if (!tally) return null;

  const ranked = [...view.players].sort((a, b) => tally.wealthByPlayer[b.id]! - tally.wealthByPlayer[a.id]!);
  const winners = new Set(tally.winnerIds);

  return (
    <Card style={{ textAlign: "center" }}>
      <h2 style={{ fontFamily: fonts.headingLatin, fontSize: "1.6rem", marginBottom: "6px" }}>
        {tally.winnerIds.length > 1 ? "The bazaar crowns co-champions!" : "The bazaar has a champion!"}
      </h2>
      <p style={{ color: colors.inkSoft, marginBottom: "20px" }}>
        Final wealth — coins plus every resource at round {view.config.roundCount}'s prices.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {ranked.map((p, i) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 16px",
              borderRadius: "8px",
              background: winners.has(p.id) ? colors.goldBg : colors.paper2,
              border: winners.has(p.id) ? `1px solid ${colors.gold}` : `1px solid ${colors.line}`,
            }}
          >
            <span>
              {winners.has(p.id) ? "🏆 " : `${i + 1}. `}
              {names[p.id] ?? p.id}
              {p.id === view.you.id && " (you)"}
            </span>
            <span style={{ fontFamily: fonts.headingLatin, fontWeight: 600 }}>{tally.wealthByPlayer[p.id]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
