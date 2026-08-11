#!/usr/bin/env node
// Walla 폼 ID·숨김 필드 라벨·응답 키 형식을 확인한다.
//
// 사용법: WALLA_API_KEY=... node scripts/walla-forms.mjs [formId]
//
// base URL은 app.walla.my다. OpenAPI 스펙(app.walla.my/open-api/doc)에 servers 블록이
// 없어 문서 자신의 origin이 곧 서버다. developer-docs의 api.walla.my는 응답하지 않는다.

const BASE = "https://app.walla.my/open-api/v1";

const apiKey = process.env.WALLA_API_KEY?.trim();
if (!apiKey) {
  console.error("WALLA_API_KEY 환경변수가 없습니다.");
  console.error("발급: app.walla.my/open-api/doc → 'API Key Viewer' 패널 펼치기");
  console.error("실행: WALLA_API_KEY=발급받은키 node scripts/walla-forms.mjs");
  process.exit(1);
}

async function call(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "X-WALLA-API-KEY": apiKey, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return res.json();
}

const formId = process.argv[2];

if (!formId) {
  const forms = await call("/forms");
  const list = Array.isArray(forms.data) ? forms.data : (forms.data?.forms ?? []);
  console.log("폼 목록:\n");
  for (const item of list) {
    const form = item.form ?? item;
    console.log(`  formId: ${form.id}`);
    console.log(`    제목: ${form.title ?? "(제목 없음)"}`);
    if (item.analytics?.submissions !== undefined) {
      console.log(`    응답 수: ${item.analytics.submissions}`);
    }
  }
  console.log("\n특정 폼을 자세히 보려면: node scripts/walla-forms.mjs <formId>");
  process.exit(0);
}

// 1) 등록된 숨김 필드 라벨
const hidden = await call(`/forms/${encodeURIComponent(formId)}/hidden-fields`);
const labels = hidden.data?.hiddenFields ?? [];
console.log(`숨김 필드 라벨 (${labels.length}개):`, labels.length ? labels : "(없음)");

if (labels.length === 0) {
  console.log("\n⚠ 숨김 필드가 없습니다. UTM을 등록하기 전에는 유입 구분이 불가능합니다.");
}

// 2) 최근 응답 1건의 키 형식 — 값은 가린다.
//    응답 객체에서 숨김 필드가 어떤 키로 오는지가 매핑 코드의 유일한 미확인 지점이다.
const search = await call(`/forms/${encodeURIComponent(formId)}/responses/search`, {
  method: "POST",
  body: JSON.stringify({ page: 1, limit: 1 }),
});

const total = search.data?.pagination?.totalCount;
console.log(`\n총 응답 수: ${total ?? "(알 수 없음)"}`);

const sample = search.data?.responses?.[0];
if (!sample) {
  console.log("응답이 아직 없어 키 형식을 확인할 수 없습니다.");
  process.exit(0);
}

console.log("\n응답 객체의 키 (값은 가림):");
for (const [key, value] of Object.entries(sample)) {
  const type = Array.isArray(value) ? "array" : typeof value;
  // 개인정보가 터미널·로그에 남지 않도록 값은 타입만 표시한다.
  const shown = key === "responseId" || key === "submittedAt" ? String(value) : `<${type}>`;
  console.log(`  ${key}: ${shown}`);
}

console.log("\n위 키 중 'hidden'으로 시작하는 것이 숨김 필드입니다. 그 형식을 알려주세요.");
