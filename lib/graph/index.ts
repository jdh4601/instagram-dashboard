import { getSettingsStore } from "@/lib/settings";
import { createGraphClient, type GraphClient } from "@/lib/graph/client";

// 설정에 저장된 Instagram 토큰으로 Graph 클라이언트 생성
export async function getInstagramClient(): Promise<GraphClient> {
  const settings = await getSettingsStore().get();
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim() || settings.instagram?.accessToken;
  if (!token) {
    throw new Error("Instagram 토큰이 없습니다. 대시보드 설정(/settings)에서 토큰을 추가하세요.");
  }
  return createGraphClient({ accessToken: token });
}
