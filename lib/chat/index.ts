import { createChatStore, type ChatStore } from "@/lib/chat/store";
import { resolveRuntimeConfig } from "@/lib/runtime/config";

let store: ChatStore | null = null;

export function getChatStore(): ChatStore {
  if (!store) store = createChatStore(resolveRuntimeConfig().dataDir);
  return store;
}
