import lunar from "lunar-javascript";
import type { SajuChart } from "./chart";
import type { DaewoonTimeline } from "./daewoon";
import { buildLifeDomains } from "./fortune-domains";

const stems = [..."甲乙丙丁戊己庚辛壬癸"];
const branches = [..."子丑寅卯辰巳午未申酉戌亥"];
const stemKo = [..."갑을병정무기경신임계"];
const branchKo = [..."자축인묘진사오미신유술해"];
const hidden: Record<string, string[]> = {
  子: ["癸"], 丑: ["己", "癸", "辛"], 寅: ["甲", "丙", "戊"], 卯: ["乙"],
  辰: ["戊", "乙", "癸"], 巳: ["丙", "庚", "戊"], 午: ["丁", "己"], 未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"], 酉: ["辛"], 戌: ["戊", "辛", "丁"], 亥: ["壬", "甲"],
};
const stemPairs = ["甲己", "乙庚", "丙辛", "丁壬", "戊癸"];
const branchPairs = ["子丑", "寅亥", "卯戌", "辰酉", "巳申", "午未"];
const clashes = ["子午", "丑未", "寅申", "卯酉", "辰戌", "巳亥"];
const roles: Record<string, string> = {
  년주: "집안·오래된 관계", 월주: "일터·사회적 역할", 일주: "나의 생활·가까운 관계", 시주: "장기 계획·다음 세대",
};

export function koreanGanji(ganji: string): string {
  return (stemKo[stems.indexOf(ganji[0])] ?? "") + (branchKo[branches.indexOf(ganji[1])] ?? "");
}

export function tenGod(dayStem: string, otherStem: string): string {
  const a = stems.indexOf(dayStem), b = stems.indexOf(otherStem);
  if (a < 0 || b < 0) throw new Error("십성 계산에 사용할 천간이 올바르지 않습니다.");
  const same = a % 2 === b % 2;
  const distance = (Math.floor(b / 2) - Math.floor(a / 2) + 5) % 5;
  return [
    same ? "비견" : "겁재", same ? "식신" : "상관", same ? "편재" : "정재",
    same ? "편관" : "정관", same ? "편인" : "정인",
  ][distance];
}

const meanings: Record<string, { meaning: string; opportunity: string; risk: string; action: string }> = {
  비견: { meaning: "자기 주도와 동료·경쟁", opportunity: "혼자 책임질 수 있는 영역을 확보하고 동료와 전문성을 나누는 방식", risk: "같은 역할을 두 사람이 맡으면서 결정권과 보상 기준을 두고 부딪히는 상황", action: "공동으로 하는 일은 결정권자·기여 범위·보상 기준을 시작 전에 문서로 합의하세요." },
  겁재: { meaning: "경쟁과 공동 자원의 분배", opportunity: "경쟁 상대의 방법을 배우거나 여러 사람의 힘으로 혼자 못 할 일을 진행하는 방식", risk: "친분 때문에 비용을 대신 부담하거나 공동 성과의 몫이 불분명해지는 상황", action: "친분과 비용 부담을 구분하고 공동 지출은 개인별 한도와 정산일을 정하세요." },
  식신: { meaning: "꾸준한 생산과 숙련", opportunity: "반복 가능한 기술·글·제품을 완성하고 실제 결과물로 신뢰를 얻는 방식", risk: "완성도를 계속 높이느라 납기와 체력을 소모하고 수요 확인을 미루는 상황", action: "작은 결과물을 정기적으로 내고 반응·소요 시간·유지 비용을 함께 기록하세요." },
  상관: { meaning: "표현과 기존 규칙의 재검토", opportunity: "기존 방식의 비효율을 발견해 제안·발표·창작으로 개선안을 보여주는 방식", risk: "내용은 옳아도 전달 방식 때문에 상사·고객·가까운 사람과 마찰이 생기는 상황", action: "문제 제기에는 관찰한 사실, 대안, 시험할 기간을 함께 제시하고 상대의 결정권을 확인하세요." },
  편재: { meaning: "외부 기회와 자원 운용", opportunity: "새 고객·거래·프로젝트를 탐색하고 인맥을 실제 협업으로 연결하는 방식", risk: "보이는 기회가 많아 일정·현금·관계 관리가 분산되는 상황", action: "새 제안을 받을 때 초기 비용, 회수 시점, 중단 조건을 먼저 적고 작은 규모로 검증하세요." },
  정재: { meaning: "꾸준한 수입과 생활 자원 관리", opportunity: "정기적인 수입·역할·거래를 안정적으로 운영하며 신뢰를 쌓는 방식", risk: "확실한 것만 지키려다 조건을 재협상할 때를 놓치거나 생활 책임을 혼자 떠안는 상황", action: "반복 지출과 맡은 일을 정리하고, 보상에 비해 늘어난 책임은 구체적인 수치로 조정하세요." },
  편관: { meaning: "압박 속 실행과 어려운 책임", opportunity: "기한과 기준이 분명한 어려운 과제를 해결하며 역량을 드러내는 방식", risk: "성과 압박을 혼자 견디거나 급한 결정으로 감당할 범위를 넘기는 상황", action: "권한·지원 인력·마감 조정 가능성을 확인한 뒤 책임을 맡고, 중단할 조건을 미리 정하세요." },
  정관: { meaning: "규칙·평가·공적 책임", opportunity: "자격·신뢰·역할의 기준을 갖추고 조직이나 고객에게 일관된 평가를 받는 방식", risk: "평가 기준을 지나치게 의식해 필요한 이견도 말하지 못하고 책임만 늘어나는 상황", action: "평가 항목과 실제 권한을 확인하고, 맡은 업무와 제외할 업무를 구체적으로 합의하세요." },
  편인: { meaning: "탐구와 독자적인 관점", opportunity: "새 방법을 연구하고 익숙한 문제를 다른 관점으로 재설계하는 방식", risk: "정보를 계속 모으면서 실행과 피드백을 미루거나 혼자만 이해하는 방식에 머무는 상황", action: "조사 기간에 끝을 정하고 배운 내용을 한 사람에게 설명하거나 작은 실험으로 검증하세요." },
  정인: { meaning: "배움·지원·정리된 기반", opportunity: "체계적인 학습과 조언을 받아 자격·문서·기본기를 갖추는 방식", risk: "준비가 충분해야 움직일 수 있다고 느끼거나 조력자의 기준에 지나치게 의존하는 상황", action: "도움받을 부분과 스스로 결정할 부분을 나누고, 학습한 내용을 실제 결과물 하나로 옮기세요." },
};

export type FlowAnalysis = {
  label: string; ganji: string; korean: string; stemGod: string;
  hiddenStems: { stem: string; korean: string; god: string }[];
  evidence: string[]; opportunity: string; risk: string; action: string; question: string;
};

function pairExists(pairs: string[], a: string, b: string): boolean {
  return pairs.some((pair) => pair === a + b || pair === b + a);
}

function interactions(ganji: string, target: { label: string; ganji: string }): string[] {
  const result: string[] = [];
  const area = roles[target.label] ? " · " + roles[target.label] : "";
  const reference = target.label + " " + target.ganji + "(" + koreanGanji(target.ganji) + ")";
  if (pairExists(stemPairs, ganji[0], target.ganji[0])) result.push(reference + " 사이의 천간합: 관심과 역할이 묶이는 관계" + area);
  if (pairExists(branchPairs, ganji[1], target.ganji[1])) result.push(reference + " 사이의 지지육합: 연결과 조율을 살피는 관계" + area);
  if (pairExists(clashes, ganji[1], target.ganji[1])) result.push(reference + " 사이의 지지충: 기존 방식과 새 조건의 마찰을 살피는 관계" + area);
  if (ganji[1] === target.ganji[1]) result.push(reference + " 사이의 같은 지지 반복: 해당 생활 주제를 다시 점검" + area);
  return result;
}

export function analyzeFlow(chart: SajuChart, ganji: string, label: string, extra: { label: string; ganji: string }[] = []): FlowAnalysis {
  const stemGod = tenGod(chart.dayMaster.character, ganji[0]);
  const info = meanings[stemGod];
  const hiddenStems = (hidden[ganji[1]] ?? []).map((stem) => ({
    stem, korean: stemKo[stems.indexOf(stem)], god: tenGod(chart.dayMaster.character, stem),
  }));
  const branchGod = hiddenStems[0]?.god ?? stemGod;
  const branchInfo = meanings[branchGod];
  const contacts = [...chart.pillars.map((p) => ({ label: p.label, ganji: p.text })), ...extra]
    .flatMap((target) => interactions(ganji, target));
  const tension = contacts.filter((item) => item.includes("지지충"));
  const support = contacts.filter((item) => item.includes("합:"));
  return {
    label, ganji, korean: koreanGanji(ganji), stemGod, hiddenStems,
    evidence: [
      ganji + "(" + koreanGanji(ganji) + ")의 천간은 일간 " + chart.dayMaster.character + "(" + chart.dayMaster.korean + ")에 " + stemGod + "(" + info.meaning + ")",
      "지지 " + ganji[1] + "(" + branchKo[branches.indexOf(ganji[1])] + ")의 지장간: " + hiddenStems.map((x) => x.stem + "(" + x.korean + "·" + x.god + ")").join(", "),
      ...contacts,
    ],
    opportunity: label + "에는 " + info.opportunity + "을 활용점으로 읽습니다. " +
      (stemGod === branchGod ? "천간과 지지의 주된 십성이 같아 이 주제가 반복됩니다." :
        "겉으로 드러나는 " + stemGod + "의 작용과 생활 바탕의 " + branchGod + "(" + branchInfo.meaning + ")을 함께 다뤄야 합니다.") +
      (support.length ? " 확인된 결합은 다음과 같습니다: " + support[0] + ". 협력 조건을 먼저 확인해 보세요." : ""),
    risk: info.risk + "을 점검할 필요가 있습니다. " +
      (tension.length ? tension.join(" / ") + ". 합의했던 역할이나 생활 방식이 아직 맞는지 구체적으로 확인하세요." :
        branchGod !== stemGod ? "동시에 " + branchInfo.risk + "도 살펴보세요." : "이 방식이 잘 맞더라도 맡을 수 있는 범위를 넘기는지 확인하세요."),
    action: info.action + (tension.length ? " 변화가 필요하다면 한 번에 전부 바꾸기보다 시험 기간과 되돌릴 기준부터 마련하세요." : ""),
    question: "실제로 " + info.risk + "이 있었나요? 있었던 시기와 없었던 시기의 환경 차이를 기록해 보세요.",
  };
}

const termKeys = ["小寒", "立春", "惊蛰", "清明", "立夏", "芒种", "小暑", "立秋", "白露", "寒露", "立冬", "大雪", "XIAO_HAN"];
const termNames = ["소한", "입춘", "경칩", "청명", "입하", "망종", "소서", "입추", "백로", "한로", "입동", "대설"];
const instant = (value: { toYmdHms(): string }) => value.toYmdHms().replace(" ", "T") + "+08:00";

export function forLifeStage(flow: FlowAnalysis, age: number): FlowAnalysis {
  if (age >= 20) return flow;
  return {
    ...flow,
    opportunity: flow.label + "에는 " + flow.evidence[0] + ". " + (age <= 7 ? "이 시기에는 보호자와의 관계, 일상의 규칙, 놀이와 적응 환경을 중심으로 읽습니다." : "이 시기에는 학교·배움·또래 관계에서 어떤 역할을 맡았는지와 연결해 읽습니다."),
    risk: age <= 7 ? "어른의 기대를 아이의 성취 기준으로 옮겨오지 않는 것이 중요합니다. 낯선 환경이나 일과가 바뀔 때 적응할 시간과 보호자의 지원을 확인하세요." : "성적과 또래 비교가 커질 때 본인의 학습 속도나 휴식이 밀리는지 살펴보세요. 재성·관성도 이 연령에는 거래나 직장이 아닌 생활 자원과 규칙의 관계로 읽습니다.",
    action: age <= 7 ? "보호자가 생활·놀이의 변화를 기록하고 아이가 편안해하는 환경과 어려워하는 환경을 비교해 보세요." : "잘 맞았던 공부 방식 하나와 부담이 된 비교 상황 하나를 적어, 배우는 방법이나 도움 요청 방식을 조정해 보세요.",
    question: "이 시기의 가정·학교·또래 환경에서 실제로 달라진 것은 무엇이었나요?",
  };
}

export function buildFortuneReport(chart: SajuChart, timeline: DaewoonTimeline, year = timeline.currentYear) {
  if (!Number.isInteger(year) || year < 1990 || year > 2100) throw new Error("운세 연도는 1990~2100년을 선택해주세요.");
  const table = lunar.Solar.fromYmdHms(year, 6, 15, 12, 0, 0).getLunar().getJieQiTable();
  const annualGanji = lunar.Solar.fromYmdHms(year, 6, 15, 12, 0, 0).getLunar().getEightChar().getYear();
  const active = timeline.periods.find((p) => p.startYear <= year && year <= p.endYear);
  const first = timeline.periods[0];
  const birthYear = first.startYear - first.startAge + 1;
  const age = year - birthYear + 1;
  const major = active?.ganji ? [{ label: "해당 연도 대운", ganji: active.ganji }] : [];
  const annual = {
    ...forLifeStage(analyzeFlow(chart, annualGanji, year + "년 세운", major), age),
    startAt: instant(table["立春"]), endAt: instant(table["LI_CHUN"]),
    daewoon: active ? active.startYear + "–" + active.endYear + "년 " + (active.korean || "대운 시작 전") : "표시 범위 밖",
  };
  const months = termNames.map((name, index) => {
    const start = table[termKeys[index]], end = table[termKeys[index + 1]];
    // The library's solar-term clocks are UTC+8. Sample safely inside the interval, not on its boundary.
    const middle = new Date((Date.parse(instant(start)) + Date.parse(instant(end))) / 2 + 8 * 3600_000);
    const eight = lunar.Solar.fromYmdHms(middle.getUTCFullYear(), middle.getUTCMonth() + 1, middle.getUTCDate(), middle.getUTCHours(), middle.getUTCMinutes(), 0).getLunar().getEightChar();
    return {
      ...forLifeStage(analyzeFlow(chart, eight.getMonth(), (index + 1) + "월 " + name + " 절입 이후", [...major, { label: "해당 월 세운", ganji: eight.getYear() }]), age),
      daewoonGanji: active?.ganji ?? "", annualGanji: eight.getYear(),
      month: index + 1, startAt: instant(start), endAt: instant(end),
    };
  });
  const natalHidden = chart.pillars.map((p) => ({
    label: p.label, branch: p.branch, korean: p.korean[1],
    stems: hidden[p.branch].map((stem) => ({ stem, korean: stemKo[stems.indexOf(stem)], god: tenGod(chart.dayMaster.character, stem) })),
  }));
  const natalContacts = chart.pillars.flatMap((p, index) => chart.pillars.slice(index + 1)
    .flatMap((other) => interactions(p.text, { label: other.label, ganji: other.text }).map((line) => p.label + " " + p.text + "(" + p.korean + ") ↔ " + line)));
  const lifetime = [
    { label: "초년 · 배움과 생활 기반", min: 1, max: 19 },
    { label: "청년 · 선택과 독립", min: 20, max: 39 },
    { label: "중년 · 축적과 역할 조정", min: 40, max: 59 },
    { label: "후반 · 경험의 활용과 생활 재설계", min: 60, max: 100 },
  ].map((stage) => {
    const periods = timeline.periods.filter((p) => p.endAge >= stage.min && p.startAge <= stage.max).map((p) => {
      const startAge = Math.max(stage.min, p.startAge), endAge = Math.min(stage.max, p.endAge);
      const flow = p.ganji ? forLifeStage(analyzeFlow(chart, p.ganji, p.korean + " 대운"), endAge) : null;
      return {
        ...flow, index: p.index, ganji: p.ganji, korean: p.korean,
        startAge, endAge, startYear: p.startYear + startAge - p.startAge, endYear: p.endYear - (p.endAge - endAge),
        summary: !flow ? "대운 시작 전입니다. 타고난 네 기둥과 양육·배움 환경을 중심으로 읽는 구간입니다." :
          stage.max <= 19 ? flow.evidence[0] + ". 이 시기에는 이를 실제 직업이나 재산으로 해석하지 않고, 배움의 방식·또래 관계·가정에서 맡은 역할과 비교합니다." :
          flow.opportunity + " " + flow.action,
      };
    });
    return { label: stage.label, range: stage.min + "–" + stage.max + "세", periods };
  });
  const dominant = annual.stemGod;
  const natalMonthGod = natalHidden[1].stems[0].god;
  return {
    version: 2 as const, year,
    natal: { hiddenStems: natalHidden, contacts: natalContacts, monthGod: natalMonthGod },
    annual, months, lifetime,
    synthesis: "타고난 월지 " + chart.pillars[1].branch + "(" + chart.pillars[1].korean[1] + ")의 주된 지장간은 " + natalMonthGod +
      "(" + meanings[natalMonthGod].meaning + ")으로 읽습니다. " + year + "년에는 " + annual.ganji + "(" + annual.korean + ")의 " +
      dominant + "(" + meanings[dominant].meaning + ")이 겹칩니다. " +
      (dominant === natalMonthGod ? "평소 익숙한 삶의 방식을 다시 활용할 시기라는 관점입니다. 익숙함이 과해질 때의 부담도 함께 봐야 합니다." :
        "평소의 주제인 ‘" + meanings[natalMonthGod].meaning + "’와 올해의 주제인 ‘" + meanings[dominant].meaning + "’ 사이에서 우선순위를 정하는 것이 해석의 핵심입니다.") +
      " 큰 배경은 " + annual.daewoon + "이며, 아래 월운에서 같은 주제가 반복되거나 합·충으로 조정이 필요한 구간을 확인할 수 있습니다.",
    domains: buildLifeDomains(chart, annual, year, age, natalHidden, tenGod),
    method: "십성·지장간·천간합·지지육합·충을 함께 읽습니다. 합은 자동으로 다른 오행이 된다는 뜻이 아닙니다. 강약과 격국·용신 후보는 심층 분석에서 근거와 함께 살펴봅니다. 세운은 입춘, 월운은 절입 시각부터 적용하며 대운은 기존 연도 구간 기준입니다. 평생 흐름의 연령 구간은 화면을 읽기 위한 구분이며 수명 예측이 아닙니다.",
  };
}

export type FortuneReport = ReturnType<typeof buildFortuneReport>;
