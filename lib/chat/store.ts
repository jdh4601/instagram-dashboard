import { chmod, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import { withFileLock, writeJsonAtomic } from "@/lib/store/jsonFile";

/**
 * 한 대화에 보관할 최대 메시지 수. 오래된 턴은 진단에 기여하지 않으므로 상한을 둔다.
 * 모델에 실제로 보내는 창은 이보다 더 좁다 (lib/chat/prompt.ts의 MAX_CONTEXT_TURNS).
 */
export const MAX_STORED_MESSAGES = 50;

/** 보관할 대화 수. 넘치면 가장 오래 손대지 않은 대화부터 버린다. */
export const MAX_CONVERSATIONS = 20;

/** 목록에 보여줄 제목 길이. 첫 질문을 잘라 쓰므로 한 줄에 들어갈 만큼만 남긴다. */
const TITLE_LENGTH = 40;

const UNTITLED = "새 대화";

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string(),
  /** 어느 제공자가 답했는지. 말풍선 배지에 쓰고, 없으면 표시하지 않는다. */
  provider: z.string().optional(),
});
export type ChatMessageRecord = z.infer<typeof ChatMessageSchema>;

const ConversationSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messages: z.array(ChatMessageSchema),
});
type ConversationRecord = z.infer<typeof ConversationSchema>;

const ChatFileSchema = z.object({
  conversations: z.array(ConversationSchema),
  activeId: z.string().optional(),
  updatedAt: z.string().optional(),
});

/** 대화 목록이 생기기 전의 파일 형식. 첫 읽기에서 대화 하나로 옮긴다. */
const LegacyFileSchema = z.object({
  messages: z.array(ChatMessageSchema),
  updatedAt: z.string().optional(),
});

type ChatFile = z.infer<typeof ChatFileSchema>;

export interface ConversationSummary {
  id: string;
  /** 첫 질문에서 딴 제목. 저장하지 않고 읽을 때마다 만들어 낸다. */
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface Conversation extends ConversationSummary {
  messages: ChatMessageRecord[];
}

export interface ChatStore {
  /** 활성 대화의 메시지. */
  get(): Promise<ChatMessageRecord[]>;
  /** 활성 대화에 이어 붙인다. 활성 대화가 없으면 만든다. */
  append(messages: ChatMessageRecord[]): Promise<ChatMessageRecord[]>;
  list(): Promise<ConversationSummary[]>;
  activeId(): Promise<string | null>;
  /** 새 대화를 열고 그 id를 준다. 활성 대화가 이미 비어 있으면 그대로 쓴다. */
  create(): Promise<string>;
  /** 대화를 활성으로 바꾸고 내용을 준다. 없는 id면 null이고 활성은 그대로다. */
  open(id: string): Promise<Conversation | null>;
  remove(id: string): Promise<void>;
}

function deriveTitle(messages: ChatMessageRecord[]): string {
  const first = messages.find((message) => message.role === "user");
  const text = first?.content.trim().replace(/\s+/g, " ") ?? "";
  if (text === "") return UNTITLED;
  return text.length > TITLE_LENGTH ? `${text.slice(0, TITLE_LENGTH)}…` : text;
}

function toSummary(conversation: ConversationRecord): ConversationSummary {
  return {
    id: conversation.id,
    title: deriveTitle(conversation.messages),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages.length,
  };
}

/** 최근에 손댄 대화가 앞으로. 목록 순서이자 넘칠 때 버리는 순서이기도 하다. */
function byRecency(a: ConversationRecord, b: ConversationRecord): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

function newConversation(now: string): ConversationRecord {
  return { id: randomUUID(), createdAt: now, updatedAt: now, messages: [] };
}

function findActive(file: ChatFile): ConversationRecord | undefined {
  return file.conversations.find((conversation) => conversation.id === file.activeId);
}

// 대화는 설정과 마찬가지로 저장소 어댑터(sqlite/postgres)와 무관하게 JSON 파일에 둔다.
// 단일 파일 한 덩어리라 관계형 스키마가 주는 이점이 없고, settings.json과 같은 선례를 따른다.
export function createChatStore(dataDir: string): ChatStore {
  const file = join(dataDir, "chat.json");

  async function read(): Promise<ChatFile> {
    if (!existsSync(file)) return { conversations: [] };
    // 대화 원문이 평문으로 남으므로 업그레이드 전 파일도 첫 접근에 권한을 교정한다.
    await chmod(file, 0o600);
    const raw = await readFile(file, "utf8");
    if (!raw.trim()) return { conversations: [] };

    const parsed: unknown = JSON.parse(raw);
    const current = ChatFileSchema.safeParse(parsed);
    if (current.success) return current.data;

    // 구 형식은 대화 하나로 감싼다. 여기서 새 형식으로 쓰지는 않는다 —
    // 다음 쓰기에서 자연스럽게 옮겨 가고, 읽기만 하는 경로가 파일을 건드리지 않는다.
    //
    // 파일에 남기지 않으니 id는 반드시 파일 내용에서 결정돼야 한다. 읽을 때마다
    // 새로 만들면 목록의 id와 활성 id가 어긋나고, 목록에서 고른 대화가 열리지 않는다.
    const legacy = LegacyFileSchema.parse(parsed);
    const timestamp = legacy.updatedAt ?? legacy.messages.at(-1)?.createdAt ?? "";
    const createdAt = legacy.messages[0]?.createdAt ?? timestamp;
    const migrated: ConversationRecord = {
      id: `legacy-${createdAt}`,
      createdAt,
      updatedAt: timestamp || createdAt,
      messages: legacy.messages,
    };
    return { conversations: [migrated], activeId: migrated.id };
  }

  async function write(next: ChatFile): Promise<void> {
    const trimmed = [...next.conversations].sort(byRecency).slice(0, MAX_CONVERSATIONS);
    const activeId = trimmed.some((c) => c.id === next.activeId) ? next.activeId : trimmed[0]?.id;
    await writeJsonAtomic(
      file,
      { conversations: trimmed, activeId, updatedAt: new Date().toISOString() },
      { mode: 0o600 },
    );
  }

  return {
    async get(): Promise<ChatMessageRecord[]> {
      const current = await read();
      return findActive(current)?.messages ?? [];
    },

    async list(): Promise<ConversationSummary[]> {
      const current = await read();
      return [...current.conversations].sort(byRecency).map(toSummary);
    },

    async activeId(): Promise<string | null> {
      const current = await read();
      return findActive(current)?.id ?? null;
    },

    append(incoming: ChatMessageRecord[]): Promise<ChatMessageRecord[]> {
      return withFileLock(file, async () => {
        const current = await read();
        const now = new Date().toISOString();
        const active = findActive(current) ?? newConversation(now);
        const messages = [...active.messages, ...incoming].slice(-MAX_STORED_MESSAGES);
        const updated: ConversationRecord = { ...active, messages, updatedAt: now };

        await write({
          conversations: [
            updated,
            ...current.conversations.filter((c) => c.id !== updated.id),
          ],
          activeId: updated.id,
        });
        return messages;
      });
    },

    create(): Promise<string> {
      return withFileLock(file, async () => {
        const current = await read();
        // 빈 대화를 계속 눌러 목록을 빈 껍데기로 채우지 않는다.
        const active = findActive(current);
        if (active && active.messages.length === 0) return active.id;

        const created = newConversation(new Date().toISOString());
        await write({
          conversations: [created, ...current.conversations],
          activeId: created.id,
        });
        return created.id;
      });
    },

    open(id: string): Promise<Conversation | null> {
      return withFileLock(file, async () => {
        const current = await read();
        const target = current.conversations.find((conversation) => conversation.id === id);
        if (!target) return null;

        // 여는 것은 읽기지만 활성 대화가 바뀌므로 파일에 남겨야 다음 요청도 같은 대화를 본다.
        await write({ ...current, activeId: target.id });
        return { ...toSummary(target), messages: target.messages };
      });
    },

    remove(id: string): Promise<void> {
      return withFileLock(file, async () => {
        const current = await read();
        const conversations = current.conversations.filter(
          (conversation) => conversation.id !== id,
        );
        // 활성 대화를 지웠으면 write가 가장 최근 대화를 활성으로 골라 준다.
        await write({ ...current, conversations });
      });
    },
  };
}
