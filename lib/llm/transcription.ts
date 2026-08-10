import { getSettingsStore } from "@/lib/settings";
import { DEFAULT_TRANSCRIPTION_MODEL } from "@/lib/media/transcribe";

export interface TranscriptionCredentials {
  apiKey: string;
  model: string;
}

/**
 * 자동 전사에 쓸 OpenAI 자격증명.
 *
 * 전사는 OpenAI 전용 기능이라 textProvider(설정에서 고른 분석용 제공자)를 따르지
 * 않는다. Anthropic으로 분석하면서 전사만 OpenAI로 돌리는 조합이 정상이다.
 *
 * 키가 없으면 던지지 않고 null을 준다 — 호출부가 "키 미설정"을 전사 실패와 다른
 * 메시지로 안내해야 하기 때문이다.
 */
export async function resolveTranscriptionCredentials(): Promise<TranscriptionCredentials | null> {
  const settings = await getSettingsStore().get();
  const apiKey = settings.providers.openai.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  // 전사 모델은 설정 화면의 텍스트 모델(gpt-4o 등)과 다른 축이라 여기서 고정한다.
  return { apiKey, model: DEFAULT_TRANSCRIPTION_MODEL };
}
