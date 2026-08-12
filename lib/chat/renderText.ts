// LLM 답변을 표시하기 위한 최소 파서.
//
// 마크다운 라이브러리를 들이지 않는 이유는 두 가지다. 이 앱은 의존성을 얇게 유지하고,
// 모델 출력을 HTML로 해석하지 않으면 주입 위험 자체가 생기지 않는다. 여기서는 문자열을
// 블록과 세그먼트로 쪼개기만 하고, 실제 렌더링은 React가 텍스트 노드로 처리한다.
//
// 카드·지표 문법([강점]/[약점]/[지표])은 프롬프트에서 모델에게 가르치는 것이고,
// 모델이 지키지 않아도 평범한 문단으로 떨어질 뿐 화면이 깨지지 않는다.

/** 수치에 입히는 강조. up/down은 색까지, number는 굵기만. */
export type EmphasisTone = "up" | "down" | "number";

export interface TextSegment {
  text: string;
  bold: boolean;
  emphasis?: EmphasisTone;
}

type BlockKind =
  | "paragraph"
  | "bullet"
  | "numbered"
  | "heading"
  | "strength"
  | "weakness"
  | "metric";

export interface MetricRow {
  name: string;
  value: string;
  benchmark?: string;
  /** 기준과 값을 모두 숫자로 읽어냈을 때만 정해진다. */
  tone?: "strong" | "weak";
}

export interface TextBlock {
  kind: BlockKind;
  /** 번호 목록의 "1." 같은 앞머리. 그 외에는 없다. */
  marker?: string;
  /** 강점·약점 카드의 제목. */
  title?: string;
  /** 지표 행의 이름·값·기준. */
  metric?: MetricRow;
  segments: TextSegment[];
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d+\.)\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;
const CARD = /^\s*\[(강점|약점)\]\s*(.*)$/;
const METRIC = /^\s*\[지표\]\s*(.*)$/;

/** 카드에서 제목과 본문을 가르는 표시. 본문 안에 다시 나오면 본문 쪽에 남긴다. */
const CARD_SEPARATOR = "::";

const UP_SIGNS = new Set(["▲", "↑", "+"]);
const DOWN_SIGNS = new Set(["▼", "↓", "-", "−"]);

/** 부호(선택) + 숫자 + 단위(선택). 단위는 이 대시보드에 실제로 나오는 것만 받는다. */
const NUMERIC = /([▲▼↑↓+\-−])?\s?(\d[\d,]*(?:\.\d+)?)(%p|%|초|배|개|명|원)?/g;

/**
 * 부호 없는 수치는 단위·소수점·천단위 구분이 있을 때만 강조한다.
 * "7/25"나 "최근 10" 같은 맨 정수까지 굵게 만들면 문장이 얼룩덜룩해진다.
 */
function isWorthEmphasizing(digits: string, unit: string | undefined): boolean {
  return unit !== undefined || digits.includes(".") || digits.includes(",");
}

/** 한 덩어리(굵기가 같은 구간)를 수치 기준으로 다시 쪼갠다. */
function splitNumeric(text: string, bold: boolean): TextSegment[] {
  const segments: TextSegment[] = [];
  let plainFrom = 0;

  NUMERIC.lastIndex = 0;
  for (let match = NUMERIC.exec(text); match !== null; match = NUMERIC.exec(text)) {
    const [whole, sign, digits, unit] = match;

    // "2026-07-31"의 하이픈은 감소 부호가 아니다. 부호 앞이 글자·숫자면 부호로 보지 않는다.
    const before = text[match.index - 1];
    const signIsReal = sign !== undefined && (before === undefined || !/[\p{L}\p{N}]/u.test(before));

    let emphasis: EmphasisTone | undefined;
    if (signIsReal && UP_SIGNS.has(sign)) emphasis = "up";
    else if (signIsReal && DOWN_SIGNS.has(sign)) emphasis = "down";
    else if (isWorthEmphasizing(digits, unit)) emphasis = "number";
    if (emphasis === undefined) continue;

    // 부호를 부호로 읽지 않기로 했으면 숫자부터가 강조 대상이다.
    const highlighted = signIsReal ? whole : digits + (unit ?? "");
    const start = match.index + whole.length - highlighted.length;

    if (start > plainFrom) segments.push({ text: text.slice(plainFrom, start), bold });
    segments.push({ text: highlighted, bold, emphasis });
    plainFrom = match.index + whole.length;
  }

  if (plainFrom < text.length) segments.push({ text: text.slice(plainFrom), bold });
  return segments;
}

/** `**굵게**`만 해석한다. 짝이 맞지 않는 별표는 평범한 글자로 남긴다. */
function parseSegments(line: string): TextSegment[] {
  const chunks: { text: string; bold: boolean }[] = [];
  let rest = line;

  for (;;) {
    const open = rest.indexOf("**");
    if (open === -1) break;
    const close = rest.indexOf("**", open + 2);
    if (close === -1) break;

    if (open > 0) chunks.push({ text: rest.slice(0, open), bold: false });
    const bold = rest.slice(open + 2, close);
    if (bold !== "") chunks.push({ text: bold, bold: true });
    rest = rest.slice(close + 2);
  }

  if (rest !== "") chunks.push({ text: rest, bold: false });
  if (chunks.length === 0) chunks.push({ text: line, bold: false });

  return chunks.flatMap((chunk) => splitNumeric(chunk.text, chunk.bold));
}

/** 값과 기준에서 첫 숫자만 뽑아 비교한다. 읽히지 않으면 NaN. */
function toNumber(text: string): number {
  const match = /-?\d[\d,]*(?:\.\d+)?/.exec(text);
  if (match === null) return Number.NaN;
  return Number(match[0].replace(/,/g, ""));
}

/**
 * 지표 판정은 "높을수록 좋다"를 전제한다. 이 대시보드의 임계값(훅 잔존·시청 비율·
 * 저장율·방문률·전환율)이 모두 그런 방향이라 성립하고, 프롬프트에도 같은 조건을 적어 둔다.
 */
function parseMetric(body: string): MetricRow {
  const [name = "", value = "", benchmark] = body.split("|").map((part) => part.trim());
  const row: MetricRow = { name, value };
  if (benchmark === undefined || benchmark === "") return row;

  row.benchmark = benchmark;
  const [actual, threshold] = [toNumber(value), toNumber(benchmark)];
  if (Number.isFinite(actual) && Number.isFinite(threshold)) {
    row.tone = actual >= threshold ? "strong" : "weak";
  }
  return row;
}

function parseCard(kind: "강점" | "약점", body: string): TextBlock {
  const separator = body.indexOf(CARD_SEPARATOR);
  const title = (separator === -1 ? body : body.slice(0, separator)).trim();
  const detail = separator === -1 ? "" : body.slice(separator + CARD_SEPARATOR.length).trim();

  return {
    kind: kind === "강점" ? "strength" : "weakness",
    title,
    segments: detail === "" ? [] : parseSegments(detail),
  };
}

export function parseChatText(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];

  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", segments: parseSegments(heading[1]) });
      continue;
    }

    const card = CARD.exec(line);
    if (card) {
      blocks.push(parseCard(card[1] as "강점" | "약점", card[2]));
      continue;
    }

    const metric = METRIC.exec(line);
    if (metric) {
      blocks.push({ kind: "metric", metric: parseMetric(metric[1]), segments: [] });
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
