import { RESOURCE_IDS } from "@souk/shared";
import type { ResourceId } from "@souk/shared";
import { colors, fonts } from "@souk/ui";

export interface Bundle {
  resources: Partial<Record<ResourceId, number>>;
  coins: number;
}

export function emptyBundle(): Bundle {
  return { resources: {}, coins: 0 };
}

export function BundleEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Bundle;
  onChange: (next: Bundle) => void;
}) {
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ fontSize: "0.8rem", color: colors.inkSoft, marginBottom: "4px" }}>{label}</div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        {RESOURCE_IDS.map((r) => (
          <label key={r} style={{ display: "flex", flexDirection: "column", fontSize: "0.72rem", color: colors.inkSoft }}>
            {r}
            <input
              type="number"
              min={0}
              value={value.resources[r] ?? 0}
              onChange={(e) =>
                onChange({ ...value, resources: { ...value.resources, [r]: Number(e.target.value) || 0 } })
              }
              style={{ width: "52px", fontFamily: fonts.bodyLatin, padding: "4px", borderRadius: "6px", border: `1px solid ${colors.line}` }}
            />
          </label>
        ))}
        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.72rem", color: colors.inkSoft }}>
          coins
          <input
            type="number"
            min={0}
            value={value.coins}
            onChange={(e) => onChange({ ...value, coins: Number(e.target.value) || 0 })}
            style={{ width: "52px", fontFamily: fonts.bodyLatin, padding: "4px", borderRadius: "6px", border: `1px solid ${colors.line}` }}
          />
        </label>
      </div>
    </div>
  );
}

export function describeBundle(b: Bundle): string {
  const parts = RESOURCE_IDS.filter((r) => (b.resources[r] ?? 0) > 0).map((r) => `${b.resources[r]} ${r}`);
  if (b.coins > 0) parts.push(`${b.coins} coins`);
  return parts.length > 0 ? parts.join(", ") : "nothing";
}
