// Gemini를 부르는 API(/api/reading, /api/consultation) 앞에 두는 남용·비용 방지 장치 (Spec 047).
// 1) 같은 사이트 확인: 다른 사이트의 브라우저 요청을 403으로 막는다.
// 2) 요청 수 제한: 서버 인스턴스 메모리에서 IP별·전체 요청 수를 일정 시간 창으로 센다.
// 한계: Origin·Sec-Fetch-Site가 없는 요청(curl·스크립트)은 1)을 통과해 2)만 적용된다.
// 메모리 제한은 서버 인스턴스마다 따로 세는 최선 노력이며, 전체 한도는 Vercel Firewall 규칙으로 보완한다.
import { NextResponse } from "next/server";

export const PRODUCTION_ORIGIN = "https://saju-service-steel.vercel.app";

type Env = Record<string, string | undefined>;

export type RequestGuardFailure = {
  status: 403 | 429;
  code: "forbidden_origin" | "too_many_requests";
  message: string;
  retryAfterSeconds?: number;
};

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).host.toLowerCase();
  } catch {
    return null;
  }
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** 요청이 다른 사이트의 브라우저에서 왔으면 403 실패를, 아니면 null을 돌려준다. */
export function checkSameOrigin(request: Request, env: Env): RequestGuardFailure | null {
  const origin = request.headers.get("origin");
  if (origin) {
    if (isAllowedOrigin(origin, request, env)) return null;
    return forbidden();
  }
  const site = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (!site || site === "same-origin" || site === "none") return null;
  return forbidden();
}

function isAllowedOrigin(origin: string, request: Request, env: Env): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false; // "null" 같은 불투명 출처 포함
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.host.toLowerCase();
  // 요청을 받은 서버 자신의 주소(Host 헤더 또는 요청 URL)와 같으면 같은 사이트다.
  const ownHosts = [hostOf(request.headers.get("host")), hostOf(request.url)];
  if (ownHosts.includes(host)) return true;
  // 운영 주소와 Vercel 배포(미리보기·브랜치·운영) 주소는 https만 허용한다.
  if (parsed.protocol === "https:") {
    const deployed = [PRODUCTION_ORIGIN, env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL].map(hostOf);
    if (deployed.includes(host)) return true;
  }
  // 개발 중(NODE_ENV가 production이 아님)에는 localhost의 다른 포트도 허용한다.
  return env.NODE_ENV !== "production" && LOCAL_HOSTNAMES.has(parsed.hostname.toLowerCase());
}

function forbidden(): RequestGuardFailure {
  return {
    status: 403,
    code: "forbidden_origin",
    message: "다른 사이트에서 보낸 요청은 처리하지 않습니다. 사주 서비스 화면에서 다시 시도해 주세요.",
  };
}

/** 요청 수 제한에 쓰는 이용자 구분 값. 프록시가 붙인 첫 번째 IP, 없으면 x-real-ip, 둘 다 없으면 공통 값. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim();
  return ip ? ip.slice(0, 64).toLowerCase() : "unknown";
}

type LimiterOptions = { limit: number; windowMs: number; maxKeys?: number; now?: () => number };

/** 키별로 최근 windowMs 동안 허용한 요청 시각을 기억하는 슬라이딩 윈도 제한기. 메모리는 maxKeys × limit개로 제한된다. */
export class SlidingWindowLimiter {
  readonly limit: number;
  readonly windowMs: number;
  private readonly maxKeys: number;
  private readonly now: () => number;
  private readonly hits = new Map<string, number[]>();
  private lastSweep = 0;

  constructor(options: LimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.maxKeys = options.maxKeys ?? 5_000;
    this.now = options.now ?? Date.now;
  }

  /** 지금 요청을 받으면 한도를 넘는지 확인한다. 넘으면 다시 시도할 수 있을 때까지 남은 ms, 아니면 0. 기록은 하지 않는다. */
  retryAfterMs(key: string, at = this.now()): number {
    const recent = this.recent(key, at);
    if (recent.length < this.limit) return 0;
    return Math.max(1, recent[recent.length - this.limit] + this.windowMs - at);
  }

  /** 요청 하나를 기록한다. */
  record(key: string, at = this.now()): void {
    const recent = this.recent(key, at);
    recent.push(at);
    if (recent.length > this.limit) recent.splice(0, recent.length - this.limit);
    this.hits.delete(key); // 최근에 쓴 키를 Map의 맨 뒤로 옮긴다.
    this.hits.set(key, recent);
    this.prune(at);
  }

  /** 테스트·점검용: 지금 기억하고 있는 키 수. */
  get size(): number {
    return this.hits.size;
  }

  private recent(key: string, at: number): number[] {
    const list = this.hits.get(key);
    if (!list) return [];
    const cutoff = at - this.windowMs;
    let start = 0;
    while (start < list.length && list[start] <= cutoff) start++;
    if (start > 0) list.splice(0, start);
    if (list.length === 0) this.hits.delete(key);
    return list;
  }

  private prune(at: number): void {
    if (at - this.lastSweep >= this.windowMs || this.hits.size > this.maxKeys) {
      this.lastSweep = at;
      const cutoff = at - this.windowMs;
      for (const [key, list] of this.hits) {
        if (list.length === 0 || list[list.length - 1] <= cutoff) this.hits.delete(key);
      }
    }
    // 그래도 너무 많으면 가장 오래 쓰지 않은 키부터 지운다.
    while (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest === undefined) break;
      this.hits.delete(oldest);
    }
  }
}

/** 앞뒤 공백을 뺀 값이 1 이상의 10진 정수(`^[1-9][0-9]*$`)일 때만 쓴다. `1e1`·`0x10`·`5.0` 등은 기본값, 상한을 넘으면 상한으로 줄인다. */
function positiveInt(value: string | undefined, fallback: number, max: number): number {
  const text = value?.trim();
  if (!text || !/^[1-9][0-9]*$/.test(text)) return fallback;
  return Math.min(Number(text), max);
}

export type AiRouteName = "reading" | "consultation";

const DEFAULTS: Record<AiRouteName, { perIp: number; global: number }> = {
  reading: { perIp: 6, global: 60 },
  consultation: { perIp: 3, global: 20 },
};

export type AiRateLimitConfig = { windowMs: number; perIp: number; global: number };

/** 환경변수에서 제한값을 읽는다. 값이 없거나 1 이상의 10진 정수가 아니면 기본값, 상한(창 86,400초·IP 10,000·전체 100,000)을 넘으면 상한을 쓴다. */
export function aiRateLimitConfig(route: AiRouteName, env: Env): AiRateLimitConfig {
  const prefix = route === "reading" ? "READING" : "CONSULTATION";
  return {
    windowMs: positiveInt(env.AI_RATE_LIMIT_WINDOW_SECONDS, 600, 86_400) * 1000,
    perIp: positiveInt(env[`${prefix}_RATE_LIMIT_PER_IP`], DEFAULTS[route].perIp, 10_000),
    global: positiveInt(env[`${prefix}_RATE_LIMIT_GLOBAL`], DEFAULTS[route].global, 100_000),
  };
}

export type AiRateLimiter = {
  config: AiRateLimitConfig;
  /** 한도 안이면 요청을 기록하고 null, 넘으면 기록 없이 429 실패를 돌려준다. */
  take(request: Request): RequestGuardFailure | null;
};

/** IP별 제한과 서버 인스턴스 전체 제한을 함께 적용하는 제한기를 만든다. 라우트 모듈에서 한 번 만들어 재사용한다. */
export function createAiRateLimiter(route: AiRouteName, env: Env, now: () => number = Date.now): AiRateLimiter {
  const config = aiRateLimitConfig(route, env);
  const perIp = new SlidingWindowLimiter({ limit: config.perIp, windowMs: config.windowMs, now });
  const global = new SlidingWindowLimiter({ limit: config.global, windowMs: config.windowMs, maxKeys: 1, now });
  return {
    config,
    take(request) {
      const at = now();
      const key = clientKey(request);
      const waitMs = Math.max(perIp.retryAfterMs(key, at), global.retryAfterMs("all", at));
      if (waitMs > 0) {
        const retryAfterSeconds = Math.max(1, Math.ceil(waitMs / 1000));
        const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
        return {
          status: 429,
          code: "too_many_requests",
          message: `요청이 많아 잠시 쉬어 갑니다. ${minutes}분 뒤에 다시 시도해 주세요.`,
          retryAfterSeconds,
        };
      }
      perIp.record(key, at);
      global.record("all", at);
      return null;
    },
  };
}

/** 막힌 요청의 JSON 응답. 429에는 Retry-After(초) 헤더를 붙인다. */
export function guardFailureResponse(failure: RequestGuardFailure): Response {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (failure.retryAfterSeconds !== undefined) headers["Retry-After"] = String(failure.retryAfterSeconds);
  return NextResponse.json({
    error: {
      code: failure.code,
      message: failure.message,
      ...(failure.retryAfterSeconds !== undefined ? { retryAfterSeconds: failure.retryAfterSeconds } : {}),
    },
  }, { status: failure.status, headers });
}
