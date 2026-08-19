# Walla Open API 연동 조사 — 2026-08-19

## Question

대시보드의 "지원 신청" 단계가 0으로만 나온다. Walla 연동을 어떻게 붙이는지, API 키는
어떻게 다시 발급받는지, 지금 코드의 매핑이 실제 API 스펙과 맞는지 확인한다.

## Sources

- [응답 API 도움말](https://docs.walla.my/ko/docs/help-center/integrate-forms/response-api)
- [Developer Docs — Workspaces](https://docs.walla.my/ko/docs/developer-docs/workspaces)
- [Developer Docs — Responses](https://docs.walla.my/ko/docs/developer-docs/responses)
- [Developer Docs — Forms](https://docs.walla.my/ko/docs/developer-docs/forms)
- Swagger(로그인 필요): https://app.walla.my/open-api/doc

## Key Findings

1. **인증** — 모든 요청에 `X-WALLA-API-KEY: {키}` 헤더. 키당 시간당 6,000건 제한.
2. **기본 URL은 `https://app.walla.my/open-api/v1`.** developer-docs가 적어 둔
   `https://api.walla.my/...`는 **DNS에 없다**(NXDOMAIN, 2026-08-19 확인). 문서 오기다.
3. **키 발급** — Walla 로그인 → `app.walla.my/open-api/doc` → 'API Key Viewer' 패널.
   키는 한 번만 보여 주므로 그 자리에서 복사한다.
4. **폼 ID** — 폼 편집/공유 주소의 마지막 경로 조각. `GET /forms`나
   `GET /workspaces/{id}/forms`로도 목록을 받을 수 있다(`analytics.submissions` 포함).
5. **응답 조회** — `GET /forms/{formId}/responses?page=&limit=` (limit 최대 100).
   봉투는 `{ success, data: { responses, pagination } }`.
6. **기간 필터가 있다** — `POST /forms/{formId}/responses/search`가 `submittedFrom` /
   `submittedTo` / `hiddenFields` / `customerKeys`를 받는다. `lib/walla/sync.ts`는
   "기간 필터가 없어 매번 처음부터 훑는다"는 전제로 20페이지 상한을 두는데, 이 전제가 틀렸다.
7. **숨김 필드는 라벨 문자열이다** — `GET /forms/{formId}/hidden-fields`가
   `{ data: { hiddenFields: ["utm_source", "utm_medium"] } }` 형태로 **라벨 배열**만 준다
   (fieldId 없음, 1~30자 영숫자/언더스코어/하이픈). 응답 행에서는 `hidden-{필드ID}` 키로
   들어온다고 문서가 적고 있다.

## 지금 코드와의 불일치 (미검증 — 새 키로 확인 필요)

`lib/walla/map.ts`의 `buildHiddenFieldMap`은 **`GET /forms/{formId}/fields`**(폼 질문 필드)의
`fieldId`로 `hidden-{fieldId}` 키를 만든다. 그런데 숨김 필드는 질문 필드가 아니라 별도
엔드포인트(`/hidden-fields`)에서 라벨로만 관리된다. 둘이 같은 목록이 아니라면 매핑이 항상
비고, 그러면 모든 신청의 `medium`이 `unknown`이 되어 **`applyRate`가 영영 0%**다.
증상(신청은 쌓이는데 전환율 0%)이 정확히 이 모양이다.

확인 방법 — 새 키를 받은 뒤:

```bash
WALLA_API_KEY=새키 node scripts/walla-forms.mjs <formId>
```

이 스크립트가 `/hidden-fields` 라벨 목록과 실제 응답 객체의 키 이름(값은 가림)을 찍는다.
`hidden-utm_medium`처럼 **라벨이 붙어 오면** `buildHiddenFieldMap`을 `/hidden-fields` 기반으로
바꿔야 한다.

## Decision

- 미연동과 "신청 0건"을 API 계약에서 갈랐다(`/api/applications`의 `connected`).
- 매핑 수정은 실제 응답 키를 눈으로 본 뒤에 한다. 추측으로 고치면 어느 쪽이 맞는지 영영 모른다.

## Related Files

- lib/walla/client.ts — 기본 URL·봉투 파싱
- lib/walla/map.ts — 숨김 필드 → UTM 매핑 (불일치 의심 지점)
- lib/walla/sync.ts — 20페이지 상한 (search 엔드포인트로 대체 가능)
- scripts/walla-forms.mjs — 폼/숨김 필드/응답 키 확인용
