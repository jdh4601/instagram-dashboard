// 텍스트 생성 (이미지 없음) — Phase 3 맞춤 대본 생성용. 모든 제공자 공통.
export interface TextGenerateArgs {
  system: string;
  userText: string;
}

export interface TextModel {
  generate(args: TextGenerateArgs): Promise<string>;
}
