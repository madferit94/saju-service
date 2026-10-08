import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { buildDoryeongOneLine } from "../lib/saju/doryeong-one-line";

const base: SajuInput = { date: "2005-12-23", time: "08:37", calendar: "solar", topic: "general" };

test("실제 원국의 월지와 십성이 달라지면 등불 한줄평과 근거가 달라진다", () => {
  const winter = buildDoryeongOneLine(calculate(base));
  const summer = buildDoryeongOneLine(calculate({ ...base, date: "1999-06-07" }));
  const anotherWinter = buildDoryeongOneLine(calculate({ ...base, date: "1994-12-01" }));

  assert.match(winter.line, /쇠의 기운이 물의 달을 만났습니다/u);
  assert.match(winter.basis, /辛\(신·금\).*子\(자·수\).*戊\(무·정인\)/u);
  assert.match(summer.line, /쇠의 기운이 불의 달을 만났습니다/u);
  assert.match(summer.basis, /庚\(경·금\).*午\(오·화\).*庚\(경·비견\)/u);
  assert.notEqual(winter.line, summer.line);
  assert.notEqual(winter.basis, summer.basis);
  assert.notEqual(winter.line, anotherWinter.line, "일간과 월지의 오행이 같아도 월간 십성이 다르면 풀이가 달라야 합니다");
  assert.notEqual(winter.basis, anotherWinter.basis);
  assert.deepEqual(buildDoryeongOneLine(calculate(base)), winter, "같은 출생 정보에는 같은 풀이가 나와야 합니다");
});

test("한줄평은 완결된 짧은 문장이고 근거 없는 확정·전문가 이력을 말하지 않는다", () => {
  const dates = ["2005-12-23", "1999-06-07", "1994-12-01", "2024-02-04"];
  for (const date of dates) {
    const { line, basis } = buildDoryeongOneLine(calculate({ ...base, date }));
    assert.ok(line.length >= 25 && line.length <= 100, `${date}: 한줄평 길이가 적절해야 합니다`);
    assert.match(line, /[.?!]$/u);
    assert.doesNotMatch(line, /도령|하시오|만드시오|정하시오|내놓으시오|써보시오/u, "등불 안내는 존댓말을 사용해야 합니다");
    assert.match(line, /보세요\.$/u);
    assert.doesNotMatch(line, /(?:반드시|무조건|확정|대박|부자|합격|성공한다|용신|적중|전문가|경력|판정 보류|undefined|NaN)/u);
    assert.doesNotMatch(basis, /(?:반드시|무조건|확정|대박|부자|합격|성공한다|용신|적중|전문가|경력|undefined|NaN)/u);
    assert.match(basis, /태어난 날.*태어난 달/u);
  }
});

test("결과 맨 앞에서 원국으로 한줄평을 만들며 브라우저·계정 저장본에도 같은 계산 경로를 사용한다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  const oneLine = source.indexOf('aria-label="내 길을 비추는 한마디"');
  const manse = source.indexOf("<MansePanel chart={chart}");
  const daily = source.indexOf("<DailyFortunePanel chart={chart}");

  assert.ok(oneLine > 0 && oneLine < manse && manse < daily, "한줄평이 만세력과 오늘 운세보다 먼저 보여야 합니다");
  assert.match(source, /useMemo\(\(\) => chart \? buildDoryeongOneLine\(chart\) : null, \[chart\]\)/u);
  assert.match(source, /setChart\(saved\.chart\)/u, "브라우저 저장 원국을 같은 chart 상태로 복원해야 합니다");
  assert.match(source, /setChart\(payload\.result\.chart\)/u, "계정 저장 원국도 같은 chart 상태로 복원해야 합니다");
  assert.match(source, /doryeongOneLine\.basis/u, "사용한 사주 글자를 결과에 함께 보여야 합니다");
});
