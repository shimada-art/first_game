import { RESOURCE_IDS } from "@souk/shared";
import type { GameStateView } from "@souk/engine";
import { CoinBadge, ResourceToken, colors, fonts } from "@souk/ui";

export function ResourceTray({ view }: { view: GameStateView }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        padding: "16px 24px",
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
        {RESOURCE_IDS.map((r) => (
          <ResourceToken key={r} resource={r} count={view.you.resources[r]} onDark />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontFamily: fonts.bodyLatin, color: colors.paper, opacity: 0.75, fontSize: "0.85rem" }}>
          Your coins
        </span>
        <CoinBadge coins={view.you.coins} />
      </div>
    </div>
  );
}
