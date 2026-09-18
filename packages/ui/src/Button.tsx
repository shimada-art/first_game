import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { colors, fonts, radii } from "./tokens.js";

export type ButtonVariant = "primary" | "secondary";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const base: CSSProperties = {
  fontFamily: fonts.bodyLatin,
  fontSize: "1rem",
  borderRadius: radii.pill,
  border: `1px solid ${colors.line}`,
  padding: "10px 20px",
  cursor: "pointer",
};

const variantStyle: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: colors.ink,
    color: colors.paper,
    border: `1px solid ${colors.ink}`,
  },
  secondary: {
    background: colors.card,
    color: colors.ink,
  },
};

export function Button({ variant = "primary", style, ...rest }: ButtonProps) {
  return <button style={{ ...base, ...variantStyle[variant], ...style }} {...rest} />;
}
