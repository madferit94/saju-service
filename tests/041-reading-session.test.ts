import test from "node:test";
import assert from "node:assert/strict";
import { ReadingSession, readingSessionKey, READING_PROMPT_VERSION } from "../lib/saju/reading-session";
import { validateReadingSummary } from "../lib/saju/reading-summary";
import type { GeminiSajuReading } from "../lib/saju/gemini-reading";

const input = { date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general" } as const;
const summary = { synthesis: "이미 익힌 방법을 작은 활동에 적용해 보는 시기입니다.", current: "맡은 일과 도움받을 일을 함께 살펴보면 좋겠습니다.", action: "지금 할 수 있는 활동 하나를 적고 시간을 정해 보세요.", evidenceIds: ["strength_ratio", "annual_flow_balance"] };

test("캐시 키는 출생 시각·대운 기준·연도·프롬프트 버전이 달라지면 분리된다", () => {
  const key = readingSessionKey(input, 0, 2026);
  assert.equal(readingSessionKey({ ...input }, 0, 2026), key);
  assert.notEqual(readingSessionKey({ ...input, time: "09:37" }, 0, 2026), key);
  assert.notEqual(readingSessionKey(input, 1, 2026), key);
  assert.notEqual(readingSessionKey(input, 0, 2027), key);
  assert.equal(JSON.parse(key)[0], READING_PROMPT_VERSION);
  const session = new ReadingSession(); session.set(key, { summary });
  const oldKey = JSON.stringify(["previous-prompt-version", ...JSON.parse(key).slice(1)]);
  assert.equal(session.get(oldKey), undefined);
});

test("부분 성공을 합치고 다른 세션과 공유하지 않으며 로그아웃용 초기화로 비운다", () => {
  const session = new ReadingSession(), other = new ReadingSession();
  const key = readingSessionKey(input, 0, 2026);
  const reading = { readingVersion: 2, fortuneYear: 2026, synthesis: "전체 완료" } as GeminiSajuReading;
  session.set(key, { summary });
  session.set(key, { reading });
  assert.deepEqual(session.get(key), { summary, reading });
  assert.equal(other.get(key), undefined);
  session.clear();
  assert.equal(session.get(key), undefined);
});

test("세션 메모리는 오래된 결과를 버려 무제한으로 쌓이지 않는다", () => {
  const session = new ReadingSession();
  for (let year = 2000; year < 2010; year++) session.set(readingSessionKey(input, 0, year), { summary });
  assert.equal(session.get(readingSessionKey(input, 0, 2000)), undefined);
  assert.ok(session.get(readingSessionKey(input, 0, 2009)));
});

test("요약 근거는 중복·누락·위조를 거부하고 실제 계산 ID만 허용한다", () => {
  assert.deepEqual(validateReadingSummary(summary, summary.evidenceIds), summary);
  for (const evidenceIds of [["strength_ratio"], ["strength_ratio", "strength_ratio"], ["strength_ratio", "made_up"]]) {
    assert.throws(() => validateReadingSummary({ ...summary, evidenceIds }, summary.evidenceIds));
  }
  assert.throws(() => validateReadingSummary({ ...summary, synthesis: "짧음" }, summary.evidenceIds));
});
