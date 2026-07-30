import type { ReactNode } from "react";
import {
  ArrowDown,
  MousePointerClick,
  UserPlus,
  UserRoundSearch,
} from "lucide-react";
import {
  ACCOUNT_FUNNEL_BENCHMARKS,
  type AccountFunnelMetricKey,
} from "@/config/benchmarks";
import type { AccountFunnel } from "@/lib/analysis/accountFunnel";
import {
  ACCOUNT_FUNNEL_WINDOW_DAYS,
  accountFunnelVerdicts,
} from "@/lib/analysis/accountFunnel";
import type { Band } from "@/lib/analysis/diagnosis";
import { fmtCount, fmtPct } from "@/lib/ui/format";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";

interface Props {
  funnel: AccountFunnel | null;
}

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

export function AccountFunnelCard({ funnel }: Props) {
  if (funnel === null) return null;

  const verdicts = accountFunnelVerdicts(funnel);
  const dateLabel = funnel.date.replaceAll("-", ".");

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span>
            최근 {ACCOUNT_FUNNEL_WINDOW_DAYS}일 계정 전환 흐름
            <span className="mt-0.5 block text-[11px] font-normal text-neutral-400">
              {dateLabel} 기준
            </span>
          </span>
        }
        icon={<UserRoundSearch size={16} className="text-brand-600" />}
        action={<Badge>계정 전체</Badge>}
      />
      <CardBody className="pt-3">
        <section aria-label={`최근 ${ACCOUNT_FUNNEL_WINDOW_DAYS}일 계정 전환 흐름`}>
          <div className="funnel-flow-node flex items-center justify-between gap-4 border-y border-border-subtle py-3">
            <div>
              <p className="text-xs font-medium text-neutral-500">유입</p>
              <p className="mt-0.5 text-sm font-semibold text-neutral-800">도달한 계정</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-neutral-900">
              {fmtCount(funnel.reach)}
            </p>
          </div>

          <FlowConnector rate={funnel.viewRate} />

          <div className="funnel-flow-node funnel-flow-node--secondary rounded-xl border border-brand-200 bg-brand-50/50 p-3.5 transition-colors hover:bg-brand-50">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <MetricIdentity
                label="프로필 방문"
                value={funnel.profileViews === null ? "-" : fmtCount(funnel.profileViews)}
                icon={<UserRoundSearch size={15} aria-hidden="true" />}
              />
              <ConversionReadout
                context="도달 대비"
                rate={funnel.viewRate}
                delta={funnel.deltas.viewRate}
                since={funnel.previousDate}
                verdict={verdicts.viewRate}
                benchmarkKey="viewRate"
                align="right"
              />
            </div>
          </div>

          <BranchConnector />

          <div className="funnel-flow-node funnel-flow-node--outcomes overflow-hidden rounded-xl border border-border-subtle bg-surface-muted/60 sm:grid sm:grid-cols-2 sm:divide-x sm:divide-border-subtle">
            <Outcome
              label="팔로우"
              value={funnel.follows === null ? "-" : fmtCount(funnel.follows)}
              icon={<UserPlus size={15} aria-hidden="true" />}
              rate={funnel.followRate}
              delta={funnel.deltas.followRate}
              since={funnel.previousDate}
              verdict={verdicts.followRate}
              benchmarkKey="followRate"
            />
            <Outcome
              label="링크 클릭"
              value={funnel.websiteClicks === null ? "-" : fmtCount(funnel.websiteClicks)}
              icon={<MousePointerClick size={15} aria-hidden="true" />}
              rate={funnel.linkClickRate}
              delta={funnel.deltas.linkClickRate}
              since={funnel.previousDate}
              verdict={verdicts.linkClickRate}
              benchmarkKey="linkClickRate"
            />
          </div>
        </section>
      </CardBody>
    </Card>
  );
}

function FlowConnector({ rate }: { rate: number | null }) {
  return (
    <div className="relative flex h-12 items-center justify-center">
      <span
        className="funnel-flow-line absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-brand-200"
        aria-hidden="true"
      />
      <span className="relative inline-flex items-center gap-1 rounded-full border border-brand-200 bg-surface px-2.5 py-1 text-[11px] font-medium tabular-nums text-brand-700">
        <ArrowDown size={11} aria-hidden="true" />
        {rate === null ? "방문 전환율 미측정" : `${fmtPct(rate)} 방문 전환`}
      </span>
    </div>
  );
}

function BranchConnector() {
  return (
    <div className="pt-3">
      <p className="text-center text-[11px] font-medium text-neutral-400">방문 후 행동</p>
      <div className="relative mx-auto hidden h-7 w-1/2 sm:block" aria-hidden="true">
        <span className="funnel-flow-branch absolute left-0 right-0 top-3.5 h-px bg-neutral-200" />
        <span className="funnel-flow-branch absolute left-1/2 top-0 h-3.5 w-px -translate-x-1/2 bg-neutral-200" />
        <span className="funnel-flow-branch absolute bottom-0 left-0 top-3.5 w-px bg-neutral-200" />
        <span className="funnel-flow-branch absolute bottom-0 right-0 top-3.5 w-px bg-neutral-200" />
      </div>
    </div>
  );
}

function Outcome({
  label,
  value,
  icon,
  rate,
  delta,
  since,
  verdict,
  benchmarkKey,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  rate: number | null;
  delta: number | null;
  since: string | null;
  verdict: Band | null;
  benchmarkKey: AccountFunnelMetricKey;
}) {
  return (
    <div className="group border-b border-border-subtle p-3.5 transition-colors last:border-b-0 hover:bg-surface sm:border-b-0">
      <MetricIdentity label={label} value={value} icon={icon} />
      <div className="mt-3 border-t border-border-subtle pt-2.5">
        <ConversionReadout
          context="방문 대비"
          rate={rate}
          delta={delta}
          since={since}
          verdict={verdict}
          benchmarkKey={benchmarkKey}
        />
      </div>
    </div>
  );
}

function MetricIdentity({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
        {icon}
      </span>
      <div>
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="text-xl font-bold tabular-nums text-neutral-900">{value}</p>
      </div>
    </div>
  );
}

function ConversionReadout({
  context,
  rate,
  delta,
  since,
  verdict,
  benchmarkKey,
  align = "left",
}: {
  context: string;
  rate: number | null;
  delta: number | null;
  since: string | null;
  verdict: Band | null;
  benchmarkKey: AccountFunnelMetricKey;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : undefined}>
      <p className="text-[10px] font-medium text-neutral-400">{context}</p>
      <div
        className={`mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${
          align === "right" ? "justify-end" : ""
        }`}
      >
        <span className="text-base font-semibold tabular-nums text-neutral-700">
          {rate === null ? "측정 안 됨" : fmtPct(rate)}
        </span>
        <RateDelta delta={delta} since={since} />
        <VerdictLabel verdict={verdict} benchmarkKey={benchmarkKey} />
      </div>
    </div>
  );
}

function VerdictLabel({
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

function RateDelta({ delta, since }: { delta: number | null; since: string | null }) {
  if (delta === null) return null;

  const rounded = Number(delta.toFixed(2));
  const title = since === null ? undefined : `${since} 대비`;

  if (rounded === 0) {
    return (
      <span className="text-[11px] tabular-nums text-neutral-400" title={title}>
        변화 없음
      </span>
    );
  }

  const up = rounded > 0;
  return (
    <span
      className={`text-[11px] tabular-nums ${
        up ? "text-band-strong" : "text-band-weak"
      }`}
      title={title}
    >
      {up ? "▲" : "▼"} {Math.abs(rounded).toFixed(2)}%p
    </span>
  );
}
