"use client";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Wifi, Upload } from "lucide-react";
import { Card, CardHeader, CardBody, CopyButton } from "@/components/ui";

// 릴스 상세에서 폰으로 EDIT 스크린샷을 바로 올리도록 QR을 띄운다.
// 서버의 LAN 주소를 감지해 /upload?reelId=...로 인코딩.
export function ScreenshotUploadCard({ reelId }: { reelId: string }) {
  const [lanUrl, setLanUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/host")
      .then((r) => r.json())
      .then((d) => setLanUrl(d.lanUrl))
      .catch(() => setLanUrl(null));
  }, []);

  const localUploadUrl = `/upload?reelId=${encodeURIComponent(reelId)}`;
  const lanUploadUrl = lanUrl ? `${lanUrl}${localUploadUrl}` : null;

  return (
    <Card>
      <CardHeader title="EDIT 스크린샷 업로드" icon={<QrCode size={16} className="text-brand-600" />} />
      <CardBody className="space-y-4">
        {/* PC: 기본 경로 — 같은 기기에서 바로 드래그앤드롭 업로드 */}
        <a
          href={localUploadUrl}
          className="flex items-center justify-center gap-2 rounded-card bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <Upload size={16} /> PC에서 파일 업로드 (드래그앤드롭)
        </a>
        <p className="text-xs text-neutral-500">
          이 PC에 스크린샷이 있으면 위 버튼이 가장 빠릅니다. 사진을 올리면 3초 훅·잔존 곡선·유입 소스가 자동 파싱·저장돼요.
        </p>

        {/* 폰: 보조 경로 — QR 스캔 */}
        <div className="border-t border-border-subtle pt-4">
          <p className="mb-3 text-sm font-medium text-neutral-700">폰에서 올리기</p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <div className="rounded-xl border border-border-subtle bg-surface p-3">
              {lanUploadUrl ? (
                <QRCodeSVG value={lanUploadUrl} size={120} />
              ) : (
                <div className="flex h-[120px] w-[120px] items-center justify-center text-xs text-neutral-400">
                  주소 감지 중…
                </div>
              )}
            </div>
            <div className="space-y-2 text-sm text-neutral-600">
              <p>폰 카메라로 QR을 스캔하면 <b>이 릴스</b>의 업로드 화면이 열립니다.</p>
              <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                <Wifi size={13} /> 폰과 PC가 같은 와이파이여야 해요.
              </p>
              {lanUploadUrl ? (
                <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
                  QR 링크 복사 <CopyButton text={lanUploadUrl} />
                </span>
              ) : (
                <p className="text-xs text-neutral-400">같은 네트워크가 아니면 위의 PC 업로드를 이용하세요.</p>
              )}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
