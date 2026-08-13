import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone은 Dockerfile이 .next/standalone을 복사하기 위한 설정이다.
  // Vercel은 자체 빌드 어댑터로 출력을 만들므로 이 모드가 필요 없고, 겹치면
  // 어댑터가 찾는 추적 파일(next-server.js.nft.json)이 생성되지 않는다.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
