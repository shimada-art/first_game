import { RESOURCE_IDS } from "@souk/shared";
import type { GameStateView } from "@souk/engine";
import { CoinBadge, MerchantPortrait, ResourceToken, colors, fonts } from "@souk/ui";
import { getCharacter, useCharacterAssignment } from "./characters.js";
import { useFxRegistrar } from "./fx.js";

export function ResourceTray({ view, roomCode }: { view: GameStateView; roomCode: string }) {
  const assignment = useCharacterAssignment(roomCode, view.players.length);
  const character = getCharacter(assignment[view.you.seat] ?? "shimada");
  const registerAnchor = useFxRegistrar();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        padding: "14px 24px",
        margin: "0 auto",
        maxWidth: "1040px",
        width: "100%",
        background: `linear-gradient(180deg, ${colors.woodDark}, ${colors.nightVeil})`,
        borderTop: `2px solid ${colors.brass}`,
        boxShadow: "0 -6px 16px rgba(0,0,0,0.35)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <MerchantPortrait color={character.color} portraitUrl={character.portraits.idle} size="md" active />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontFamily: fonts.headingLatin,
              fontSize: "0.85rem",
              fontWeight: 600,
              color: colors.paper,
            }}
          >
            You
          </span>
          <span style={{ fontSize: "0.68rem", color: character.color }} title={character.title}>
            {character.name}
          </span>
        </div>
        {RESOURCE_IDS.map((r) => (
          <div key={r} ref={(el) => registerAnchor(`you:resource:${r}`, el)}>
            <ResourceToken resource={r} count={view.you.resources[r]} onDark />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontFamily: fonts.bodyLatin, color: colors.paper, opacity: 0.75, fontSize: "0.85rem" }}>
          Your coins
        </span>
        <div ref={(el) => registerAnchor("you:coins", el)}>
          <CoinBadge coins={view.you.coins} />
        </div>
      </div>
    </div>
  );
}
