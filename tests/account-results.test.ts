import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { calculateBenefactors } from "../lib/saju/benefactors";
import {
  MAX_PAYLOAD_BYTES, PAGE_SIZE, validateCloudPayload, validateTitle,
  resultFingerprint, listReadings, saveReading, loadReading, deleteReading,
  type CloudPayload,
} from "../lib/account/results";

function fixture(): CloudPayload {
  const input: SajuInput = { date: "2000-02-04", time: "08:37", calendar: "solar", topic: "general" };
  const chart = calculate(input);
  return { version: 1, fortuneYear: 2026, result: {
    version: 1, savedAt: "2026-09-23T05:00:00.000Z", input, yunGender: 0,
    chart, timeline: calculateDaewoon(input, 0, 2026), benefactors: calculateBenefactors(chart), reading: null,
  } };
}

type Reply = { data: unknown; error: { code?: string } | null };
type Call = { method: string; args: unknown[] };
function mockClient(replies: Reply[], userId: string | null = "owner-a", authError = false) {
  const queries: Call[][] = [];
  let authCalls = 0;
  const client = {
    auth: { async getUser() { authCalls++; return { data: { user: userId ? { id: userId } : null }, error: authError ? new Error("expired") : null }; } },
    from(table: string) {
      const calls: Call[] = [{ method: "from", args: [table] }];
      queries.push(calls);
      const reply = replies.shift();
      assert.ok(reply, "unexpected database request");
      const query: Record<string, unknown> = {};
      for (const method of ["select", "insert", "eq", "order", "range", "delete", "single", "maybeSingle"]) {
        query[method] = (...args: unknown[]) => { calls.push({ method, args }); return query; };
      }
      query.then = (resolve: (value: Reply) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(reply).then(resolve, reject);
      return query;
    },
  } as unknown as SupabaseClient;
  return { client, queries, get authCalls() { return authCalls; } };
}
const ok = (data: unknown): Reply => ({ data, error: null });
const fail = (code: string): Reply => ({ data: null, error: { code } });
const has = (calls: Call[], method: string, args: unknown[]) => calls.some(call => call.method === method && JSON.stringify(call.args) === JSON.stringify(args));

test("클라우드 저장은 정상 계산과 0번 없는 대운을 그대로 보존한다", () => {
  const payload = fixture();
  assert.equal(payload.result.timeline.periods[0].index, 1);
  assert.equal(validateCloudPayload(payload), payload);
  for (const fortuneYear of [1990, 2100]) assert.equal(validateCloudPayload({ ...payload, fortuneYear }).fortuneYear, fortuneYear);
});

test("손상된 버전·연도·원국·대운은 복원 전에 차단한다", () => {
  for (const bad of [null, [], {}, { ...fixture(), version: 2 }, ...[1989, 2101, 2026.5, "2026"].map(fortuneYear => ({ ...fixture(), fortuneYear }))]) {
    assert.throws(() => validateCloudPayload(bad));
  }
  const mutations = [
    (p: CloudPayload) => { p.result.chart.pillars[1].branch = "X"; },
    (p: CloudPayload) => { p.result.chart.pillars[1].korean = ""; },
    (p: CloudPayload) => { p.result.chart.pillars[1].stemElement = ""; },
    (p: CloudPayload) => { p.result.chart.dayMaster.character = "X"; },
    (p: CloudPayload) => { p.result.timeline.periods[1].startAge = Number.NaN; },
    (p: CloudPayload) => { p.result.timeline.periods[1].endYear = 1800; },
    (p: CloudPayload) => { p.result.timeline.periods[1].ganji = "??"; },
    (p: CloudPayload) => { p.result.timeline.periods[1].index += 1; },
  ];
  for (const mutate of mutations) { const payload = fixture(); mutate(payload); assert.throws(() => validateCloudPayload(payload)); }
});

test("문자 수가 아닌 UTF-8 바이트로 저장 크기를 제한한다", () => {
  const payload = fixture();
  payload.result.chart.method = "한".repeat(Math.ceil(MAX_PAYLOAD_BYTES / 3));
  assert.ok(JSON.stringify(payload).length < MAX_PAYLOAD_BYTES);
  assert.throws(() => validateCloudPayload(payload), /크기/);
});

test("제목 공백을 정리하고 1~80자의 한글·이모지를 허용한다", () => {
  assert.equal(validateTitle("  나의 사주  "), "나의 사주");
  assert.equal(validateTitle("🌙".repeat(80)), "🌙".repeat(80));
  for (const title of ["", " \n ", "한".repeat(81), "🌙".repeat(81)]) assert.throws(() => validateTitle(title));
});

test("저장 시각과 객체 키 순서만 달라진 결과는 중복으로 판단한다", async () => {
  const payload = fixture();
  const hash = await resultFingerprint(payload, "내 사주");
  assert.match(hash, /^[a-f0-9]{64}$/);
  const reordered = JSON.parse(JSON.stringify(payload, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) return Object.fromEntries(Object.entries(value).reverse());
    return value;
  })) as CloudPayload;
  reordered.result.savedAt = "2026-09-24T06:00:00.000Z";
  assert.equal(await resultFingerprint(reordered, "  내 사주  "), hash);
  assert.notEqual(await resultFingerprint(payload, "가족 사주"), hash);
  assert.notEqual(await resultFingerprint({ ...payload, fortuneYear: 2027 }, "내 사주"), hash);
  const changed = structuredClone(payload); changed.result.chart.method += " 다른 계산 기준";
  assert.notEqual(await resultFingerprint(changed, "내 사주"), hash);
});

test("로그아웃·계정 전환·인증 오류에서는 모든 DB 접근을 중단한다", async () => {
  for (const identity of [null, "owner-b", "auth-error"]) {
    const fake = mockClient([], identity, identity === "auth-error");
    await assert.rejects(listReadings(fake.client, "owner-a"), /로그인/);
    await assert.rejects(saveReading(fake.client, "owner-a", "내 사주", fixture()), /로그인/);
    await assert.rejects(loadReading(fake.client, "owner-a", "row-a"), /로그인/);
    await assert.rejects(deleteReading(fake.client, "owner-a", "row-a"), /로그인/);
    assert.equal(fake.queries.length, 0);
  }
});

test("목록은 본인 소유의 요약만 최신순으로 20개씩 요청한다", async () => {
  const summary = [{ id: "row-a", title: "내 사주", created_at: "2026-09-23T05:00:00Z" }];
  const fake = mockClient([ok(summary)]);
  assert.deepEqual(await listReadings(fake.client, "owner-a", 20), summary);
  const query = fake.queries[0];
  assert.ok(has(query, "select", ["id,title,created_at"]));
  assert.ok(has(query, "eq", ["user_id", "owner-a"]));
  assert.ok(has(query, "range", [20, 20 + PAGE_SIZE - 1]));
  assert.ok(has(query, "order", ["created_at", { ascending: false }]));
  assert.ok(has(query, "order", ["id", { ascending: false }]));
});

test("저장 성공 시 본인 ID와 전체 결과를 insert하고 덮어쓰지 않는다", async () => {
  const fake = mockClient([ok({ id: "row-a" })]);
  const payload = fixture(); const before = structuredClone(payload);
  assert.deepEqual(await saveReading(fake.client, "owner-a", "  내 사주  ", payload), { id: "row-a", duplicate: false });
  const inserted = fake.queries[0].find(call => call.method === "insert")!.args[0] as Record<string, unknown>;
  assert.equal(inserted.user_id, "owner-a"); assert.equal(inserted.title, "내 사주"); assert.equal(inserted.payload, payload);
  assert.match(inserted.fingerprint as string, /^[a-f0-9]{64}$/);
  assert.deepEqual(payload, before);
});

test("중복 저장은 기존 본인 결과 ID를 반환하며 다른 계정 결과는 찾지 않는다", async () => {
  const fake = mockClient([fail("23505"), ok({ id: "existing-a" })]);
  assert.deepEqual(await saveReading(fake.client, "owner-a", "내 사주", fixture()), { id: "existing-a", duplicate: true });
  assert.ok(has(fake.queries[1], "eq", ["user_id", "owner-a"]));
  const inserted = fake.queries[0].find(call => call.method === "insert")!.args[0] as Record<string, unknown>;
  assert.ok(has(fake.queries[1], "eq", ["fingerprint", inserted.fingerprint]));
});

test("저장 실패와 중복 확인 실패를 성공으로 바꾸지 않고 입력을 보존한다", async () => {
  const payload = fixture(); const before = structuredClone(payload);
  for (const replies of [[fail("42501")], [fail("23505"), fail("PGRST301")], [ok(null)]]) {
    const fake = mockClient(replies);
    await assert.rejects(saveReading(fake.client, "owner-a", "내 사주", payload));
    assert.deepEqual(payload, before);
  }
});

test("유효하지 않은 제목이나 결과는 DB에 전송하지 않는다", async () => {
  const fake = mockClient([]);
  await assert.rejects(saveReading(fake.client, "owner-a", " ", fixture()));
  await assert.rejects(saveReading(fake.client, "owner-a", "내 사주", { ...fixture(), fortuneYear: 1900.1 }));
  assert.equal(fake.queries.length, 0);
});

test("결과 열기는 본인 ID·결과 ID로 제한하고 검증된 전체 결과를 돌려준다", async () => {
  const payload = fixture(); const fake = mockClient([ok({ payload })]);
  assert.deepEqual(await loadReading(fake.client, "owner-a", "row-a"), payload);
  assert.ok(has(fake.queries[0], "eq", ["user_id", "owner-a"]));
  assert.ok(has(fake.queries[0], "eq", ["id", "row-a"]));
});

test("완성된 종합 해석의 버전·평생운·12개월과 다른 선택 연도를 손실 없이 보존한다", async () => {
  const payload = fixture();
  const text = "사주의 구체적인 근거를 실제 경험과 비교하는 해석입니다.";
  payload.result.reading = {
    readingVersion: 2, fortuneYear: 2026, synthesis: text, lifetime: text, annual: text,
    monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, reading: `${i + 1}월 ${text}` })),
    overview: text, elements: text, benefactors: text, career: text, relationships: text, money: text, caution: text,
    periodReadings: payload.result.timeline.periods.map(period => ({ index: period.index, theme: text, strengths: text, cautions: text, advice: text, reflection: text })),
  };
  // 이용자가 연도만 바꾸고 새 AI 해석은 생성하지 않은 상태도 기존 해석을 잃지 않는다.
  payload.fortuneYear = 2027;
  const fake = mockClient([ok({ id: "complete" }), ok({ payload: structuredClone(payload) })]);
  await saveReading(fake.client, "owner-a", "종합 해석", payload);
  const restored = await loadReading(fake.client, "owner-a", "complete");
  assert.deepEqual(restored, payload);
  assert.equal(restored.result.reading?.monthly?.length, 12);
  const changed = structuredClone(payload);
  changed.result.reading!.annual += " 새롭게 해석한 문장입니다.";
  assert.notEqual(await resultFingerprint(payload, "종합 해석"), await resultFingerprint(changed, "종합 해석"));
  changed.result.reading!.monthly!.pop();
  assert.throws(() => validateCloudPayload(changed));
});

test("삭제된 결과·손상된 문서·연결 실패는 빈 성공 결과로 복원하지 않는다", async () => {
  for (const reply of [ok(null), ok({ payload: { version: 2 } }), fail("42P01")]) {
    const fake = mockClient([reply]);
    await assert.rejects(loadReading(fake.client, "owner-a", "row-a"));
  }
  await assert.rejects(listReadings(mockClient([fail("PGRST205")]).client, "owner-a"), /준비 중/);
});

test("삭제는 본인 소유 단일 ID만 대상으로 하고 0건·권한 오류를 성공으로 보고하지 않는다", async () => {
  const fake = mockClient([ok([{ id: "row-a" }])]);
  await deleteReading(fake.client, "owner-a", "row-a");
  assert.ok(has(fake.queries[0], "eq", ["user_id", "owner-a"]));
  assert.ok(has(fake.queries[0], "eq", ["id", "row-a"]));
  for (const reply of [ok([]), fail("42501")]) {
    await assert.rejects(deleteReading(mockClient([reply]).client, "owner-a", "row-a"));
  }
});
