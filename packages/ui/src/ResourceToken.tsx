import type { ResourceId } from "@souk/shared";
import { colors, fonts, radii, resourceColors } from "./tokens.js";

const RESOURCE_LABEL: Record<ResourceId, string> = {
  spice: "Spice",
  textile: "Textile",
  gold: "Gold",
  gem: "Gem",
};

export interface ResourceTokenProps {
  resource: ResourceId;
  count: number;
  size?: "sm" | "md";
}

export function ResourceToken({ resource, count, size = "md" }: ResourceTokenProps) {
  const dimension = size === "sm" ? 32 : 44;
  return (
    <div
      title={RESOURCE_LABEL[resource]}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
      }}
    >
      <div
        style={{
          width: dimension,
          height: dimension,
          borderRadius: radii.sm,
          background: resourceColors[resource],
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fonts.headingLatin,
          fontWeight: 600,
          fontSize: size === "sm" ? "0.9rem" : "1.1rem",
          boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
        }}
      >
        {count}
      </div>
      {size === "md" && (
        <span style={{ fontSize: "0.72rem", color: colors.inkSoft }}>{RESOURCE_LABEL[resource]}</span>
      )}
    </div>
  );
}
