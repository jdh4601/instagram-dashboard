// 텍스트 생성 (이미지 없음) — Phase 3 맞춤 대본 생성용. 모든 제공자 공통.
interface TextGenerateArgs {
  system: string;
  userText: string;
}

export interface TextModel {
  generate(args: TextGenerateArgs): Promise<string>;
}

// 여러 턴을 이어 가는 대화 — 계정 진단 챗봇용. TextModel과 달리 응답을 델타로 흘린다.
// CLI 백엔드는 첫 토큰까지 수십 초가 걸릴 수 있어 스트리밍이 선택이 아니라 필수다.
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatStreamArgs {
  system: string;
  turns: ChatTurn[];
  /** 사용자가 중단하면 어댑터가 자원(HTTP 연결·자식 프로세스)을 정리한다. */
  signal?: AbortSignal;
}

export interface ChatModel {
  stream(args: ChatStreamArgs): AsyncIterable<string>;
}
