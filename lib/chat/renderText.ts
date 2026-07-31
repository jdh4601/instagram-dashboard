// LLM 답변을 표시하기 위한 최소 파서.
//
// 마크다운 라이브러리를 들이지 않는 이유는 두 가지다. 이 앱은 의존성을 얇게 유지하고,
// 모델 출력을 HTML로 해석하지 않으면 주입 위험 자체가 생기지 않는다. 여기서는 문자열을
// 세그먼트로 쪼개기만 하고, 실제 렌더링은 React가 텍스트 노드로 처리한다.

export interface TextSegment {
  text: string;
  bold: boolean;
}

export interface TextBlock {
  kind: "paragraph" | "bullet" | "numbered";
  /** 번호 목록의 "1." 같은 앞머리. 그 외에는 없다. */
  marker?: string;
  segments: TextSegment[];
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d+\.)\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

/** `**굵게**`만 해석한다. 짝이 맞지 않는 별표는 평범한 글자로 남긴다. */
function parseSegments(line: string, forceBold = false): TextSegment[] {
  if (forceBold) return [{ text: line, bold: true }];

  const segments: TextSegment[] = [];
  let rest = line;

  for (;;) {
    const open = rest.indexOf("**");
    if (open === -1) break;
    const close = rest.indexOf("**", open + 2);
    if (close === -1) break;

    if (open > 0) segments.push({ text: rest.slice(0, open), bold: false });
    const bold = rest.slice(open + 2, close);
    if (bold !== "") segments.push({ text: bold, bold: true });
    rest = rest.slice(close + 2);
  }

  if (rest !== "") segments.push({ text: rest, bold: false });
  return segments.length > 0 ? segments : [{ text: line, bold: false }];
}

export function parseChatText(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];

  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;

    const heading = HEADING.exec(line);
    if (heading) {
      // 말풍선 안에서 제목 계층은 의미가 없다. 굵은 한 줄로 낮춘다.
      blocks.push({ kind: "paragraph", segments: parseSegments(heading[1], true) });
      continue;
    }

    const numbered = NUMBERED.exec(line);
    if (numbered) {
      blocks.push({ kind: "numbered", marker: numbered[1], segments: parseSegments(numbered[2]) });
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      blocks.push({ kind: "bullet", segments: parseSegments(bullet[1]) });
      continue;
    }

    blocks.push({ kind: "paragraph", segments: parseSegments(line) });
  }

  return blocks;
}
