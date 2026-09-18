import { colors, fonts, radii } from "./tokens.js";

export function CoinBadge({ coins }: { coins: number }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 14px",
        borderRadius: radii.pill,
        background: colors.goldBg,
        border: `1px solid ${colors.gold}`,
        color: colors.goldText,
        fontFamily: fonts.headingLatin,
        fontWeight: 600,
      }}
    >
      <span aria-hidden style={{ fontSize: "1rem" }}>
        ⦿
      </span>
      {coins}
    </div>
  );
}
