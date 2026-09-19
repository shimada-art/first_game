import type { GameStateView } from "@souk/engine";
import { Card, colors, fonts } from "@souk/ui";
import { useAnimationSpeedMultiplier } from "../../settings/SettingsContext.js";

/**
 * The brief beat that plays when a real round change lands (server
 * broadcasts a new `view.round` alongside `phase: "market"`) — see
 * `useFxRoundTransition` in fx.tsx for the diff that drives it. Never
 * shown on a plain mount/reconnect, only on a genuine reveal->market
 * transition, so it can't be mistaken for gameplay it didn't cause.
 */
export function RoundTransitionCard({ view }: { view: GameStateView }) {
  const isFinalBazaar = view.round === view.config.finalBazaarRound;
  const speed = useAnimationSpeedMultiplier();

  return (
    <Card style={{ textAlign: "center" }}>
      <div
        style={{
          padding: "22px 20px",
          animation: `souk-round-banner ${700 * speed}ms ease-out`,
        }}
      >
        <p
          style={{
            margin: "0 0 4px",
            fontSize: "0.78rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: colors.inkSoft,
          }}
        >
          Round {view.round} of {view.config.roundCount}
        </p>
        <h2
          style={{
            margin: 0,
            fontFamily: fonts.headingLatin,
            fontSize: "1.4rem",
            color: isFinalBazaar ? colors.secret : colors.ink,
          }}
        >
          {isFinalBazaar ? "The Final Bazaar begins" : "The souk stirs to life once more…"}
        </h2>
        {isFinalBazaar && (
          <p style={{ margin: "8px 0 0", fontSize: "0.85rem", color: colors.inkSoft }}>
            One last round — the Bank has closed its doors.
          </p>
        )}
      </div>
    </Card>
  );
}
