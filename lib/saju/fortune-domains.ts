import type { SajuChart } from "./chart";
import type { FlowAnalysis } from "./fortune";

export type FortuneDomain = { id: string; title: string; body: string; interpretation: string; evidence: string[] };
type HiddenPillar = { label: string; stems: { stem: string; korean: string; god: string }[] };

function topicParticle(word: string): string {
  const last = word.codePointAt(word.length - 1) ?? 0;
  return last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0 ? "은" : "는";
}
function joinParticle(word: string): string { return topicParticle(word) === "은" ? "과" : "와"; }

const godMeaning: Record<string, string> = {
  비견: "자기 기준과 동료의 역할", 겁재: "경쟁과 공동 몫의 조정", 식신: "익힌 것을 꾸준히 결과로 만드는 방식",
  상관: "기존 규칙을 다시 보고 표현하는 방식", 편재: "외부 기회와 여러 자원의 운영", 정재: "정기적인 수입과 생활 자원의 관리",
  편관: "어려운 요구를 맡을 때의 책임", 정관: "규칙과 평가 기준에 따른 책임", 편인: "새 관점을 탐색하고 배우는 방식",
  정인: "배움과 지원을 받아 기반을 쌓는 방식",
};

export function buildLifeDomains(
  chart: SajuChart,
  annual: FlowAnalysis & { daewoon: string },
  year: number,
  age: number,
  hiddenPillars: HiddenPillar[],
  tenGod: (dayStem: string, otherStem: string) => string,
): FortuneDomain[] {
  const pillar = (index: number) => {
    const item = chart.pillars[index];
    return { ...item, god: tenGod(chart.dayMaster.character, item.stem), inner: hiddenPillars[index].stems.map((stem) => stem.god) };
  };
  const [family, social, close, future] = [0, 1, 2, 3].map(pillar);
  const yearFact = `${year}년 세운 ${annual.ganji}(${annual.korean})의 십성은 ${annual.stemGod}입니다. ${annual.daewoon}과 함께 읽습니다.`;
  const place = (item: ReturnType<typeof pillar>) => `${item.label} ${item.text}(${item.korean})의 천간 십성은 ${item.god}, 지장간 십성은 ${item.inner.join("·")}입니다.`;
  const contact = (label: string) => annual.evidence.filter((line) => line.includes(`및 ${label} `));
  const contactSummary = (label: string) => {
    const found = contact(label);
    if (!found.length) return `${year}년 세운과 ${label} 사이에는 이 서비스가 계산하는 직접 합·충이 확인되지 않았습니다.`;
    return `${year}년 세운과 ${label} 사이에 ${found.some((line) => line.includes("지지충")) ? "충을 포함한 관계" : "합이나 반복 관계"}가 확인됩니다. 실제 변화의 뜻은 생활 조건과 함께 살펴보세요.`;
  };
  const starFact = (names: string[], topic: string) => {
    const found = chart.pillars.flatMap((item, index) => [
      { stem: item.stem, god: tenGod(chart.dayMaster.character, item.stem) },
      ...hiddenPillars[index].stems,
    ].filter((stem) => names.includes(stem.god)).map((stem) => `${item.label} ${item.text}(${item.korean})의 ${stem.stem}·${stem.god}`));
    const unique = [...new Set(found)];
    return unique.length
      ? `${topic}${joinParticle(topic)} 연결해 보는 ${names.join("·")} 단서는 ${unique.slice(0, 3).join(", ")}에 있습니다.`
      : `${topic}${joinParticle(topic)} 연결해 보는 ${names.join("·")} 단서가 네 기둥에 뚜렷하지 않습니다. 이것만으로 ${topic}의 유무를 판단하지 않습니다.`;
  };
  const reading = (item: ReturnType<typeof pillar>, conclusion: string) =>
    `원국 ${item.label} ${item.text}(${item.korean})의 ${item.god}${topicParticle(item.god)} ${godMeaning[item.god]}에 연결됩니다. ${annual.daewoon} ${annual.daewoon.endsWith("대운 시작 전") ? "구간" : "대운"}을 배경으로 ${year}년 ${annual.ganji}(${annual.korean}) 세운의 ${annual.stemGod}${topicParticle(annual.stemGod)} ${godMeaning[annual.stemGod]}에 연결됩니다. ${conclusion}`;
  const domain = (id: string, title: string, body: string, evidence: string[], interpretation: string): FortuneDomain => ({
    id, title, body, interpretation, evidence: [yearFact, ...evidence],
  });
  if (age < 20) return [
    domain("learning", "배움과 성장운", `월주 ${social.korean}의 ${social.god}${topicParticle(social.god)} 배우는 환경과 역할을 돌아볼 단서입니다. ${year}년 ${annual.stemGod}의 흐름은 성적보다 어떤 설명과 연습에서 이해가 쉬웠는지 비교하는 데 쓰세요. 어려운 과목은 도움을 요청할 방식을 정해 보세요.`, [place(social), starFact(["정인", "편인"], "배움")], reading(social, `월지의 ${social.inner.join("·")}도 배움의 바탕에 있으므로, 설명을 듣는 시간과 직접 해 보는 시간을 나눠 보는 해석이 맞습니다.`)),
    domain("family", "가족과 돌봄운", `년주 ${family.korean}${topicParticle(family.korean)} 가족과 오래된 생활 환경을 살피는 자리입니다. ${year}년에는 ${annual.stemGod}의 주제가 겹치므로 보호자의 기대와 자신의 속도가 다른지 확인해 보세요. 사주만으로 가족 관계의 좋고 나쁨을 정할 수 없습니다.`, [place(family), ...contact("년주")], reading(family, "가정에서는 기대에 맞추는 일과 도움을 받는 일을 구분하는 흐름으로 읽습니다. 가족의 실제 성격이나 관계 결과를 정하는 근거는 아닙니다.")),
    domain("peers", "친구와 또래운", `일주 ${close.korean}${topicParticle(close.korean)} 가까운 관계에서 자신의 반응을 살피는 자리입니다. 올해의 ${annual.stemGod} 흐름을 또래 사이의 역할과 비교해 보되, 친구가 생기는 시기를 예언하지는 않습니다. 불편한 일은 사실과 감정을 나눠 이야기해 보세요.`, [place(close), ...contact("일주")], reading(close, "친구와 함께하는 자리에서는 자신의 방식과 상대의 규칙이 모두 필요하므로, 편한 역할과 부담스러운 역할을 나누어 읽습니다.")),
    domain("balance", "생활 균형운", `시주 ${future.korean}${topicParticle(future.korean)} 앞으로 익혀 갈 생활 방식을 돌아볼 단서입니다. ${year}년 ${annual.stemGod}의 주제가 바쁨으로 이어졌다면 놀이·배움·쉬는 시간을 함께 살펴보세요. 사주로 병이나 체력을 판단할 수는 없습니다.`, [place(future)], reading(future, "앞으로 익힐 생활 방식에서는 놀이·배움·휴식의 시간을 한쪽에 몰리지 않게 배치할 여건을 살핍니다. 이 조합으로 건강 상태를 판단하지 않습니다.")),
    domain("adaptation", "환경 적응운", `월주 ${social.korean}과 올해의 ${annual.ganji}을 비교해 학교·거주 환경의 변화를 받아들이는 방식을 살펴봅니다. 합이나 충이 있어도 전학·이사를 뜻하지는 않습니다. 실제 변화가 있었다면 익숙해질 시간과 필요한 도움을 확인하세요.`, [place(social), ...contact("월주")], reading(social, "학교나 생활 환경이 달라질 때에는 익숙한 방식과 새 규칙 사이의 적응 시간을 따로 두는 해석입니다. 실제 전학·이사 여부를 예측하지 않습니다.")),
  ];
  return [
    domain("career", "직업운", `월주 ${social.korean}의 ${social.god}${topicParticle(social.god)} ${age >= 60 ? "오래 해 온 활동과 앞으로 맡을 역할" : "일터에서 맡는 역할"}을 살피는 단서입니다. 올해 ${annual.stemGod}의 주제를 실제 생활과 비교해 보세요. ${age >= 60 ? "새로운 활동을 시작한다면 즐거움과 감당할 시간을 먼저 확인하세요." : "직업의 성패보다 맡은 책임과 권한이 맞는지 먼저 확인하는 편이 좋습니다."}`, [place(social), starFact(["정관", "편관", "식신", "상관"], "일"), ...contact("월주")], reading(social, "일에서는 원래 익숙한 역할과 올해 새로 강조되는 기준을 함께 다룹니다. 성과·결정권·보상 중 어느 기준을 먼저 합의할지 정하면 부담을 줄일 수 있습니다.")),
    domain("study", "학업·시험운", `월주 ${social.korean}의 지장간 ${social.inner.join("·")}${topicParticle(social.inner.at(-1) ?? "")} 배우는 환경을 돌아볼 단서입니다. 인성은 배움과 지원, 식상은 배운 것을 결과물로 꺼내는 관계로 읽습니다. ${year}년 ${annual.stemGod}의 흐름과 비교해 준비 시간과 실전 연습 시간을 나눠 보세요. 합격 여부는 사주로 정할 수 없습니다.`, [place(social), starFact(["정인", "편인", "식신", "상관"], "시험 준비")], reading(social, `월지 안의 ${social.inner.join("·")}도 함께 고려하면, 익히는 시간과 답을 직접 써 보는 시간을 구분해 준비하는 쪽으로 풀이됩니다. 합격을 뜻하는 표시는 아닙니다.`)),
    domain("money", "재물운", `${starFact(["정재", "편재"], "재물")} ${year}년 ${annual.stemGod}의 흐름이 들어오더라도 수입의 크기나 투자 수익을 예언하지는 않습니다. 제안받은 일의 실제로 남는 금액, 소요 시간, 공동 지출의 기준을 확인하세요.`, [place(social), starFact(["정재", "편재"], "재물")], reading(social, `${starFact(["정재", "편재"], "재물")} 돈의 흐름은 확정된 수익보다 들어오는 조건과 나가는 비용을 따로 계산할 때 유용하게 읽힙니다.`)),
    domain("business", "사업·활동운", `식상은 결과를 밖으로 보이는 방식, 재성은 거래와 자원을 다루는 관계로 읽습니다. ${starFact(["식신", "상관", "정재", "편재"], "사업·활동")} ${year}년 ${annual.stemGod}의 주제와 함께 보되, 실제 제안이 있다면 역할, 비용, 중단 조건을 작은 규모로 확인하세요. 사업 성공을 확정할 수는 없습니다.`, [place(social), starFact(["식신", "상관", "정재", "편재"], "사업·활동")], reading(social, "사업이나 바깥 활동에서는 결과를 만들어 보이는 일과 자원을 관리하는 일을 따로 읽습니다. 제안이 많아질수록 실제 맡을 역할과 비용 한도를 먼저 정하는 편이 맞습니다.")),
    domain("romance", "연애운", `일주 ${close.korean}${topicParticle(close.korean)} 가까운 사람과 일상을 나누는 방식을 살피는 자리입니다. ${contactSummary("일주")} 올해 ${annual.stemGod}의 주제를 연락과 시간을 맞추는 방법에 비춰보세요. 만남이나 이별의 날짜를 예언하는 뜻은 아닙니다.`, [place(close), ...contact("일주")], reading(close, "가까운 관계에서는 자신의 익숙한 반응과 올해 더 강조되는 역할을 함께 보아야 합니다. 연락 빈도보다 서로 기대하는 시간과 경계를 분명히 할 때 관계를 읽는 단서가 됩니다.")),
    domain("partner", "배우자·동반자운", `일지 ${close.branch}(${close.korean[1]})에는 ${close.inner.join("·")}의 관계가 함께 있습니다. 가까운 동반자와 생활 규칙·돈·시간을 조정할 때 참고할 단서입니다. 결혼 여부나 상대의 성격을 확정하지 말고 ${year}년의 실제 대화와 합의를 먼저 살피세요.`, [place(close), ...contact("일주")], reading(close, `일지 안의 ${close.inner.join("·")}까지 함께 보면, 가까운 사람과 생활비·시간·집안일의 기준을 조율하는 방식을 살필 수 있습니다. 배우자의 존재나 성격을 뜻하지는 않습니다.`)),
    domain("children", "자녀·다음 세대운", `시주 ${future.korean}${topicParticle(future.korean)} 전통적으로 다음 세대와 긴 계획을 살피는 자리입니다. ${future.god}${joinParticle(future.god)} 식상 단서를 함께 보되 자녀의 유무·수·임신 가능성·성격을 판단하지 않습니다. ${year}년에는 돌봄이나 후배 지원을 맡을 현실적 여건을 따져 보세요.`, [place(future), starFact(["식신", "상관"], "다음 세대"), ...contact("시주")], reading(future, `${starFact(["식신", "상관"], "다음 세대")} 시주의 주제는 자녀 예언보다 돌봄·교육·후배 지원에 쓸 시간과 도움의 범위를 읽는 데 한정합니다.`)),
    domain("family", "가족·부모운", `년주 ${family.korean}${topicParticle(family.korean)} 가족과 오래된 관계를 읽는 자리입니다. ${family.god}의 역할과 올해 ${annual.stemGod}의 주제가 겹칠 때 도움과 부담의 경계를 살펴보세요. 특정 가족의 건강이나 관계의 미래를 사주로 정하지 않습니다.`, [place(family), starFact(["정인", "편인"], "가족의 지원"), ...contact("년주")], reading(family, "가족 사이에서는 오래된 역할과 올해 달라지는 요구를 구분하는 것이 핵심입니다. 도움을 주고받는 범위가 불분명하다면 한 사람이 맡을 몫이 과해지는지 살펴야 합니다.")),
    domain("social", "친구·협업운", `비견·겁재는 동료와 경쟁, 몫을 나누는 관계로 읽습니다. ${starFact(["비견", "겁재"], "친구·협업")} ${year}년 ${annual.stemGod}의 흐름에서 공동으로 하는 일은 기여와 결정권을 구체적으로 확인해 보세요.`, [place(social), starFact(["비견", "겁재"], "친구·협업"), ...contact("월주")], reading(social, "친구나 동료와 함께할 때는 서로의 기여·결정권·몫이 같은 기준으로 정해졌는지 보는 풀이입니다. 경쟁의 표시가 있어도 관계 단절을 예언하지는 않습니다.")),
    domain("health", "건강·생활 균형운", `${year}년 ${annual.stemGod}의 주제는 생활에서 요구받는 역할과 속도를 돌아볼 단서입니다. 최근 일정이 촘촘해졌다면 쉬는 시간과 일상을 실제 기록과 비교해 보세요. 오행이나 십성으로 질병·체질·수명·임신 가능성을 판단할 수 없습니다. 건강 문제가 있다면 의료 전문가와 상담하세요.`, [place(social)], reading(social, "여기서 살피는 것은 건강 상태가 아니라 일상에서 맡는 일과 쉴 시간을 배치하는 방식입니다. 일정이 늘어날 때 줄일 일과 도움받을 일을 먼저 정하는 해석으로 제한합니다.")),
    domain("movement", "이동·주거운", `${contactSummary("년주")} ${contactSummary("월주")} 합·충의 유무만으로 이사를 예언하지 않습니다. 거주지나 활동 장소의 이동을 생각한다면 비용과 이동 시간, 도움받을 사람을 비교하세요.`, [place(family), place(social), ...contact("년주"), ...contact("월주")], reading(family, `월주 ${social.text}(${social.korean})의 ${social.god}도 함께 보면, 익숙한 생활 기반과 바깥 활동의 요구를 같이 고려해야 합니다. 이동 자체를 예언하기보다 비용·이동 시간·도움받을 여건을 비교하는 풀이입니다.`)),
  ];
}
