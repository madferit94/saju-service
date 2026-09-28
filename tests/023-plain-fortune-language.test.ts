import test from "node:test";
import assert from "node:assert/strict";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { analyzeFlow } from "../lib/saju/fortune";

const birth: SajuInput = {
  date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general",
};

const jargon = /확인된 결합|천간합|지지육합|지지충|지장간|[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]{2}/u;

test("이용자가 먼저 읽는 오늘의 운세는 기술 용어와 간지 나열 없이 완전한 문장이다", () => {
  const births = [birth, { ...birth, date: "1994-12-15" }, { ...birth, date: "2001-08-19" }];
  const days = ["甲子", "己丑", "丙午", "辛酉", "癸亥"];

  for (const input of births) {
    const chart = calculate(input);
    for (const ganji of days) {
      const flow = analyzeFlow(chart, ganji, "오늘");
      for (const [field, sentence] of Object.entries({
        opportunity: flow.opportunity, risk: flow.risk, action: flow.action, question: flow.question,
      })) {
        assert.ok(sentence.length >= 20, `${input.date} ${ganji} ${field}: 풀이가 비어 있습니다`);
        assert.doesNotMatch(sentence, jargon, `${input.date} ${ganji} ${field}: 계산 용어가 본문에 노출됩니다`);
        assert.doesNotMatch(sentence, /undefined|NaN|:\s*(?:$|[.。])|\.\s*\./u, `${input.date} ${ganji} ${field}: 문장이 깨졌습니다`);
        assert.match(sentence, /[.?!]$/u, `${input.date} ${ganji} ${field}: 문장이 끝나지 않았습니다`);
      }
    }
  }
});

test("합과 충은 쉬운 본문에 생활 영역으로 나타나고 자세한 근거에는 실제 간지가 남는다", () => {
  const flow = analyzeFlow(calculate(birth), "己丑", "오늘", [
    { label: "검증 세운", ganji: "甲子" },
    { label: "검증 대운", ganji: "癸未" },
  ]);

  assert.match(flow.opportunity, /함께할 일|역할/u);
  assert.match(flow.risk, /기존에 합의한 방식|변화/u);
  assert.doesNotMatch(flow.opportunity + flow.risk + flow.action, jargon);
  const stemSupport = flow.evidence.find((line) => line.includes("검증 세운") && line.includes("천간합"));
  const branchSupport = flow.evidence.find((line) => line.includes("검증 세운") && line.includes("지지육합"));
  const clash = flow.evidence.find((line) => line.includes("검증 대운") && line.includes("지지충"));
  for (const [relation, line] of [["천간합", stemSupport], ["지지육합", branchSupport], ["지지충", clash]] as const) {
    assert.ok(line, `${relation}의 계산 근거가 필요합니다`);
    assert.match(line, /己丑\(기축\)/u);
    assert.match(line, relation === "지지충" ? /癸未\(계미\)/u : /甲子\(갑자\)/u);
    assert.match(line, /[가-힣].*[.?!]$/u, `${relation}: 쉬운 뜻을 함께 설명해야 합니다`);
  }
});
