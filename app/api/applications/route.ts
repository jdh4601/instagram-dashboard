import { NextResponse } from "next/server";
import { getApplicationRepository } from "@/lib/store";
import { getWallaConnection } from "@/lib/walla";

/**
 * 신청 목록과 폼 연동 여부.
 *
 * connected를 따로 싣는 이유: 미연동일 때도 저장소는 빈 배열을 준다. 배열만 보내면
 * 화면이 "연결한 적 없음"과 "연결했는데 신청 0건"을 구분할 수 없어 멀쩡한 폼이
 * 죽은 것처럼 0건으로 그려진다.
 *
 * 응답에는 UTM만 담긴다(ApplicationSchema). 신청자 이름·연락처는 애초에 저장하지
 * 않으므로 이 엔드포인트로 개인정보가 나갈 일이 없다.
 */
export async function GET() {
  const [applications, connection] = await Promise.all([
    getApplicationRepository().list(),
    getWallaConnection(),
  ]);
  return NextResponse.json({ applications, connected: connection !== null });
}
