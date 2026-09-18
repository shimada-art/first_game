import { RESOURCE_IDS } from "@souk/shared";
import type { ResourceBundle } from "./types.js";

export function bundleWith(value: number): ResourceBundle {
  return Object.fromEntries(RESOURCE_IDS.map((id) => [id, value])) as ResourceBundle;
}

export function zeroBundle(): ResourceBundle {
  return bundleWith(0);
}

/** result = a + sign * b (missing keys in b treated as 0). Never mutates a. */
export function addBundle(a: ResourceBundle, b: Partial<ResourceBundle>, sign = 1): ResourceBundle {
  const result = { ...a };
  for (const id of RESOURCE_IDS) {
    result[id] = a[id] + sign * (b[id] ?? 0);
  }
  return result;
}

export function bundleTotal(bundle: Partial<ResourceBundle>): number {
  return RESOURCE_IDS.reduce((sum, id) => sum + (bundle[id] ?? 0), 0);
}

export function hasAtLeast(bundle: ResourceBundle, need: Partial<ResourceBundle>): boolean {
  return RESOURCE_IDS.every((id) => bundle[id] >= (need[id] ?? 0));
}
