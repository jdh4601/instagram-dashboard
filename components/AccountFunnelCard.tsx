import type { ReactNode } from "react";
import { CornerDownRight, UserRoundSearch } from "lucide-react";
import { ACCOUNT_FUNNEL_BENCHMARKS, type AccountFunnelMetricKey } from "@/config/benchmarks";
import type { AccountFunnel } from "@/lib/analysis/accountFunnel";
import { ACCOUNT_FUNNEL_WINDOW_DAYS, accountFunnelVerdicts } from "@/lib/analysis/accountFunnel";
import type { Band } from "@/lib/analysis/diagnosis";
import { fmtCount, fmtPct } from "@/lib/ui/format";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";

interface Props {
  funnel: AccountFunnel | null;
}

const BAND_BAR_CLASS: Record<Band, string> = {
  weak: "bg-band-weak",
  ok: "bg-band-ok",
  strong: "bg-band-strong",
};

const VERDICT_LABEL: Record<Band, string> = {
  weak: "낮음",
  ok: "보통",
  strong: "높음",
};

const VERDICT_CLASS: Record<Band, string> = {
  weak: "text-band-weak",
  ok: "text-band-ok",
  strong: "text-band-strong",
};

function bandBarClass(verdict: Band | null): string {
  return verdict === null ? "bg-neutral-300" : BAND_BAR_CLASS[verdict];
}

export function AccountFunnelCard({ funnel }: Props) {
  if (funnel === null) return null;

  const verdicts = accountFunnelVerdicts(funnel);

  return (
    <Card>
      <CardHeader
        title={`최근 ${ACCOUNT_FUNNEL_WINDOW_DAYS}일 팔로워 순증 분해`}
        icon={<UserRoundSearch size={16} className="text-brand-600" />}
        action={<Badge>계정 전체 기준</Badge>}
      />
      <CardBody className="space-y-4">
        {/* 도달과 방문은 같은 트랙 위에 쌓인 막대라 방문 막대 너비 자체가 도달 대비 비율이다. */}
        <FunnelRow label="도달" value={fmtCount(funnel.reach)} percent={100} barColorClass="bg-brand-500" />
        <FunnelRow
          label="프로필 방문"
          value={funnel.profileViews === null ? "-" : fmtCount(funnel.profileViews)}
          rate={funnel.viewRate === null ? undefined : fmtPct(funnel.viewRate)}
          delta={funnel.deltas.viewRate}
          since={funnel.previousDate}
          verdict={verdicts.viewRate}
          benchmarkKey="viewRate"
          percent={funnel.viewRate}
          barColorClass={bandBarClass(verdicts.viewRate)}
        />

        {/* 팔로우와 링크 클릭은 순차 단계가 아니라 방문에서 갈라지는 병렬 결과다.
            그래서 화살표로 잇지 않고 같은 들여쓰기 아래 나란히 반반씩 배치한다. */}
        <div className="border-l-2 border-neutral-200 pl-3">
          <p className="mb-2 text-[11px] text-neutral-400">방문 대비</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <FunnelRow
              icon={<CornerDownRight size={12} className="shrink-0 text-neutral-300" aria-hidden="true" />}
              label="팔로우"
              value={funnel.follows === null ? "-" : fmtCount(funnel.follows)}
              rate={funnel.followRate === null ? undefined : fmtPct(funnel.followRate)}
              delta={funnel.deltas.followRate}
              since={funnel.previousDate}
              verdict={verdicts.followRate}
              benchmarkKey="followRate"
              percent={funnel.followRate}
              barColorClass={bandBarClass(verdicts.followRate)}
            />
            <FunnelRow
              icon={<CornerDownRight size={12} className="shrink-0 text-neutral-300" aria-hidden="true" />}
              label="링크 클릭"
              value={funnel.websiteClicks === null ? "-" : fmtCount(funnel.websiteClicks)}
              rate={funnel.linkClickRate === null ? undefined : fmtPct(funnel.linkClickRate)}
              delta={funnel.deltas.linkClickRate}
              since={funnel.previousDate}
              verdict={verdicts.linkClickRate}
              benchmarkKey="linkClickRate"
              percent={funnel.linkClickRate}
              barColorClass={bandBarClass(verdicts.linkClickRate)}
            />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function FunnelRow({
  icon,
  label,
  value,
  rate,
  delta,
  since,
  verdict,
  benchmarkKey,
  percent,
  barColorClass,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  rate?: string;
  delta?: number | null;
  since?: string | null;
  verdict?: Band | null;
  benchmarkKey?: AccountFunnelMetricKey;
  percent: number | null;
  barColorClass: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <span className="flex items-center gap-1 text-xs text-neutral-500">
          {icon}
          {label}
        </span>
        <span className="flex items-baseline gap-2 tabular-nums">
          <span className="text-base font-bold text-neutral-900">{value}</span>
          {rate && <span className="text-xs text-neutral-400">{rate}</span>}
          <RateDelta delta={delta ?? null} since={since ?? null} />
          {benchmarkKey !== undefined && (
            <VerdictBadge verdict={verdict ?? null} benchmarkKey={benchmarkKey} />
          )}
        </span>
      </div>
      <div className="mt-1">
        <Bar percent={percent} colorClass={barColorClass} />
      </div>
    </div>
  );
}

function Bar({ percent, colorClass }: { percent: number | null; colorClass: string }) {
  // 값이 있는데 0에 아주 가까우면 막대가 안 보여 "측정 안 됨"과 헷갈린다.
  // 최소 폭을 줘서 "있지만 작다"와 "값 자체가 없다"를 구분한다.
  const width = percent === null ? 0 : Math.min(100, Math.max(percent, percent > 0 ? 1.5 : 0));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${width}%` }} />
    </div>
  );
}

// 강점·약점 대신 "평균"이라 부르는 이유: 세 지표 다 출처가 확인된 단일 평균값이
// 아니라 약점/강점을 가르는 두 경계값(weakBelow~strongAbove)뿐이다. 그 구간을
// "평균"으로 보여주는 게 없는 숫자를 지어내는 것보다 정직하다. 문장 전체를 상시
// 노출하는 대신 짧은 배지 + 툴팁으로 둬서 한 줄에 라벨·값·비율·증감·판정이 다 들어가도
// 빽빽해 보이지 않게 한다.
function VerdictBadge({
  verdict,
  benchmarkKey,
}: {
  verdict: Band | null;
  benchmarkKey: AccountFunnelMetricKey;
}) {
  if (verdict === null) return null;

  const { weakBelow, strongAbove } = ACCOUNT_FUNNEL_BENCHMARKS[benchmarkKey];
  return (
    <span
      className={`text-[11px] font-medium ${VERDICT_CLASS[verdict]}`}
      title={`일반적인 인스타그램 업계 벤치마크 추정치 기준 (평균 ${weakBelow}~${strongAbove}%, 정확한 출처가 확인된 값은 아님)`}
    >
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

// 전환율의 증감은 퍼센트포인트다. 비율을 비율로 나눈 "몇 % 상승"은 6.0%→6.1%가
// "+1.7% 상승"으로 보여 오해를 부른다.
function RateDelta({ delta, since }: { delta: number | null; since: string | null }) {
  if (delta === null) return null;

  const rounded = Number(delta.toFixed(2));
  const title = since === null ? undefined : `${since} 대비`;

  if (rounded === 0) {
    return (
      <span className="text-[11px] text-neutral-400 tabular-nums" title={title}>
        변화 없음
      </span>
    );
  }

  const up = rounded > 0;
  return (
    <span
      className={`text-[11px] tabular-nums ${up ? "text-band-strong" : "text-band-weak"}`}
      title={title}
    >
      {up ? "▲" : "▼"} {Math.abs(rounded).toFixed(2)}%p
    </span>
  );
}
