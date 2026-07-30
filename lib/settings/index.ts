import { createSettingsStore, type SettingsStore } from "@/lib/settings/store";
import { resolveRuntimeConfig } from "@/lib/runtime/config";

let store: SettingsStore | null = null;

export function getSettingsStore(): SettingsStore {
  if (!store) store = createSettingsStore(resolveRuntimeConfig().dataDir);
  return store;
}
