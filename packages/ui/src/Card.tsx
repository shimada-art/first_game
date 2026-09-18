import type { HTMLAttributes } from "react";
import { colors, radii } from "./tokens.js";

export function Card({ style, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        background: colors.card,
        border: `1px solid ${colors.line}`,
        borderRadius: radii.md,
        padding: "22px 26px",
        ...style,
      }}
      {...rest}
    />
  );
}
