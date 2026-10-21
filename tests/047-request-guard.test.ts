import test from "node:test";
import assert from "node:assert/strict";
import {
  aiRateLimitConfig,
  checkSameOrigin,
  clientKey,
  createAiRateLimiter,
  guardFailureResponse,
  PRODUCTION_ORIGIN,
  SlidingWindowLimiter,
} from "../lib/request-guard";
import { requestBlockedMessage } from "../lib/request-guard-message";

function req(headers: Record<string, string> = {}, url = "https://saju-service-steel.vercel.app/api/reading") {
  return new Request(url, { method: "POST", headers, body: "{}" });
}
const prod = { NODE_ENV: "production" };
const dev = { NODE_ENV: "development" };
const allowed = (headers: Record<string, string>, env: Record<string, string | undefined> = prod, url?: string) => checkSameOrigin(req(headers, url), env) === null;

// ── 같은 사이트 확인 ───────────────────────────────────────────────

test("Origin이 요청을 받은 서버 자신의 주소(Host 헤더 또는 요청 URL)면 허용한다", () => {
  assert.ok(allowed({ origin: "https://saju-service-steel.vercel.app" }));
  assert.ok(allowed({ origin: "http://example.test:4000", host: "example.test:4000" }, prod, "http://internal/api/reading"), "Host 헤더와 같으면 허용");
  assert.ok(allowed({ origin: "http://127.0.0.1:3047" }, prod, "http://127.0.0.1:3047/api/reading"), "요청 URL과 같으면 운영 모드에서도 허용");
  assert.ok(allowed({ origin: "HTTPS://Saju-Service-Steel.Vercel.App" }), "대소문자는 구분하지 않는다");
  assert.ok(!allowed({ origin: "http://example.test:4001", host: "example.test:4000" }, prod, "http://internal/api/reading"), "포트가 다르면 다른 출처");
});

test("운영 주소와 VERCEL_URL·VERCEL_BRANCH_URL·VERCEL_PROJECT_PRODUCTION_URL은 https일 때만 허용한다", () => {
  const other = "https://other-host.test/api/reading";
  assert.equal(PRODUCTION_ORIGIN, "https://saju-service-steel.vercel.app");
  assert.ok(allowed({ origin: PRODUCTION_ORIGIN }, prod, other));
  assert.ok(!allowed({ origin: "http://saju-service-steel.vercel.app" }, prod, other), "운영 주소의 http는 거절");
  for (const name of ["VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL"]) {
    const env = { ...prod, [name]: "saju-git-feat-abc.vercel.app" };
    assert.ok(allowed({ origin: "https://saju-git-feat-abc.vercel.app" }, env, other), `${name} https 허용`);
    assert.ok(!allowed({ origin: "http://saju-git-feat-abc.vercel.app" }, env, other), `${name} http 거절`);
    assert.ok(!allowed({ origin: "https://saju-git-feat-abc.vercel.app" }, prod, other), `${name}가 없으면 거절`);
  }
  // 환경변수에 https://가 붙어 있어도 같은 호스트로 읽는다.
  assert.ok(allowed({ origin: "https://preview.vercel.app" }, { ...prod, VERCEL_URL: "https://preview.vercel.app" }, other));
  assert.ok(!allowed({ origin: "https://evil-saju-service-steel.vercel.app" }, prod, other), "비슷한 이름은 거절");
  assert.ok(!allowed({ origin: "https://saju-service-steel.vercel.app.evil.test" }, prod, other));
});

test("localhost·127.0.0.1·[::1]의 다른 포트는 개발 중에만 허용한다", () => {
  const url = "http://localhost:3000/api/reading";
  for (const origin of ["http://localhost:5173", "http://127.0.0.1:8080", "http://[::1]:3001", "https://localhost"]) {
    assert.ok(allowed({ origin }, dev, url), `개발 ${origin}`);
    assert.ok(allowed({ origin }, {}, url), `NODE_ENV 없음 ${origin}`);
    assert.ok(!allowed({ origin }, prod, url), `운영 ${origin}`);
  }
  assert.ok(!allowed({ origin: "http://localhost.evil.test" }, dev, url));
  assert.ok(!allowed({ origin: "http://0.0.0.0:3000" }, dev, url));
});

test("Origin: null, 잘못된 출처, http/https가 아닌 출처는 거절한다", () => {
  for (const origin of ["null", "not a url", "file:///etc/passwd", "chrome-extension://abcdef", "https://evil.example", "ftp://saju-service-steel.vercel.app"]) {
    const failure = checkSameOrigin(req({ origin }), dev);
    assert.ok(failure, origin);
    assert.equal(failure.status, 403);
    assert.equal(failure.code, "forbidden_origin");
    assert.match(failure.message, /다른 사이트/);
  }
  // Origin이 있으면 Sec-Fetch-Site가 same-origin이라도 Origin으로 판정한다.
  assert.ok(!allowed({ origin: "https://evil.example", "sec-fetch-site": "same-origin" }));
});

test("Origin이 없으면 Sec-Fetch-Site가 same-origin·none일 때만 허용하고, 둘 다 없으면 통과한다", () => {
  assert.ok(allowed({ "sec-fetch-site": "same-origin" }));
  assert.ok(allowed({ "sec-fetch-site": "none" }));
  assert.ok(allowed({ "sec-fetch-site": " Same-Origin " }), "공백·대소문자 무시");
  for (const site of ["cross-site", "same-site", "weird"]) {
    const failure = checkSameOrigin(req({ "sec-fetch-site": site }), prod);
    assert.equal(failure?.status, 403, site);
    assert.equal(failure?.code, "forbidden_origin");
  }
  assert.equal(checkSameOrigin(req({}), prod), null, "curl·스크립트 요청은 통과(요청 수 제한만 적용)");
});

// ── 이용자 구분 값 ────────────────────────────────────────────────

test("clientKey는 x-forwarded-for 첫 IP → x-real-ip → unknown 순서이고 64자로 자르며 소문자로 바꾼다", () => {
  assert.equal(clientKey(req({ "x-forwarded-for": " 203.0.113.9 , 10.0.0.1", "x-real-ip": "198.51.100.1" })), "203.0.113.9");
  assert.equal(clientKey(req({ "x-real-ip": " 198.51.100.1 " })), "198.51.100.1");
  assert.equal(clientKey(req({ "x-forwarded-for": " , 10.0.0.1", "x-real-ip": "198.51.100.1" })), "198.51.100.1", "첫 칸이 비면 x-real-ip");
  assert.equal(clientKey(req({})), "unknown");
  assert.equal(clientKey(req({ "x-forwarded-for": "2001:DB8::1" })), "2001:db8::1");
  const long = "A".repeat(100);
  assert.equal(clientKey(req({ "x-forwarded-for": long })), "a".repeat(64));
  assert.equal(clientKey(req({ "x-real-ip": long })).length, 64);
});

// ── 슬라이딩 창 ───────────────────────────────────────────────────

test("슬라이딩 창: 한도까지 허용하고, 다음 요청은 가장 오래된 기록이 창을 벗어날 때까지 기다린다", () => {
  const limiter = new SlidingWindowLimiter({ limit: 3, windowMs: 1000, now: () => { throw new Error("at을 넘겨야 합니다"); } });
  for (const at of [0, 100, 200]) {
    assert.equal(limiter.retryAfterMs("a", at), 0);
    limiter.record("a", at);
  }
  assert.equal(limiter.retryAfterMs("a", 200), 800);
  assert.equal(limiter.retryAfterMs("a", 999), 1, "창 끝 1ms 전");
  assert.equal(limiter.retryAfterMs("a", 1000), 0, "첫 기록 시각 + 창에 정확히 다시 허용");
  assert.equal(limiter.retryAfterMs("b", 200), 0, "다른 키는 따로 센다");
  limiter.record("a", 1000);
  assert.equal(limiter.retryAfterMs("a", 1000), 100, "이제 100ms 기록이 가장 오래됨");
  assert.equal(limiter.retryAfterMs("a", 2300), 0, "창이 모두 지나면 다시 허용");
  assert.equal(limiter.size, 0, "기록이 모두 지난 키는 지운다");
});

test("retryAfterMs는 확인만 하고 기록하지 않는다", () => {
  const limiter = new SlidingWindowLimiter({ limit: 1, windowMs: 1000 });
  for (let i = 0; i < 10; i++) assert.equal(limiter.retryAfterMs("k", 0), 0);
  assert.equal(limiter.size, 0);
  limiter.record("k", 0);
  assert.equal(limiter.retryAfterMs("k", 0), 1000);
});

test("maxKeys를 넘으면 가장 오래 쓰지 않은 키부터 지우고, 창이 지난 키는 정리한다", () => {
  const limiter = new SlidingWindowLimiter({ limit: 2, windowMs: 1000, maxKeys: 3 });
  for (const [i, key] of ["a", "b", "c"].entries()) limiter.record(key, 10 + i);
  limiter.record("a", 20); // a를 최근에 쓴 키로
  limiter.record("d", 21);
  assert.equal(limiter.size, 3);
  assert.equal(limiter.retryAfterMs("b", 22), 0, "가장 오래 쓰지 않은 b가 지워짐");
  limiter.record("a", 23);
  assert.equal(limiter.retryAfterMs("a", 23), 997, "a는 남아 있고(기록 20·23) 한도 2에 도달");
  for (let i = 0; i < 50; i++) limiter.record(`k${i}`, 30 + i);
  assert.equal(limiter.size, 3, "키는 최대 3개");
  limiter.record("late", 5000);
  assert.equal(limiter.size, 1, "창이 지난 키는 정리된다");
});

test("키마다 기록은 한도 수만큼만 남긴다", () => {
  const limiter = new SlidingWindowLimiter({ limit: 2, windowMs: 1000 });
  for (let at = 0; at < 10; at++) limiter.record("k", at);
  const hits = (limiter as unknown as { hits: Map<string, number[]> }).hits.get("k");
  assert.deepEqual(hits, [8, 9]);
});

// ── IP별 + 전체 제한 ──────────────────────────────────────────────

test("createAiRateLimiter: 기본 reading은 IP당 6건, 7번째는 429와 남은 초·분을 돌려준다", () => {
  let now = 1_000_000;
  const limiter = createAiRateLimiter("reading", {}, () => now);
  assert.deepEqual(limiter.config, { windowMs: 600_000, perIp: 6, global: 60 });
  const r = () => req({ "x-forwarded-for": "203.0.113.1" });
  for (let i = 0; i < 6; i++) { assert.equal(limiter.take(r()), null); now += 1000; }
  const blocked = limiter.take(r());
  assert.ok(blocked);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.code, "too_many_requests");
  assert.equal(blocked.retryAfterSeconds, 594, "첫 요청 뒤 600초 - 이미 지난 6초");
  assert.equal(blocked.message, "요청이 많아 잠시 쉬어 갑니다. 10분 뒤에 다시 시도해 주세요.");
  assert.equal(limiter.take(req({ "x-forwarded-for": "203.0.113.2" })), null, "다른 IP는 통과");
  now = 1_000_000 + 600_000;
  assert.equal(limiter.take(r()), null, "창이 지나면 다시 허용");
  // 61초 남으면 2분, 1초 미만이면 1초·1분으로 올린다.
  const short = createAiRateLimiter("reading", { READING_RATE_LIMIT_PER_IP: "1", AI_RATE_LIMIT_WINDOW_SECONDS: "61" }, () => now);
  short.take(r());
  assert.equal(short.take(r())!.message, "요청이 많아 잠시 쉬어 갑니다. 2분 뒤에 다시 시도해 주세요.");
  now += 60_999.5;
  const tail = short.take(r())!;
  assert.equal(tail.retryAfterSeconds, 1);
  assert.match(tail.message, /1분 뒤/);
});

test("전체 한도에 막힌 요청은 IP별 기록을 남기지 않고, IP 한도에 막힌 요청은 전체 기록을 남기지 않는다", () => {
  let now = 0;
  const limiter = createAiRateLimiter("reading", { READING_RATE_LIMIT_PER_IP: "2", READING_RATE_LIMIT_GLOBAL: "3", AI_RATE_LIMIT_WINDOW_SECONDS: "100" }, () => now);
  const ip = (n: number) => req({ "x-forwarded-for": `198.51.100.${n}` });
  assert.equal(limiter.take(ip(1)), null);
  assert.equal(limiter.take(ip(1)), null);
  assert.equal(limiter.take(ip(1))?.status, 429, "IP 한도 2");
  assert.equal(limiter.take(ip(2)), null, "IP 한도에 막힌 요청은 전체 수에 들어가지 않아 3번째 자리가 남는다");
  now = 10_000;
  const blocked = limiter.take(ip(3));
  assert.equal(blocked?.status, 429, "전체 한도 3");
  assert.equal(blocked?.retryAfterSeconds, 90);
  now = 100_000; // 처음 두 건(시각 0)이 창을 벗어남 → 전체 2자리 빔
  assert.equal(limiter.take(ip(3)), null);
  assert.equal(limiter.take(ip(3)), null, "막혔던 ip3 요청이 IP별 기록을 남겼다면 여기서 막혔을 것");
});

test("consultation 기본값은 IP당 3건·전체 20건이다", () => {
  const limiter = createAiRateLimiter("consultation", {}, () => 0);
  assert.deepEqual(limiter.config, { windowMs: 600_000, perIp: 3, global: 20 });
  for (let i = 0; i < 3; i++) assert.equal(limiter.take(req({})), null);
  assert.equal(limiter.take(req({}))?.status, 429, "헤더가 없으면 모두 unknown 한 키");
  const global = createAiRateLimiter("consultation", {}, () => 0);
  for (let i = 0; i < 20; i++) assert.equal(global.take(req({ "x-forwarded-for": `10.0.0.${i}` })), null);
  assert.equal(global.take(req({ "x-forwarded-for": "10.0.1.1" }))?.status, 429);
});

test("환경변수: 1 이상의 정수만 쓰고 0·음수·소수·문자·빈 값·상한 초과는 기본값", () => {
  const read = (value: string | undefined) => aiRateLimitConfig("reading", { READING_RATE_LIMIT_PER_IP: value }).perIp;
  assert.equal(read("8"), 8);
  assert.equal(read(" 9 "), 9);
  assert.equal(read("10000"), 10_000, "IP 상한 10,000");
  for (const bad of [undefined, "", "  ", "0", "-3", "2.5", "abc", "10001", "Infinity", "NaN"]) assert.equal(read(bad), 6, String(bad));
  const window = (value: string) => aiRateLimitConfig("reading", { AI_RATE_LIMIT_WINDOW_SECONDS: value }).windowMs;
  assert.equal(window("120"), 120_000);
  assert.equal(window("86400"), 86_400_000);
  assert.equal(window("86401"), 600_000);
  assert.equal(window("0"), 600_000);
  const global = (value: string) => aiRateLimitConfig("consultation", { CONSULTATION_RATE_LIMIT_GLOBAL: value }).global;
  assert.equal(global("100000"), 100_000);
  assert.equal(global("100001"), 20);
  assert.equal(aiRateLimitConfig("consultation", { CONSULTATION_RATE_LIMIT_PER_IP: "10" }).perIp, 10);
  assert.equal(aiRateLimitConfig("reading", { CONSULTATION_RATE_LIMIT_PER_IP: "10" }).perIp, 6, "다른 경로의 변수는 쓰지 않는다");
  assert.equal(aiRateLimitConfig("reading", { READING_RATE_LIMIT_GLOBAL: "7" }).global, 7);
});

// ── 응답 형식 ─────────────────────────────────────────────────────

test("guardFailureResponse: 429는 Retry-After·no-store·retryAfterSeconds, 403은 Retry-After 없음", async () => {
  const limited = guardFailureResponse({ status: 429, code: "too_many_requests", message: "요청이 많아 잠시 쉬어 갑니다. 10분 뒤에 다시 시도해 주세요.", retryAfterSeconds: 600 });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "600");
  assert.equal(limited.headers.get("cache-control"), "no-store");
  assert.match(limited.headers.get("content-type") ?? "", /application\/json/);
  assert.deepEqual(await limited.json(), { error: { code: "too_many_requests", message: "요청이 많아 잠시 쉬어 갑니다. 10분 뒤에 다시 시도해 주세요.", retryAfterSeconds: 600 } });
  const forbidden = guardFailureResponse(checkSameOrigin(req({ origin: "https://evil.example" }), prod)!);
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get("retry-after"), null);
  assert.equal(forbidden.headers.get("cache-control"), "no-store");
  const body = await forbidden.json() as { error: Record<string, unknown> };
  assert.equal(body.error.code, "forbidden_origin");
  assert.ok(!("retryAfterSeconds" in body.error));
});

// ── 화면 안내 문구 ────────────────────────────────────────────────

test("requestBlockedMessage: 보호 장치·코드 없는 429/403만 안내하고 Gemini 쪽 오류는 null", () => {
  const wait = (text: string) => `요청이 많아 잠시 쉬어 갑니다. ${text} 뒤에 다시 시도해 주세요.`;
  const forbidden = "이 화면에서 보낸 요청으로 확인되지 않아 처리하지 않았습니다. 사주 서비스 주소에서 페이지를 새로 고친 뒤 다시 시도해 주세요.";
  assert.equal(requestBlockedMessage(429, { error: { code: "too_many_requests", retryAfterSeconds: 600 } }), wait("10분"));
  assert.equal(requestBlockedMessage(429, { error: { code: "too_many_requests", retryAfterSeconds: 61 } }), wait("2분"));
  assert.equal(requestBlockedMessage(429, { error: { code: "too_many_requests", retryAfterSeconds: 1 } }), wait("1분"));
  assert.equal(requestBlockedMessage(429, { error: { code: "too_many_requests" } }, "30"), wait("1분"), "본문에 없으면 헤더");
  assert.equal(requestBlockedMessage(429, { error: { code: "too_many_requests", retryAfterSeconds: 120 } }, "30"), wait("2분"), "본문이 헤더보다 우선");
  assert.equal(requestBlockedMessage(429, {}, null), wait("잠시"));
  assert.equal(requestBlockedMessage(429, null, "Wed, 21 Oct 2026 07:28:00 GMT"), wait("잠시"), "날짜 형식 Retry-After는 쓰지 않는다");
  assert.equal(requestBlockedMessage(429, "<html>Too Many Requests</html>", "  90 "), wait("2분"), "JSON이 아닌 429");
  assert.equal(requestBlockedMessage(429, { error: { code: "too_many_requests", retryAfterSeconds: -5 } }, "abc"), wait("잠시"));
  assert.equal(requestBlockedMessage(undefined, { error: { code: "too_many_requests" } }), wait("잠시"), "상태가 없어도 코드로 판정");
  assert.equal(requestBlockedMessage(403, { error: { code: "forbidden_origin" } }), forbidden);
  assert.equal(requestBlockedMessage(403, {}), forbidden, "코드 없는 403(플랫폼 차단)");
  assert.equal(requestBlockedMessage(403, []), forbidden);
  assert.equal(requestBlockedMessage(429, { error: { code: "rate_limited", message: "Gemini 요청이 잠시 몰렸습니다." } }), null, "Gemini 쪽 429");
  assert.equal(requestBlockedMessage(503, { error: { code: "missing_api_key" } }), null);
  assert.equal(requestBlockedMessage(403, { error: { code: "invalid_api_key" } }), null);
  assert.equal(requestBlockedMessage(502, {}), null);
  assert.equal(requestBlockedMessage(undefined, { error: { message: "가상 오류" } }), null, "예전 mock(상태 없음)");
});
