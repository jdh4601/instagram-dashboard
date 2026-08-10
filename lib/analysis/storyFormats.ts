/**
 * Short-Form Storytelling Template Database의 10개 포맷 카탈로그.
 *
 * 포맷마다 고유한 비트 시퀀스가 있다는 게 이 체계의 핵심이다. 예전처럼
 * 도입-전개-전환-마무리로 뭉뚱그리면 "어떤 비트를 빠뜨렸는지"를 짚을 수 없다.
 * 여기 담긴 비트 id가 곧 진단의 좌표계이고, 모델은 이 목록 밖의 id를 쓸 수 없다.
 */

export interface StoryBeatSpec {
  id: string;
  label: string;
  /** 이 비트가 대본에서 하는 일 */
  purpose: string;
  /** 문서에서 optional로 표시된 비트. 빠져도 결함이 아니다. */
  optional?: boolean;
  /** 빈칸을 판 재사용 문장. 빠진 비트를 채울 때 그대로 보여 준다. */
  templates: string[];
}

export interface StoryFormatSpec {
  id: string;
  label: string;
  description: string;
  /** 이 포맷을 아웃라이어로 만드는 조건 */
  secretSauce: string[];
  beats: StoryBeatSpec[];
}

export const STORY_FORMATS: readonly StoryFormatSpec[] = [
  {
    id: "heros-journey",
    label: "히어로즈 저니 (1인칭 문제 해결)",
    description: "문제를 겪고 실패를 거쳐 해법에 닿는 1인칭 변화 서사.",
    secretSauce: [
      "시청자가 화자와 같은 고통을 느껴야 해법에 몰입한다. 공감할 통증을 먼저 세워라.",
    ],
    beats: [
      {
        id: "intro",
        label: "도입",
        purpose: "주인공과 문제를 세운다",
        templates: [
          "[기간] 전, 저는 [겪던 문제]를 안고 있었습니다.",
          "저는 [역할]이었고 [문제]로 막혀 있었는데, 어떻게 풀어야 할지 몰랐습니다.",
        ],
      },
      {
        id: "inflection-point",
        label: "변곡점",
        purpose: "그 문제가 만든 통증을 구체적으로 드러낸다",
        templates: [
          "그것 때문에 [증상·손해]까지 생겼습니다.",
          "심할 때는 [최악의 순간: 잠을 못 잤다 / 포기 직전이었다]까지 갔습니다.",
        ],
      },
      {
        id: "rising-action",
        label: "실패한 시도",
        purpose: "해봤지만 안 됐던 방법들을 쌓아 문제를 과장한다",
        templates: [
          "[방법1], [방법2], [방법3]을 다 해봤지만 아무것도 안 통했습니다.",
          "[기간] 동안 남들이 하라는 [흔한 조언]을 그대로 했는데도 결과가 없었습니다.",
        ],
      },
      {
        id: "climax",
        label: "해법 발견",
        purpose: "다른 것을 시도해 문제를 푼 지점",
        templates: [
          "[기간]을 헤매고 나서야 진짜 통하는 한 가지를 찾았습니다: [해법].",
          "그러다 [해법·도구]를 알게 됐고, 그때부터 전부 달라졌습니다.",
        ],
      },
      {
        id: "falling-action",
        label: "결과 증명",
        purpose: "해법이 만든 성과를 보여 준다",
        templates: [
          "이걸 하고 나서 [결과·수치·반응]이 생겼습니다.",
          "[기간] 만에 [이전 상태]에서 [현재 상태]로 갔습니다.",
        ],
      },
      {
        id: "resolution",
        label: "제안 (선택)",
        purpose: "사업·서비스로 잇는 행동 유도",
        optional: true,
        templates: [
          "그 경험 때문에 [사업·서비스]를 시작했습니다. 저와 같던 분들이 [원하는 결과]에 닿게요.",
          "지금은 [타깃]이 [통증]에서 [원하는 결과]로 가도록 돕고 있습니다. [행동 유도]",
        ],
      },
    ],
  },
  {
    id: "personal-learning",
    label: "개인적 깨달음 (결과 먼저, 방법 나중)",
    description: "성과를 먼저 증명하고 그 성과를 만든 방법을 가르치는 구조.",
    secretSauce: [
      "눈으로 확인되는 강한 증거(스크린샷·수치)가 먼저 나와야 '어떻게 했지?'가 생긴다.",
      "해법이 뻔하면 증거가 오히려 '저 사람이라 된 것'으로 깎인다. 비직관적인 한 수가 필요하다.",
    ],
    beats: [
      {
        id: "hook-proof",
        label: "결과 훅",
        purpose: "성과나 대담한 주장으로 시작한다",
        templates: [
          "[기간] 만에 [성과]를 냈습니다. 어떻게 했는지 그대로 보여드릴게요.",
          "이거 하나 바꾸니까 [결과]가 나왔습니다.",
        ],
      },
      {
        id: "backstory",
        label: "이전 상태",
        purpose: "어디에서 출발했는지 짧게 깐다",
        templates: [
          "이전에 저는 [상태]였고 [잘못된 믿음]을 갖고 있었습니다.",
          "[기간] 동안 [잘못된 방법]을 하느라 [정체 지점]에 묶여 있었습니다.",
        ],
      },
      {
        id: "insight",
        label: "핵심 깨달음",
        purpose: "판을 바꾼 한 문장",
        templates: [
          "그러다 [깨달음]을 알았고, 그게 전부를 바꿨습니다.",
          "제가 하던 실수는 [실수]였습니다. 고친 방법은 [해결]입니다.",
        ],
      },
      {
        id: "breakdown",
        label: "실행 분해",
        purpose: "깨달음을 어떻게 적용했는지 단계로 쪼갠다",
        templates: [
          "제가 한 건 이겁니다. 첫째 [단계1], 둘째 [단계2], 마지막 [단계3].",
          "이 순서를 그대로 따랐습니다: [프레임워크].",
        ],
      },
      {
        id: "cta",
        label: "행동 유도 (선택)",
        purpose: "다음 행동으로 잇는다",
        optional: true,
        templates: [
          "전체 과정이 궁금하면 [행동 유도].",
          "이건 [제공물]에서 그대로 다루는 내용입니다. [행동 유도]",
        ],
      },
    ],
  },
  {
    id: "about-me",
    label: "어바웃 미 (오리진 스토리)",
    description: "지금의 일을 왜 하게 됐는지 설명하는 개인 배경 서사.",
    secretSauce: [
      "전문성보다 신뢰를 쌓는 포맷이다. 프로필 고정용으로 하나 만들어 두면 좋다.",
    ],
    beats: [
      {
        id: "intro",
        label: "출발점",
        purpose: "이야기가 시작되는 평범한 지점",
        templates: [
          "안녕하세요 [이름]입니다. [기간] 전만 해도 [역할]로 평범하게 살았습니다.",
          "이 모든 일 전에 저는 그냥 [공감 가는 정체성]이었습니다.",
        ],
      },
      {
        id: "conflict",
        label: "계기",
        purpose: "길을 틀게 만든 사건",
        templates: [
          "[인생을 바꾼 사건]이 있기 전까지는요.",
          "그러던 어느 날 [계기]가 생겼고, 더는 모른 척할 수 없었습니다.",
        ],
      },
      {
        id: "epiphany",
        label: "깨달음",
        purpose: "관점이 바뀐 순간",
        templates: [
          "그 일로 [깨달음]을 알게 됐습니다.",
          "그 순간 [realization]이 이해됐습니다.",
        ],
      },
      {
        id: "change",
        label: "행동",
        purpose: "깨달은 뒤 실제로 한 일",
        templates: [
          "그래서 [행동]을 했고, 그게 오늘까지 이어졌습니다. 지금은 [현재 결과]입니다.",
          "그길로 [과감한 행동]을 했습니다. 지금은 [현재 성과]까지 왔습니다.",
        ],
      },
      {
        id: "purpose",
        label: "이유",
        purpose: "브랜드를 움직이는 더 깊은 동기",
        templates: [
          "[결과]가 제 삶을 바꿨고, 그래서 [타깃]도 같은 곳에 닿게 돕는 걸 업으로 삼았습니다.",
          "지금 제가 하는 모든 일은 [대상]이 [통증] 없이 [목표]에 닿게 하는 것입니다.",
        ],
      },
    ],
  },
  {
    id: "before-after",
    label: "비포 애프터 (변화 공개)",
    description: "두 상태의 낙차 하나로 굴러가는 시각 중심 포맷.",
    secretSauce: [
      "두 상태의 격차 크기가 곧 성과다. 놀라울수록 시청·저장·공유가 붙는다.",
      "전환 순간이 감정의 정점이다. 비트 드롭이나 트렌딩 사운드에 컷을 맞춰라.",
      "설명이 필요 없는 포맷이라 15~30초가 가장 좋다.",
    ],
    beats: [
      {
        id: "hook",
        label: "훅",
        purpose: "변화를 예고한다",
        templates: [
          "[기간] 동안 [노력]한 결과를 [시간] 안에 보여드릴게요.",
          "[대상]이 [행동] 전후로 이렇게 달라집니다.",
        ],
      },
      {
        id: "before-state",
        label: "비포",
        purpose: "출발 상태를 보여 준다",
        templates: [
          "제 시작점은 이랬습니다: [이전 상태].",
          "[기간] 전 제 현실은 [이전 수치·모습]이었습니다.",
        ],
      },
      {
        id: "transition",
        label: "전환",
        purpose: "사운드에 맞춘 극적인 컷",
        templates: ["(대사 없이 비트 드롭·효과음에 컷을 맞추는 구간)"],
      },
      {
        id: "after-state",
        label: "애프터",
        purpose: "결과를 공개한다",
        templates: ["그리고 지금은 이렇습니다: [현재 상태].", "[기간] 뒤의 모습입니다."],
      },
      {
        id: "context",
        label: "맥락 (선택)",
        purpose: "걸린 시간이나 노력을 짧게 덧붙인다",
        optional: true,
        templates: ["[기간]의 [노력]. 충분히 값어치 했습니다.", "[행동]을 [기간] 한 게 전부입니다."],
      },
      {
        id: "cta",
        label: "행동 유도 (선택)",
        purpose: "다음 행동으로 잇는다",
        optional: true,
        templates: ["어떻게 했는지 궁금하면 [행동 유도].", "전체 과정은 [행동 유도]."],
      },
    ],
  },
  {
    id: "goal-dream",
    label: "목표·꿈 여정",
    description: "오래 품은 꿈을 향해 가는 중간 과정을 공유하고 동행을 청한다.",
    secretSauce: [
      "해낼 수 있을지 시청자가 진짜로 궁금해할 만큼 커야 한다.",
      "될지 안 될지 모르겠다는 취약한 순간을 드러내라.",
      "프로젝트 공지가 아니라 사적인 이야기를 들려주는 느낌이어야 한다.",
    ],
    beats: [
      {
        id: "introduce-dream",
        label: "꿈 소개",
        purpose: "꿈의 출발과 그것이 중요한 이유",
        templates: [
          "[나이] 때부터 [꿈]을 늘 그려왔습니다. [행동]할 때마다 그 생각이 납니다.",
          "기억하는 한 계속 [꿈]을 하고 싶었습니다. [주기]마다 떠오르는 일입니다.",
        ],
      },
      {
        id: "pursuit",
        label: "착수",
        purpose: "진짜로 움직이기 시작한 시점",
        templates: [
          "그러다 어느 [요일], [계기]로 지금이 아니면 안 되겠다 싶어 [행동]을 시작했습니다.",
          "[기간] 전에 말만 하는 걸 멈추고 [첫 행동]을 했습니다. 무서웠지만 지금 아니면 영영 못 할 것 같았어요.",
        ],
      },
      {
        id: "progress-update",
        label: "진행 상황",
        purpose: "지금 어디까지 왔는지",
        templates: [
          "지금까지 [해낸 것]을 했고, 이제 [다음 단계]에 들어갑니다. [기한]까지 [목표]에 닿으려면 [남은 일]을 끝내야 합니다.",
          "현재 지점은 [진척]입니다. 다음은 [다음 단계], 마감은 [날짜]입니다.",
        ],
      },
      {
        id: "cta",
        label: "동행 요청",
        purpose: "지켜봐 달라고 청한다",
        templates: [
          "제가 [목표]를 기한 안에 해내는지 보고 싶으면 [행동 유도].",
          "전 과정을 기록하겠습니다. 지켜봐 주세요.",
        ],
      },
    ],
  },
  {
    id: "challenge",
    label: "챌린지 (미션 수행)",
    description: "정해진 규칙과 기한 안에서 미션을 수행하는 과정.",
    secretSauce: [
      "미션 자체가 엄청나게 커야 한다.",
      "중간에 강도 높은 방해와 위기를 넣어라.",
    ],
    beats: [
      {
        id: "hook",
        label: "훅",
        purpose: "도전과 걸린 것을 선언한다",
        templates: [
          "[기간] 안에 [도전]을 해보겠습니다. 결과는 이렇습니다.",
          "[출발점]에서 시작해 [야심 찬 목표]가 가능할까요? 해봤습니다.",
        ],
      },
      {
        id: "rules-setup",
        label: "규칙",
        purpose: "제약 조건을 세운다",
        templates: [
          "규칙은 셋입니다: [규칙1], [규칙2], [규칙3].",
          "출발 [기준점], 목표 [타깃], 마감 [날짜].",
        ],
      },
      {
        id: "journey",
        label: "여정",
        purpose: "갈등과 장애물로 플롯을 쌓는다",
        templates: [
          "[N]일차: [진척·차질]. [이유] 때문에 [상황]이었습니다.",
          "그러다 [돌발 상황]이 터져서 [전환]해야 했습니다. [실패 직전 순간]까지 갔습니다.",
        ],
      },
      {
        id: "resolution-cliffhanger",
        label: "결말 또는 떡밥",
        purpose: "해냈는지 밝히거나 다음 편으로 넘긴다",
        templates: [
          "최종 결과: [결과]. [기간] 만에 [시작]에서 [끝]까지 갔습니다.",
          "[시간] 남은 시점에… [떡밥]. 2편에서 이어집니다.",
        ],
      },
    ],
  },
  {
    id: "win",
    label: "성취 발표",
    description: "증거와 함께 특정 성취를 알리고 축하하는 짧은 영상.",
    secretSauce: [
      "증거가 부정할 수 없고 눈에 보여야 한다 — 스크린샷, 알림, 실물.",
      "짧을수록 좋다. 즉흥적이고 날것일 때 가장 잘 먹힌다.",
    ],
    beats: [
      {
        id: "hook",
        label: "선언",
        purpose: "성취를 곧바로 말한다",
        templates: ["드디어 [성취]했습니다.", "방금 [성취]했는데 아직 실감이 안 납니다."],
      },
      {
        id: "proof",
        label: "증거",
        purpose: "눈에 보이는 근거를 든다",
        templates: [
          "이거 보세요: [증거].",
          "스크린샷입니다: [증거]. [기간] 전엔 [이전 수치]였습니다.",
        ],
      },
      {
        id: "emotional-beat",
        label: "의미",
        purpose: "이 성취가 왜 큰지 감정으로 잇는다",
        templates: [
          "이걸 위해 얼마나 오래 매달렸는지 모르실 겁니다. [기간]의 [희생].",
          "[시점]에 그만둘 뻔했습니다. 안 그만둔 이유가 이겁니다.",
        ],
      },
      {
        id: "acknowledgment",
        label: "여정 회고 (선택)",
        purpose: "여기까지 온 길을 짧게 인정한다",
        optional: true,
        templates: ["[이전]에서 [현재]까지. 말도 안 되죠.", "[핵심 요인] 없이는 없었을 일입니다."],
      },
      {
        id: "cta",
        label: "다음 목표 (선택)",
        purpose: "에너지를 앞으로 돌린다",
        optional: true,
        templates: ["다음 목표는 [다음 이정표]입니다. 지켜봐 주세요.", "[비슷한 목표]를 향해 가는 분이라면, 계속 하세요."],
      },
    ],
  },
  {
    id: "day-in-life",
    label: "브이로그 (하루 기록)",
    description: "1인칭으로 하루를 따라가며 긴장과 해결을 보여 준다.",
    secretSauce: [
      "성격이나 삶을 부러워하게 만드는 포맷이라 캐릭터를 살려야 한다.",
      "예상 밖의 장면이 반드시 하나는 있어야 한다.",
    ],
    beats: [
      {
        id: "hook",
        label: "정체성 제시",
        purpose: "누구의 하루인지 세운다",
        templates: [
          "[나이]살 [역할]의 하루입니다.",
          "[상태]로 사는 사람의 [요일]은 이렇습니다.",
        ],
      },
      {
        id: "morning",
        label: "아침",
        purpose: "톤을 잡는다",
        templates: [
          "하루는 [루틴]으로 시작합니다. [이유] 때문입니다.",
          "가장 먼저 [행동]. 제가 [의외의 습관]인 건 잘 모르실 겁니다.",
        ],
      },
      {
        id: "core-work",
        label: "핵심 일과",
        purpose: "실제로 무엇을 하는지와 그날의 난관",
        templates: [
          "오늘 최우선은 [과제]입니다. 문제는 [난관]이고요.",
          "[과제] 중간에 [문제]가 터져서 [전환]해야 했습니다.",
        ],
      },
      {
        id: "resolution-winddown",
        label: "마무리",
        purpose: "하루를 닫는다",
        templates: [
          "하루 끝. 오늘 해낸 건 [요약]. 내일은 [다음 우선순위]입니다.",
          "[생활]의 실제 모습입니다. 완벽하진 않지만 [솔직한 감정]입니다.",
        ],
      },
    ],
  },
  {
    id: "personal-update",
    label: "근황 공유",
    description: "삶이나 일에 생긴 변화를 1인칭으로 전한다.",
    secretSauce: [
      "권위나 신뢰보다 커뮤니티를 쌓는 포맷이다. 무대 뒤를 보여 준다는 감각으로 만들어라.",
    ],
    beats: [
      {
        id: "hook",
        label: "예고",
        purpose: "할 말이 있다고 운을 뗀다",
        templates: [
          "드릴 말씀이 있습니다: [예고].",
          "[기간] 동안 말 안 하고 있었는데, 이제 말할 때가 됐습니다.",
        ],
      },
      {
        id: "context",
        label: "배경",
        purpose: "상황을 세운다",
        templates: [
          "지난 [기간] 동안 저는 [이전 상태]였습니다.",
          "제가 [이전 상황]이었던 거 기억하시죠. 그런데요…",
        ],
      },
      {
        id: "update",
        label: "소식",
        purpose: "변화를 전한다",
        templates: [
          "[시점]부로 [변화]합니다. 이유를 말씀드릴게요.",
          "[결정]하기로 했습니다. [갈등] 때문에 쉽진 않았습니다.",
        ],
      },
      {
        id: "rationale",
        label: "이유",
        purpose: "왜 그렇게 했는지 설명한다",
        templates: [
          "이유는 단순합니다: [핵심 이유].",
          "[통찰]을 알아버렸고, 한번 보이니까 되돌릴 수가 없었습니다.",
        ],
      },
    ],
  },
  {
    id: "lesson-from-others",
    label: "타인에게 배운 것 (멘토 스토리)",
    description: "자기 이야기가 아니라 남의 경험을 교훈으로 전한다. 화자는 학생이자 전달자다.",
    secretSauce: [
      "자기 홍보가 아니라 배우는 사람의 자리에 서야 한다.",
      "'그 사람'이 막연한 언급이 아니라 그려지는 인물이어야 한다.",
      "가능하면 이름을 밝히고, 교훈을 뭉뚱그린 요약이 아니라 직접 인용이나 장면으로 남겨라.",
    ],
    beats: [
      {
        id: "hook",
        label: "인물과 교훈",
        purpose: "누구에게 무엇을 배웠는지 연다",
        templates: [
          "[인물·역할]에게서 강력한 걸 하나 배웠습니다.",
          "[인물]이 해준 말 한마디가 제 [영역]을 통째로 바꿨습니다.",
        ],
      },
      {
        id: "situation",
        label: "상황",
        purpose: "그 사람이 처했던 맥락을 그린다",
        templates: [
          "그분은 [문제]로 힘들어하고 있었습니다.",
          "그때 그분은 [상황: 폐업 직전 / 맨바닥에서 다시 시작 / 정점]이었습니다.",
        ],
      },
      {
        id: "lesson",
        label: "교훈",
        purpose: "핵심 통찰을 드러낸다",
        templates: [
          "그분이 저에게 말했습니다: '[교훈]'.",
          "잊히지 않는 한마디는 이겁니다: '[인용]'.",
        ],
      },
      {
        id: "application",
        label: "적용",
        purpose: "그 교훈을 어떻게 써서 무엇이 바뀌었는지",
        templates: [
          "그 조언대로 [행동]했고, [기간] 만에 [결과]가 났습니다.",
          "그 말을 따르고 나서 [이전]에서 [이후]로 갔습니다.",
        ],
      },
      {
        id: "cta",
        label: "나눔 (선택)",
        purpose: "시청자에게 되돌려 준다",
        optional: true,
        templates: ["이 교훈 하나가 당신도 바꿀 수 있습니다. [행동 유도]", "당신에게 가장 큰 걸 가르쳐 준 사람은 누구인가요?"],
      },
    ],
  },
];

export const STORY_FORMAT_IDS: readonly string[] = STORY_FORMATS.map((format) => format.id);

export function getStoryFormat(id: string): StoryFormatSpec | null {
  return STORY_FORMATS.find((format) => format.id === id) ?? null;
}

export function requiredBeats(format: StoryFormatSpec): StoryBeatSpec[] {
  return format.beats.filter((beat) => !beat.optional);
}

export function getBeatSpec(formatId: string, beatId: string): StoryBeatSpec | null {
  return getStoryFormat(formatId)?.beats.find((beat) => beat.id === beatId) ?? null;
}

/**
 * 프롬프트에 실을 카탈로그 요약.
 *
 * 포맷 id와 비트 id를 그대로 실어야 모델이 값을 지어내지 않는다. 템플릿 문장까지
 * 넣으면 응답이 길어지기만 하므로 여기서는 뺀다 — 템플릿은 화면에서 붙인다.
 */
export function formatCatalogForPrompt(): string {
  return STORY_FORMATS.map((format) => {
    const beats = format.beats
      .map((beat) => `${beat.id}(${beat.label}${beat.optional ? ", 선택" : ""}): ${beat.purpose}`)
      .join(" / ");
    return `- ${format.id} — ${format.label}: ${format.description}\n  비트: ${beats}`;
  }).join("\n");
}
