import { ReelAnalysisSchema, type Reel, type ReelAnalysis } from "@/lib/schemas";
import type { TextModel } from "@/lib/llm/types";

// 탭 4개를 한 번에 요구한다. 탭마다 호출하면 같은 자막을 네 번 보내 비용이 4배가 된다.
const SYSTEM_PROMPT = `너는 인스타그램 릴스의 자막(대본)을 읽고 그 영상이 어떻게 만들어졌는지
해부하는 분석가다. 성과 진단이 아니라 "구조 분해"가 일이다.

규칙(어기면 실패):
- 모든 판단의 근거는 제공된 자막 문장이어야 한다. 자막에 없는 장면·연출·화면 구성을 지어내지 마라.
- hook.line은 반드시 자막 첫 구간에 실제로 나온 문장을 그대로 인용해라.
- hook.template은 다른 주제에 그대로 갈아 끼울 수 있게 일반화해라.
  예: "월 천만원 버는 사람은 이걸 안 합니다" → "[목표 달성한 사람]은 [흔한 행동]을 안 합니다"
- story.beats는 자막의 시간 순서를 따르고, startSec/endSec는 제공된 자막 구간에서 가져와라.
- summary는 주제 요약이 아니라 "이 영상이 어떤 구조로 사람을 붙잡는가"를 2~3문장으로 써라.
- 한국어로 답하되 hook.type과 story.beats[].stage는 아래 지정한 영문 값만 써라.

hook.type은 다음 중 하나: problem, contrarian, personal-experience, curiosity, result-proof, how-to, other
story.beats[].stage는 다음 중 하나: intro, development, turn, closing

반드시 아래 형태의 JSON으로만 답하라(설명·코드펜스 금지):
{
  "summary": "2~3문장 구조 총평",
  "idea": {
    "coreIdea": "이 릴스가 말하는 한 가지",
    "valueProposition": "시청자가 얻는 것",
    "targetAudience": "누구에게 하는 말인가",
    "differentiator": "같은 주제의 다른 영상과 갈라지는 지점"
  },
  "hook": {
    "line": "첫 3초 자막 그대로",
    "type": "위 목록 중 하나",
    "template": "[대괄호]로 빈칸을 판 재사용 형태",
    "why": "이 훅이 먹히는(혹은 안 먹힌) 이유"
  },
  "story": {
    "format": "구조 이름 (예: 문제 → 반전 → 증거 → 제안)",
    "beats": [
      {"stage":"intro","label":"짧은 이름","startSec":0,"endSec":2.5,"summary":"이 구간이 하는 일","quote":"근거 자막"}
    ]
  }
}`;

function transcriptBlock(reel: Reel): string {
  // 호출 전에 자막 유무를 검사하므로 여기서는 비어 있을 수 없다.
  return (reel.transcript ?? []).map((l) => `[${l.startSec}-${l.endSec}s] ${l.text}`).join("\n");
}

export function buildReelAnalysisPrompt(reel: Reel): { system: string; userText: string } {
  if (!reel.transcript || reel.transcript.length === 0) {
    // 자막 없이 부르면 모델이 캡션만 보고 구조를 지어낸다. 프롬프트를 만들기 전에 막는다.
    throw new Error("자막이 없어 분석할 수 없습니다. 먼저 자동 전사하거나 SRT를 올려 주세요.");
  }

  const userText = [
    `캡션: ${reel.caption ?? "(없음)"}`,
    `영상 길이: ${reel.durationSec > 0 ? `${reel.durationSec}초` : "미상"}`,
    ``,
    `자막:`,
    transcriptBlock(reel),
    ``,
    `위 자막만 근거로 삼아 아이디어·훅·이야기 구조를 분해해 JSON으로 답해줘.`,
  ].join("\n");

  return { system: SYSTEM_PROMPT, userText };
}

// 응답에서 첫 '{' ~ 마지막 '}' 사이만 추출 (코드펜스/잡설 방어)
function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("응답에서 JSON 객체를 찾지 못했습니다");
  }
  return text.slice(start, end + 1);
}

export function parseReelAnalysis(text: string): ReelAnalysis {
  const json: unknown = JSON.parse(extractJsonObject(text));
  return ReelAnalysisSchema.parse(json);
}

export async function generateReelAnalysis(reel: Reel, model: TextModel): Promise<ReelAnalysis> {
  const { system, userText } = buildReelAnalysisPrompt(reel);
  const text = await model.generate({ system, userText });
  return parseReelAnalysis(text);
}
