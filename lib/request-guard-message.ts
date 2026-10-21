// 화면용: AI 요청이 같은 사이트 확인(403)이나 요청 수 제한(429)으로 막혔을 때 보여 줄 안내 (Spec 047).
// 서버 코드(next/server)를 가져오지 않아 브라우저 번들에 넣어도 된다.

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function retrySeconds(error: Record<string, unknown> | null, header: string | null | undefined): number | null {
  const fromBody = error?.retryAfterSeconds;
  if (typeof fromBody === "number" && Number.isFinite(fromBody) && fromBody > 0) return fromBody;
  const fromHeader = header && /^\d+$/.test(header.trim()) ? Number(header.trim()) : NaN;
  return Number.isFinite(fromHeader) && fromHeader > 0 ? fromHeader : null;
}

/**
 * 요청이 서비스의 보호 장치(또는 Vercel Firewall 같은 플랫폼 제한)에 막혔다면 한국어 안내를, 아니면 null을 돌려준다.
 * Gemini 쪽 요청 한도 오류(`rate_limited`)처럼 서버가 다른 코드를 준 경우에는 null이라 기존 서버 안내를 그대로 쓴다.
 */
export function requestBlockedMessage(status: number | undefined, body: unknown, retryAfterHeader?: string | null): string | null {
  const error = record(record(body)?.error);
  const code = typeof error?.code === "string" ? error.code : undefined;
  if (code === "too_many_requests" || (status === 429 && code === undefined)) {
    const seconds = retrySeconds(error, retryAfterHeader);
    const wait = seconds === null ? "잠시" : `${Math.max(1, Math.ceil(seconds / 60))}분`;
    return `요청이 많아 잠시 쉬어 갑니다. ${wait} 뒤에 다시 시도해 주세요.`;
  }
  if (code === "forbidden_origin" || (status === 403 && code === undefined)) {
    return "이 화면에서 보낸 요청으로 확인되지 않아 처리하지 않았습니다. 사주 서비스 주소에서 페이지를 새로 고친 뒤 다시 시도해 주세요.";
  }
  return null;
}
