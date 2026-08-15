import type { Reel } from "@/lib/schemas";
import type { AnalyzeResult } from "@/lib/analysis/analyze";
import type { ReelKpiDeltas } from "@/lib/analysis/reelKpiDeltas";
import { CarouselGallery } from "@/components/CarouselGallery";
import { MetricBars } from "@/components/MetricBars";
import { ReelConversionFunnel } from "@/components/ReelConversionFunnel";
import { ReelPerformanceDashboard } from "@/components/ReelPerformanceDashboard";

interface Props {
  reel: Reel;
  analysis: AnalyzeResult;
  kpiDeltas?: ReelKpiDeltas;
}

/**
 * 캐러셀 상세.
 *
 * 릴스 상세와 순서도 구성도 다르다. 캐러셀에서 먼저 보고 싶은 것은 "이 장들이
 * 프로필로 사람을 보냈나"라서, 사진과 전환 퍼널·벤치마크를 맨 위에 나란히 둔다.
 *
 * 릴스의 진단·처방 카드(병목·강약점·해결책·핵심 인사이트)와 조회수 추이, 파생 성과
 * 지표는 여기 없다. 영상 잔존을 전제로 만든 진단이라 캐러셀에서는 읽을 값이 되지 못한다.
 */
export function CarouselDetail({ reel, analysis, kpiDeltas }: Props) {
  return (
    <>
      {/* 사진이 세로로 길어 옆이 비는데, 그 자리를 퍼널과 벤치마크가 채운다. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="w-full max-w-[26rem]">
          <CarouselGallery reelId={reel.id} thumbnailUrl={reel.thumbnailUrl} />
        </div>
        <div className="space-y-5">
          {/* 프로필 지표가 없는 게시물에서는 퍼널이 스스로 빠진다. */}
          <ReelConversionFunnel reel={reel} />
          {/* 좁은 단이라 조밀하게 — 사진 아래끝과 높이를 맞춘다. */}
          <MetricBars
            verdicts={analysis.diagnosis.verdicts}
            baselineActive={analysis.baselineActive}
            dense
          />
        </div>
      </div>

      <ReelPerformanceDashboard reel={reel} deltas={kpiDeltas} />

      {/* 캡션은 맨 아래에 둬 긴 본문이 지표를 밀어내지 않게 한다. */}
      {reel.caption && (
        <p className="whitespace-pre-line rounded-card border border-border-subtle bg-surface-muted/50 p-3 text-sm leading-relaxed text-neutral-700">
          {reel.caption}
        </p>
      )}
    </>
  );
}
