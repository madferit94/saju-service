import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LifeGraphPanel from "../app/life-graph-panel";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { buildLifeGraph } from "../lib/saju/life-graph";
import { LIFE_NOTE_LIMIT, lifeNotePeriodKey, lifeNoteStorageKey, readLifeNotes, writeLifeNotes } from "../lib/saju/life-notes";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  raw(key: string) { return this.values.get(key); }
}

const birth: SajuInput = { date: "1990-01-01", time: "08:37", calendar: "solar", topic: "general" };
const storage = () => new MemoryStorage() as unknown as Storage;

test("출생지 필드 순서가 달라도 같은 메모를 읽고, 다른 장소는 분리한다", () => {
  const target = storage();
  const first = {
    countryCode: "KR", countryName: "대한민국", city: "서울", province: "서울특별시",
    timezone: "Asia/Seoul", longitude: 126.978,
  };
  const reordered = {
    longitude: 126.978, timezone: "Asia/Seoul", province: "서울특별시",
    city: "서울", countryName: "대한민국", countryCode: "KR",
  };
  const key = lifeNoteStorageKey({ ...birth, birthplace: first }, 0);
  assert.equal(key, lifeNoteStorageKey({ ...birth, birthplace: reordered }, 0));
  assert.notEqual(key, lifeNoteStorageKey({ ...birth, birthplace: { ...first, city: "부산" } }, 0));
  assert.equal(writeLifeNotes(key, { "0:2000:2009": "서울에서 학교에 다녔다" }, target), true);
  assert.equal(readLifeNotes(lifeNoteStorageKey({ ...birth, birthplace: reordered }, 0), target).notes["0:2000:2009"], "서울에서 학교에 다녔다");
});

test("같은 사주의 메모는 다시 읽고, 다른 출생 정보·대운 방향과 분리된다", () => {
  const target = storage();
  const key = lifeNoteStorageKey(birth, 0);
  const otherBirth = lifeNoteStorageKey({ ...birth, date: "1990-01-02" }, 0);
  const otherDirection = lifeNoteStorageKey(birth, 1);
  const periodKey = lifeNotePeriodKey({ index: 2, startYear: 2020, endYear: 2029 });
  assert.notEqual(key, otherBirth);
  assert.notEqual(key, otherDirection);
  assert.equal(periodKey, "2:2020:2029");
  assert.equal(writeLifeNotes(key, { [periodKey]: "새로운 일을 배웠다" }, target), true);
  assert.deepEqual(readLifeNotes(key, target), { notes: { [periodKey]: "새로운 일을 배웠다" }, error: false });
  assert.deepEqual(readLifeNotes(otherBirth, target), { notes: {}, error: false });
  assert.deepEqual(readLifeNotes(otherDirection, target), { notes: {}, error: false });
  assert.equal(writeLifeNotes(key, { [periodKey]: "직장을 옮겼다" }, target), true);
  assert.equal(readLifeNotes(key, target).notes[periodKey], "직장을 옮겼다");
  assert.equal(writeLifeNotes(key, {}, target), true);
  assert.deepEqual(readLifeNotes(key, target), { notes: {}, error: false });
  assert.equal(target.raw(key), undefined);
});

test("빈 메모, 길이 초과, 잘못된 구간은 저장을 거부하고 기존 값을 보존한다", () => {
  const target = storage();
  const key = lifeNoteStorageKey(birth, 0);
  const valid = { "0:2000:2009": "일을 시작했다" };
  assert.equal(writeLifeNotes(key, valid, target), true);
  const invalidNotes: Record<string, string>[] = [
    { "0:2000:2009": "  " },
    { "0:2000:2009": "가".repeat(LIFE_NOTE_LIMIT + 1) },
    { "not-a-period": "메모" },
  ];
  for (const invalid of invalidNotes) {
    assert.equal(writeLifeNotes(key, invalid, target), false);
    assert.deepEqual(readLifeNotes(key, target).notes, valid);
  }
  assert.equal(writeLifeNotes(key, { "0:2000:2009": "가".repeat(LIFE_NOTE_LIMIT) }, target), true);
});

test("저장소가 막히거나 손상되어도 실패 상태를 알리고 페이지를 중단하지 않는다", () => {
  const key = lifeNoteStorageKey(birth, 0);
  const broken = {
    getItem() { throw new Error("storage denied"); },
    setItem() { throw new Error("quota exceeded"); },
    removeItem() { throw new Error("storage denied"); },
  } as unknown as Storage;
  assert.deepEqual(readLifeNotes(key, broken), { notes: {}, error: true });
  assert.equal(writeLifeNotes(key, { "0:2000:2009": "메모" }, broken), false);
  assert.equal(writeLifeNotes(key, {}, broken), false);

  const target = storage();
  target.setItem(key, "{");
  assert.deepEqual(readLifeNotes(key, target), { notes: {}, error: true });
  target.setItem(key, JSON.stringify(["메모"]));
  assert.deepEqual(readLifeNotes(key, target), { notes: {}, error: true });
  target.setItem(key, JSON.stringify({ "0:2000:2009": "유효", "1:2010:2019": "  ", invalid: "제외", "2:2020:2029": "가".repeat(LIFE_NOTE_LIMIT + 1) }));
  assert.deepEqual(readLifeNotes(key, target), { notes: { "0:2000:2009": "유효" }, error: false });
});

test("그래프에는 시기별 입력란과 브라우저 보관 안내가 별도로 표시된다", () => {
  const report = buildLifeGraph(calculate(birth), calculateDaewoon(birth, 0, 2026));
  const html = renderToStaticMarkup(createElement(LifeGraphPanel, { report, noteStorageKey: lifeNoteStorageKey(birth, 0) }));
  assert.match(html, /내 경험 한 줄 적기/);
  assert.match(html, /이 브라우저에만 저장되며 계정이나 AI로 보내지지 않습니다/);
  const pastAndCurrent = report.periods.filter((period) => period.startYear <= report.currentYear).length;
  const future = report.periods.filter((period) => period.startYear > report.currentYear).length;
  assert.equal((html.match(/내가 겪은 일 한 줄/g) ?? []).length, pastAndCurrent);
  assert.equal((html.match(/앞으로의 생각 한 줄/g) ?? []).length, future);
  assert.equal((html.match(/maxLength="120"/g) ?? []).length, report.periods.length);
  assert.equal((html.match(/<button type="button">저장<\/button>/g) ?? []).length, report.periods.length);
});
