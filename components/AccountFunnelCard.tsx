import type { ReactNode } from "react";
import {
  ArrowDown,
  FileCheck2,
  MousePointerClick,
  UserPlus,
  UserRoundSearch,
} from "lucide-react";
import type { AccountFunnel } from "@/lib/analysis/accountFunnel";
import { ACCOUNT_FUNNEL_WINDOW_DAYS } from "@/lib/analysis/accountFunnel";
import { fmtCount, fmtPct } from "@/lib/ui/format";
import { Card, CardBody, CardHeader } from "@/components/ui";

interface Props {
  funnel: AccountFunnel | null;
}

/**
 * 전환율 옆 높음/보통/낮음 판정은 걷어냈다. 기준으로 삼은 업계 벤치마크가 출처가
 * 확인되지 않은 추정치라, 판정이 옆의 실측 수치만큼 단정적으로 읽히는 게 문제였다.
 * 판정 자체는 lib(accountFunnelVerdicts)에 남아 진단·리포트가 계속 쓴다.
 */
export function AccountFunnelCard({ funnel }: Props) {
  if (funnel === null) return null;

  return (
    <Card className="overflow-hidden">
      {/* 신선도는 동기화 버튼 옆에서 한 번만 말한다. 카드에는 지표만 남긴다. */}
      <CardHeader
        title={`최근 ${ACCOUNT_FUNNEL_WINDOW_DAYS}일 계정 전환 흐름`}
        icon={<UserRoundSearch size={16} className="text-brand-600" />}
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
            />
            <Outcome
              label="링크 클릭"
              value={funnel.websiteClicks === null ? "-" : fmtCount(funnel.websiteClicks)}
              icon={<MousePointerClick size={15} aria-hidden="true" />}
              rate={funnel.linkClickRate}
              delta={funnel.deltas.linkClickRate}
              since={funnel.previousDate}
            />
          </div>

          <ApplicationStep funnel={funnel} />
        </section>
      </CardBody>
    </Card>
  );
}

/**
 * 링크 클릭 다음 구간. Graph 밖 데이터(신청 폼)라 Walla를 연결해야 채워진다.
 *
 * 미연동을 0건으로 그리지 않는다. 0은 "폼은 살아 있는데 아무도 신청하지 않았다"는
 * 뜻이라, 연결한 적 없는 계정에 띄우면 멀쩡한 폼이 죽은 것처럼 읽히고 원인을
 * 설정에서 찾을 단서도 없다. 단계는 남기되 미연동임을 그 자리에 밝힌다.
 */
function ApplicationStep({ funnel }: { funnel: AccountFunnel }) {
  if (funnel.applications === null) return <UnlinkedApplicationStep />;

  const bio = funnel.bioApplications ?? 0;
  // 분자는 바이오 유입만이다. 총 신청과 다르면 그 사실을 숫자 옆에 밝혀야
  // 사용자가 총 신청 ÷ 클릭으로 직접 계산했을 때 어긋나는 이유를 알 수 있다.
  const mixed = funnel.applications !== bio;

  return (
    <>
      <div className="relative flex h-12 items-center justify-center">
        <span
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-brand-200"
          aria-hidden="true"
        />
        <span className="relative inline-flex items-center gap-1 rounded-full border border-brand-200 bg-surface px-2.5 py-1 text-[11px] font-medium tabular-nums text-brand-700">
          <ArrowDown size={11} aria-hidden="true" />
          {funnel.applyRate === null
            ? "신청 전환율 미측정"
            : `${fmtPct(funnel.applyRate)} 신청 전환`}
        </span>
      </div>

      <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3.5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <MetricIdentity
            label="지원 신청"
            value={fmtCount(funnel.applications)}
            icon={<FileCheck2 size={15} aria-hidden="true" />}
          />
          <p className="text-right text-[11px] leading-relaxed text-neutral-500">
            {mixed ? `바이오 ${fmtCount(bio)}건이 링크 클릭 대비 전환율의 분자다` : "바이오 링크 클릭 대비"}
          </p>
        </div>
      </div>
    </>
  );
}

/** 신청 폼을 붙이지 않았을 때의 마지막 단계. 수치 자리에 상태를 적는다. */
function UnlinkedApplicationStep() {
  return (
    <>
      <div className="relative flex h-12 items-center justify-center">
        <span
          className="absolute inset-y-0 left-1/2 -translate-x-1/2 border-l border-dashed border-neutral-300"
          aria-hidden="true"
        />
        <span className="relative inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-[11px] font-medium text-neutral-500">
          <ArrowDown size={11} aria-hidden="true" />
          신청 전환율 미측정
        </span>
      </div>

      <div className="rounded-xl border border-dashed border-border-subtle bg-surface-muted/40 p-3.5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <MetricIdentity
            label="지원 신청"
            value="미연동"
            icon={<FileCheck2 size={15} aria-hidden="true" />}
            muted
          />
          <p className="text-right text-[11px] leading-relaxed text-neutral-500">
            설정 → 지원 신청 폼(Walla)을 연결하면 채워집니다
          </p>
        </div>
      </div>
    </>
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
}: {
  label: string;
  value: string;
  icon: ReactNode;
  rate: number | null;
  delta: number | null;
  since: string | null;
}) {
  return (
    <div className="group border-b border-border-subtle p-3.5 transition-colors last:border-b-0 hover:bg-surface sm:border-b-0">
      <MetricIdentity label={label} value={value} icon={icon} />
      <div className="mt-3 border-t border-border-subtle pt-2.5">
        <ConversionReadout context="방문 대비" rate={rate} delta={delta} since={since} />
      </div>
    </div>
  );
}

function MetricIdentity({
  icon,
  label,
  value,
  muted = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  /** 수치가 아니라 상태(미연동 등)를 적을 때. 실측값과 같은 무게로 읽히지 않게 죽인다. */
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${
          muted ? "bg-neutral-100 text-neutral-400" : "bg-brand-100 text-brand-700"
        }`}
      >
        {icon}
      </span>
      <div>
        <p className="text-xs text-neutral-500">{label}</p>
        <p
          className={`text-xl font-bold tabular-nums ${
            muted ? "text-neutral-400" : "text-neutral-900"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function ConversionReadout({
  context,
  rate,
  delta,
  since,
  align = "left",
}: {
  context: string;
  rate: number | null;
  delta: number | null;
  since: string | null;
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
      </div>
    </div>
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
