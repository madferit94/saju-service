import type { NextConfig } from "next";

// 모든 경로에 적용하는 기본 보안 헤더. 콘텐츠 보안 정책(CSP)은 이번 변경 범위가 아니다(Spec 045).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  agentRules: false,
  experimental: { cpus: 2 },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
