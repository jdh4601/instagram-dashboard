import { chmod, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { withFileLock, writeJsonAtomic } from "@/lib/store/jsonFile";

/**
 * 디스크에 보관할 최대 메시지 수. 대화는 무한히 늘어나는데 오래된 턴은 진단에
 * 기여하지 않으므로 상한을 둔다. 모델에 실제로 보내는 창은 이보다 더 좁다
 * (lib/chat/prompt.ts의 MAX_CONTEXT_TURNS).
 */
export const MAX_STORED_MESSAGES = 50;

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string(),
  /** 어느 제공자가 답했는지. 말풍선 배지에 쓰고, 없으면 표시하지 않는다. */
  provider: z.string().optional(),
});
export type ChatMessageRecord = z.infer<typeof ChatMessageSchema>;

const ChatFileSchema = z.object({
  messages: z.array(ChatMessageSchema),
  updatedAt: z.string().optional(),
});

export interface ChatStore {
  get(): Promise<ChatMessageRecord[]>;
  append(messages: ChatMessageRecord[]): Promise<ChatMessageRecord[]>;
  clear(): Promise<void>;
}

// 대화는 설정과 마찬가지로 저장소 어댑터(sqlite/postgres)와 무관하게 JSON 파일에 둔다.
// 단일 세션 한 덩어리라 관계형 스키마가 주는 이점이 없고, settings.json과 같은 선례를 따른다.
export function createChatStore(dataDir: string): ChatStore {
  const file = join(dataDir, "chat.json");

  async function read(): Promise<ChatMessageRecord[]> {
    if (!existsSync(file)) return [];
    // 대화 원문이 평문으로 남으므로 업그레이드 전 파일도 첫 접근에 권한을 교정한다.
    await chmod(file, 0o600);
    const raw = await readFile(file, "utf8");
    if (!raw.trim()) return [];
    return ChatFileSchema.parse(JSON.parse(raw)).messages;
  }

  return {
    get: read,

    append(incoming: ChatMessageRecord[]): Promise<ChatMessageRecord[]> {
      return withFileLock(file, async () => {
        const next = [...(await read()), ...incoming].slice(-MAX_STORED_MESSAGES);
        await writeJsonAtomic(
          file,
          { messages: next, updatedAt: new Date().toISOString() },
          { mode: 0o600 },
        );
        return next;
      });
    },

    clear(): Promise<void> {
      return withFileLock(file, async () => {
        await writeJsonAtomic(
          file,
          { messages: [], updatedAt: new Date().toISOString() },
          { mode: 0o600 },
        );
      });
    },
  };
}
