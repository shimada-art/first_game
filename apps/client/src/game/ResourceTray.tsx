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
        padding: "14px 18px",
        background: "rgba(0,0,0,0.04)",
        borderTop: `1px solid ${colors.line}`,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {RESOURCE_IDS.map((r) => (
          <ResourceToken key={r} resource={r} count={view.you.resources[r]} />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontFamily: fonts.bodyLatin, color: colors.inkSoft, fontSize: "0.85rem" }}>Your coins</span>
        <CoinBadge coins={view.you.coins} />
      </div>
    </div>
  );
}
