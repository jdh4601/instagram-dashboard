import { parseChatText } from "@/lib/chat/renderText";

test("굵게 표시를 세그먼트로 분리한다", () => {
  const [block] = parseChatText("도달은 **충분**합니다");

  expect(block.kind).toBe("paragraph");
  expect(block.segments).toEqual([
    { text: "도달은 ", bold: false },
    { text: "충분", bold: true },
    { text: "합니다", bold: false },
  ]);
});

test("불릿 목록을 항목으로 인식한다", () => {
  const blocks = parseChatText("개선점:\n- 훅을 3초 안에\n- 저장 유도 문구 추가");

  expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "bullet", "bullet"]);
  // "3초"는 수치 강조로 떨어져 나가므로 항목 전체를 합쳐서 본다.
  expect(blocks[1].segments.map((s) => s.text).join("")).toBe("훅을 3초 안에");
});

test("번호 목록도 항목으로 인식한다", () => {
  const blocks = parseChatText("1. 첫째\n2. 둘째");

  expect(blocks.map((b) => b.kind)).toEqual(["numbered", "numbered"]);
  expect(blocks[0].marker).toBe("1.");
  expect(blocks[1].segments[0].text).toBe("둘째");
});

test("제목 표기는 섹션 라벨 블록이 된다", () => {
  const [block] = parseChatText("## 진단 결과");

  expect(block.kind).toBe("heading");
  expect(block.segments).toEqual([{ text: "진단 결과", bold: false }]);
});

test("빈 줄은 블록을 만들지 않는다", () => {
  expect(parseChatText("첫 줄\n\n둘째 줄")).toHaveLength(2);
});

test("닫히지 않은 별표는 그대로 글자로 남긴다", () => {
  const [block] = parseChatText("저장율이 **낮습니다");

  expect(block.segments).toEqual([{ text: "저장율이 **낮습니다", bold: false }]);
});

test("HTML로 보이는 입력도 그냥 글자로 다룬다", () => {
  // 마크업을 해석하지 않으므로 모델 출력이 그대로 문자열로만 남아야 한다.
  const [block] = parseChatText("<script>alert(1)</script>");

  expect(block.segments).toEqual([{ text: "<script>alert(1)</script>", bold: false }]);
});

test("빈 문자열은 블록이 없다", () => {
  expect(parseChatText("")).toEqual([]);
});

describe("강점·약점 카드", () => {
  test("[강점] 줄을 제목과 본문으로 나눈다", () => {
    const [block] = parseChatText("[강점] 프로필 전환 :: 방문률 13.04%로 기준을 넘습니다");

    expect(block.kind).toBe("strength");
    expect(block.title).toBe("프로필 전환");
    expect(block.segments.map((s) => s.text).join("")).toBe("방문률 13.04%로 기준을 넘습니다");
  });

  test("[약점] 줄도 같은 모양으로 읽는다", () => {
    const [block] = parseChatText("[약점] 훅 이탈 :: 3초 잔존이 낮습니다");

    expect(block.kind).toBe("weakness");
    expect(block.title).toBe("훅 이탈");
  });

  test("본문 구분자가 없으면 제목만 남는다", () => {
    const [block] = parseChatText("[강점] 도달은 살아 있습니다");

    expect(block.kind).toBe("strength");
    expect(block.title).toBe("도달은 살아 있습니다");
    expect(block.segments).toEqual([]);
  });

  test("본문 안의 :: 는 본문에 그대로 남는다", () => {
    const [block] = parseChatText("[약점] 저장 :: 캡션 규칙 :: 저장 유도 문구가 없습니다");

    expect(block.title).toBe("저장");
    expect(block.segments.map((s) => s.text).join("")).toBe("캡션 규칙 :: 저장 유도 문구가 없습니다");
  });

  test("모르는 태그는 평범한 문단으로 둔다", () => {
    const [block] = parseChatText("[참고] 표본이 적습니다");

    expect(block.kind).toBe("paragraph");
    expect(block.segments[0].text).toBe("[참고] 표본이 적습니다");
  });
});

describe("지표 행", () => {
  test("이름·값·기준을 분리하고 기준 미달을 약점으로 판정한다", () => {
    const [block] = parseChatText("[지표] 3초 훅 잔존 | 37.33% | 45");

    expect(block.kind).toBe("metric");
    expect(block.metric).toEqual({
      name: "3초 훅 잔존",
      value: "37.33%",
      benchmark: "45",
      tone: "weak",
    });
  });

  test("기준 이상이면 강점으로 판정한다", () => {
    const [block] = parseChatText("[지표] 방문률 | 13.04% | 10");

    expect(block.metric?.tone).toBe("strong");
  });

  test("기준을 못 읽으면 색을 입히지 않는다", () => {
    const [block] = parseChatText("[지표] 팔로워 | 306");

    expect(block.metric).toEqual({ name: "팔로워", value: "306" });
  });
});

test("프롬프트가 지시한 형태의 답변을 통째로 읽어낸다", () => {
  const answer = [
    "최근 2주 병목은 저장·훅에서 새는 릴스입니다.",
    "## 근거",
    "[지표] 3초 훅 잔존 | 37.33% | 45",
    "[지표] 방문률 | 13.04% | 10",
    "[약점] 훅 이탈 :: 3초 잔존이 37.33%로 기준 45에 못 미칩니다",
    "[강점] 프로필 전환 :: 방문률 13.04%, 팔로우 전환 6.85%로 모두 기준 위입니다",
    "## 이번 주 조치",
    "- 영상 길이를 47.2초에서 30초 안쪽으로 줄이세요",
  ].join("\n");

  const blocks = parseChatText(answer);

  expect(blocks.map((b) => b.kind)).toEqual([
    "paragraph",
    "heading",
    "metric",
    "metric",
    "weakness",
    "strength",
    "heading",
    "bullet",
  ]);
  expect(blocks[2].metric?.tone).toBe("weak");
  expect(blocks[3].metric?.tone).toBe("strong");
  expect(blocks[5].title).toBe("프로필 전환");
});

describe("수치 강조", () => {
  function emphasisOf(text: string) {
    return parseChatText(text)[0].segments.map((s) => [s.text, s.emphasis]);
  }

  test("증가 부호가 붙은 수치는 up으로 표시한다", () => {
    expect(emphasisOf("팔로워 +9.3% 늘었습니다")).toContainEqual(["+9.3%", "up"]);
  });

  test("감소 부호가 붙은 수치는 down으로 표시한다", () => {
    expect(emphasisOf("도달 −9.7% 줄었습니다")).toContainEqual(["−9.7%", "down"]);
    expect(emphasisOf("도달 -360 줄었습니다")).toContainEqual(["-360", "down"]);
  });

  test("삼각형 기호도 방향으로 읽는다", () => {
    expect(emphasisOf("방문률 ▼1.09%p")).toContainEqual(["▼1.09%p", "down"]);
    expect(emphasisOf("링크 클릭 ▲0.21%p")).toContainEqual(["▲0.21%p", "up"]);
  });

  test("부호 없는 수치는 중립 강조만 한다", () => {
    expect(emphasisOf("저장율 0.26%")).toContainEqual(["0.26%", "number"]);
    expect(emphasisOf("도달 3,360")).toContainEqual(["3,360", "number"]);
    expect(emphasisOf("평균 시청 8.0초")).toContainEqual(["8.0초", "number"]);
  });

  test("날짜의 하이픈을 감소 부호로 읽지 않는다", () => {
    const emphases = emphasisOf("2026-07-31 기준");
    expect(emphases.every(([, e]) => e !== "down")).toBe(true);
  });

  test("단위도 소수점도 없는 정수는 강조하지 않는다", () => {
    const emphases = emphasisOf("최근 10개 중 7/25 릴스");
    expect(emphases.find(([t]) => t === "7")).toBeUndefined();
  });

  test("굵게 표시 안의 수치도 강조를 함께 받는다", () => {
    const [block] = parseChatText("병목은 **저장율 0.26%**입니다");
    const number = block.segments.find((s) => s.text === "0.26%");

    expect(number).toEqual({ text: "0.26%", bold: true, emphasis: "number" });
  });

  test("카드 본문 안에서도 수치를 강조한다", () => {
    const [block] = parseChatText("[약점] 저장 :: 저장율 0.26%로 기준 미달");

    expect(block.segments).toContainEqual({ text: "0.26%", bold: false, emphasis: "number" });
  });
});
