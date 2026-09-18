import { useEffect, useRef } from "react";
import { RESOURCE_IDS } from "@souk/shared";
import type { GameStateView } from "@souk/engine";
import { Card, colors, fonts, resourceColors } from "@souk/ui";

const RESOURCE_LABEL = { spice: "Spice", textile: "Textile", gold: "Gold", gem: "Gem" } as const;

const EVENT_LABEL: Record<string, string> = {
  spiceFestival: "Spice Festival — Spice price frozen",
  caravanSeason: "Caravan Season — raids steal +1",
  rumorMill: "Rumor Mill — everyone gets a free Whisper",
  bankHoliday: "Bank Holiday — the Bank is closed",
  gemRush: "Gem Rush — Gem moves ±2",
  quietMarket: "Quiet Market — no prices change",
  generousTerms: "Generous Terms — Verify is free",
  tightPurses: "Tight Purses — Bank rates worsen",
};

export function MarketBoard({ view, names }: { view: GameStateView; names: Record<string, string> }) {
  const previousPrices = useRef<Record<string, number>>({});
  const directions = useRef<Record<string, "up" | "down" | "flat">>({});

  useEffect(() => {
    for (const r of RESOURCE_IDS) {
      const prev = previousPrices.current[r];
      if (prev !== undefined && prev !== view.prices[r]) {
        directions.current[r] = view.prices[r] > prev ? "up" : "down";
      }
      previousPrices.current[r] = view.prices[r];
    }
  }, [view.prices]);

  const isFinalBazaar = view.round === view.config.finalBazaarRound;

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h2 style={{ fontFamily: fonts.headingLatin, fontSize: "1.1rem", margin: 0 }}>The Souk Market</h2>
        {isFinalBazaar && (
          <span style={{ color: colors.secret, fontWeight: 600, fontSize: "0.85rem" }}>
            Final Bazaar — Bank closed
          </span>
        )}
      </div>

      {view.currentEvent && (
        <p
          style={{
            background: colors.secretBg,
            color: colors.secret,
            padding: "8px 12px",
            borderRadius: "8px",
            marginBottom: "14px",
            fontSize: "0.9rem",
          }}
        >
          {EVENT_LABEL[view.currentEvent] ?? view.currentEvent}
        </p>
      )}

      {view.reckoning && view.round === view.reckoning.round + 1 && (
        <p
          style={{
            background: colors.goldBg,
            color: colors.goldText,
            padding: "8px 12px",
            borderRadius: "8px",
            marginBottom: "14px",
            fontSize: "0.9rem",
          }}
        >
          The Reckoning: {names[view.reckoning.lowestWealthPlayerId] ?? "The trailing merchant"} received{" "}
          {view.reckoning.amountGiven} coins from the Bank to stay in the fight.
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        {RESOURCE_IDS.map((r) => {
          const dir = directions.current[r] ?? "flat";
          return (
            <div
              key={r}
              style={{
                borderRadius: "10px",
                border: `1px solid ${resourceColors[r]}`,
                padding: "10px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "0.8rem", color: colors.inkSoft }}>{RESOURCE_LABEL[r]}</div>
              <div style={{ fontFamily: fonts.headingLatin, fontSize: "1.4rem", fontWeight: 600 }}>
                {view.prices[r]}
                {dir === "up" && <span style={{ color: colors.gem }}> ↑</span>}
                {dir === "down" && <span style={{ color: colors.textile }}> ↓</span>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
