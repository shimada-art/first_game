import { useId, type InputHTMLAttributes } from "react";
import { colors, fonts, radii } from "./tokens.js";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
}

export function TextField({ label, error, id, style, ...rest }: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
      <label
        htmlFor={fieldId}
        style={{ fontFamily: fonts.bodyLatin, fontSize: "0.9rem", color: colors.inkSoft }}
      >
        {label}
      </label>
      <input
        id={fieldId}
        style={{
          fontFamily: fonts.bodyLatin,
          fontSize: "1rem",
          padding: "10px 14px",
          borderRadius: radii.sm,
          border: `1px solid ${error ? colors.textile : colors.line}`,
          background: colors.paper,
          color: colors.ink,
          ...style,
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...rest}
      />
      {error && (
        <span id={`${fieldId}-error`} style={{ color: colors.textileText, fontSize: "0.85rem" }}>
          {error}
        </span>
      )}
    </div>
  );
}
