import { RESOURCE_IDS } from "@souk/shared";
import type { GameStateView } from "@souk/engine";
import { Card, CoinBadge, MerchantPortrait, ResourceToken, colors, fonts } from "@souk/ui";
import { getCharacter, useCharacterAssignment, type CharacterId } from "../characters.js";
import { useFxExpression } from "../fx.js";

export function VictoryPanel({
  view,
  names,
  roomCode,
}: {
  view: GameStateView;
  names: Record<string, string>;
  roomCode: string;
}) {
  const tally = view.finalTally;
  const assignment = useCharacterAssignment(roomCode, view.players.length);
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
          <VictoryRow
            key={p.id}
            playerId={p.id}
            rank={i + 1}
            isWinner={winners.has(p.id)}
            isYou={p.id === view.you.id}
            name={names[p.id] ?? p.id}
            wealth={tally.wealthByPlayer[p.id] ?? 0}
            characterId={assignment[p.seat] ?? "shimada"}
          />
        ))}
      </div>

      <div
        style={{
          marginTop: "24px",
          paddingTop: "18px",
          borderTop: `1px solid ${colors.line}`,
          textAlign: "left",
        }}
      >
        <h3 style={{ fontFamily: fonts.headingLatin, fontSize: "0.95rem", marginBottom: "10px", textAlign: "center" }}>
          Your final holdings
        </h3>
        <div style={{ display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <CoinBadge coins={view.you.coins} />
          {RESOURCE_IDS.map((r) => (
            <div key={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
              <ResourceToken resource={r} count={view.you.resources[r]} size="sm" />
              <span style={{ fontSize: "0.68rem", color: colors.inkSoft }}>
                worth {view.you.resources[r] * view.prices[r]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function VictoryRow({
  playerId,
  rank,
  isWinner,
  isYou,
  name,
  wealth,
  characterId,
}: {
  playerId: string;
  rank: number;
  isWinner: boolean;
  isYou: boolean;
  name: string;
  wealth: number;
  characterId: CharacterId;
}) {
  const expression = useFxExpression(playerId);
  const character = getCharacter(characterId);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        borderRadius: "10px",
        background: isWinner ? colors.goldBg : colors.paper2,
        border: isWinner ? `1px solid ${colors.gold}` : `1px solid ${colors.line}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ position: "relative" }}>
          {isWinner && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: -8,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${colors.lantern}55, transparent 70%)`,
                animation: "souk-victory-glow 1800ms ease-in-out infinite",
              }}
            />
          )}
          <MerchantPortrait
            color={character.color}
            portraitUrl={character.portraits[expression] ?? character.portraits.idle}
            size="sm"
            expression={expression}
          />
        </div>
        <span style={{ textAlign: "left" }}>
          {isWinner ? "🏆 " : `${rank}. `}
          {name}
          {isYou && " (you)"}
        </span>
      </div>
      <span style={{ fontFamily: fonts.headingLatin, fontWeight: 600 }}>{wealth}</span>
    </div>
  );
}
