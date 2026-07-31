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
  expect(blocks[1].segments[0].text).toBe("훅을 3초 안에");
});

test("번호 목록도 항목으로 인식한다", () => {
  const blocks = parseChatText("1. 첫째\n2. 둘째");

  expect(blocks.map((b) => b.kind)).toEqual(["numbered", "numbered"]);
  expect(blocks[0].marker).toBe("1.");
  expect(blocks[1].segments[0].text).toBe("둘째");
});

test("제목 표기는 굵은 문단으로 낮춘다", () => {
  const [block] = parseChatText("## 진단 결과");

  expect(block.kind).toBe("paragraph");
  expect(block.segments).toEqual([{ text: "진단 결과", bold: true }]);
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
