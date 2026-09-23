import type { SajuChart } from "./chart";
import type { FlowAnalysis } from "./fortune";

export type FortuneDomain = { id: string; title: string; body: string; evidence: string[]; question: string };
type HiddenPillar = { label: string; stems: { stem: string; korean: string; god: string }[] };

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
  const contact = (label: string) => annual.evidence.filter((line) => line.startsWith(label));
  const starFact = (names: string[], topic: string) => {
    const found = chart.pillars.flatMap((item, index) => [
      { stem: item.stem, god: tenGod(chart.dayMaster.character, item.stem) },
      ...hiddenPillars[index].stems,
    ].filter((stem) => names.includes(stem.god)).map((stem) => `${item.label} ${item.text}(${item.korean})의 ${stem.stem}·${stem.god}`));
    return found.length
      ? `${topic}과 연결해 보는 ${names.join("·")} 단서는 ${found.slice(0, 3).join(", ")}에 있습니다.`
      : `${topic}과 연결해 보는 ${names.join("·")} 단서가 네 기둥에 뚜렷하지 않습니다. 이것만으로 ${topic}의 유무를 판단하지 않습니다.`;
  };
  const domain = (id: string, title: string, body: string, evidence: string[], question: string): FortuneDomain => ({
    id, title, body, evidence: [yearFact, ...evidence], question,
  });
  if (age < 20) return [
    domain("learning", "배움과 성장운", `월주 ${social.korean}의 ${social.god}은 배우는 환경과 역할을 돌아볼 단서입니다. ${year}년 ${annual.stemGod}의 흐름은 성적보다 어떤 설명과 연습에서 이해가 쉬웠는지 비교하는 데 쓰세요. 어려운 과목은 도움을 요청할 방식을 정해 보세요.`, [place(social), starFact(["정인", "편인"], "배움")], "이번 학기에 이해하기 쉬웠던 설명이나 연습은 무엇인가요?"),
    domain("family", "가족과 돌봄운", `년주 ${family.korean}은 가족과 오래된 생활 환경을 살피는 자리입니다. ${year}년에는 ${annual.stemGod}의 주제가 겹치므로 보호자의 기대와 자신의 속도가 다른지 확인해 보세요. 사주만으로 가족 관계의 좋고 나쁨을 정할 수 없습니다.`, [place(family), ...contact("년주")], "가정에서 편하게 도움을 요청할 수 있었던 순간은 언제였나요?"),
    domain("peers", "친구와 또래운", `일주 ${close.korean}은 가까운 관계에서 자신의 반응을 살피는 자리입니다. 올해의 ${annual.stemGod} 흐름을 또래 사이의 역할과 비교해 보되, 친구가 생기는 시기를 예언하지는 않습니다. 불편한 일은 사실과 감정을 나눠 이야기해 보세요.`, [place(close), ...contact("일주")], "친구와 함께할 때 편했던 역할과 부담스러웠던 역할은 무엇인가요?"),
    domain("balance", "생활 균형운", `시주 ${future.korean}은 앞으로 익혀 갈 생활 방식을 돌아볼 단서입니다. ${year}년 ${annual.stemGod}의 주제가 바쁨으로 이어졌다면 놀이·배움·쉬는 시간을 함께 살펴보세요. 사주로 병이나 체력을 판단할 수는 없습니다.`, [place(future)], "하루 중 충분히 쉬고 즐길 시간이 있나요?"),
    domain("adaptation", "환경 적응운", `월주 ${social.korean}과 올해의 ${annual.ganji}을 비교해 학교·거주 환경의 변화를 받아들이는 방식을 살펴봅니다. 합이나 충이 있어도 전학·이사를 뜻하지는 않습니다. 실제 변화가 있었다면 익숙해질 시간과 필요한 도움을 확인하세요.`, [place(social), ...contact("월주")], "새 환경에서 도움이 된 사람이나 규칙은 무엇인가요?"),
  ];
  return [
    domain("career", "직업운", `월주 ${social.korean}의 ${social.god}은 일터에서 맡는 역할을 살피는 단서입니다. 올해 ${annual.stemGod}의 주제를 실제 일과 비교해 보세요. 직업의 성패보다 맡은 책임과 권한이 맞는지 먼저 확인하는 편이 좋습니다.`, [place(social), starFact(["정관", "편관", "식신", "상관"], "일"), ...contact("월주")], "최근 맡은 일에서 권한보다 책임이 더 컸던 부분은 무엇인가요?"),
    domain("study", "학업·시험운", `월주 ${social.korean}의 지장간 ${social.inner.join("·")}은 배우는 환경을 돌아볼 단서입니다. 인성은 배움과 지원, 식상은 배운 것을 결과물로 꺼내는 관계로 읽습니다. ${year}년 ${annual.stemGod}의 흐름과 비교해 준비 시간과 실전 연습 시간을 나눠 보세요. 합격 여부는 사주로 정할 수 없습니다.`, [place(social), starFact(["정인", "편인", "식신", "상관"], "시험 준비")], "자료를 모으는 시간과 문제를 직접 푸는 시간 중 무엇이 부족한가요?"),
    domain("money", "재물운", `${starFact(["정재", "편재"], "재물")} ${year}년 ${annual.stemGod}의 흐름이 들어오더라도 수입의 크기나 투자 수익을 예언하지는 않습니다. 제안받은 일의 실제로 남는 금액, 소요 시간, 공동 지출의 기준을 확인하세요.`, [place(social), starFact(["정재", "편재"], "재물")], "최근 늘어난 수입이나 지출에서 내가 통제할 수 있는 부분은 무엇인가요?"),
    domain("business", "사업·활동운", `식상은 결과를 밖으로 보이는 방식, 재성은 거래와 자원을 다루는 관계로 읽습니다. ${starFact(["식신", "상관", "정재", "편재"], "사업·활동")} 올해 ${annual.stemGod}의 기회가 보여도 역할, 비용, 중단 조건을 작은 규모로 확인하세요. 사업 성공을 확정할 수는 없습니다.`, [place(social), starFact(["식신", "상관", "정재", "편재"], "사업·활동")], "새 제안을 시작할 때 감당할 수 있는 비용과 책임의 한도는 무엇인가요?"),
    domain("romance", "연애운", `일주 ${close.korean}은 가까운 사람과 일상을 나누는 방식을 살피는 자리입니다. 올해 ${annual.stemGod}의 주제와 일지의 합·충을 연락과 시간을 맞추는 방법에 비춰보세요. 만남이나 이별의 날짜를 예언하는 뜻은 아닙니다.`, [place(close), ...contact("일주")], "가까워질수록 서로 확인하고 싶은 기대와 경계는 무엇인가요?"),
    domain("partner", "배우자·동반자운", `일지 ${close.branch}(${close.korean[1]})에는 ${close.inner.join("·")}의 관계가 함께 있습니다. 가까운 동반자와 생활 규칙·돈·시간을 조정할 때 참고할 단서입니다. 결혼 여부나 상대의 성격을 확정하지 말고 ${year}년의 실제 대화와 합의를 먼저 살피세요.`, [place(close), ...contact("일주")], "함께 살아가거나 오래 만나는 관계에서 미리 합의할 생활 기준은 무엇인가요?"),
    domain("children", "자녀·다음 세대운", `시주 ${future.korean}은 전통적으로 다음 세대와 긴 계획을 살피는 자리입니다. ${future.god}과 식상 단서를 함께 보되 자녀의 유무·수·임신 가능성·성격을 판단하지 않습니다. ${year}년에는 돌봄이나 후배 지원을 맡을 현실적 여건을 따져 보세요.`, [place(future), starFact(["식신", "상관"], "다음 세대"), ...contact("시주")], "돌봄이나 후배 지원에 필요한 시간과 도움은 어느 정도인가요?"),
    domain("family", "가족·부모운", `년주 ${family.korean}은 가족과 오래된 관계를 읽는 자리입니다. ${family.god}의 역할과 올해 ${annual.stemGod}의 주제가 겹칠 때 도움과 부담의 경계를 살펴보세요. 특정 가족의 건강이나 관계의 미래를 사주로 정하지 않습니다.`, [place(family), starFact(["정인", "편인"], "가족의 지원"), ...contact("년주")], "가족에게 받을 도움과 내가 감당할 부탁을 어떻게 구분하나요?"),
    domain("social", "친구·협업운", `비견·겁재는 동료와 경쟁, 몫을 나누는 관계로 읽습니다. ${starFact(["비견", "겁재"], "친구·협업")} ${year}년 ${annual.stemGod}의 흐름에서 공동으로 하는 일은 기여와 결정권을 구체적으로 확인해 보세요.`, [place(social), starFact(["비견", "겁재"], "친구·협업"), ...contact("월주")], "함께 한 일에서 역할과 보상의 기준이 서로 같았나요?"),
    domain("health", "건강·생활 균형운", `${year}년 ${annual.stemGod}의 주제는 생활에서 요구받는 역할과 속도를 돌아볼 단서입니다. 최근 일정이 촘촘해졌다면 쉬는 시간과 일상을 실제 기록과 비교해 보세요. 오행이나 십성으로 질병·체질·수명·임신 가능성을 판단할 수 없습니다. 건강 문제가 있다면 의료 전문가와 상담하세요.`, [place(social)], "최근 무리한 일정이 있었다면 쉬는 시간과 필요한 도움을 어떻게 조정할 수 있나요?"),
    domain("movement", "이동·주거운", `${year}년 세운과 년주 ${family.korean}, 월주 ${social.korean}의 합·충은 오래된 환경과 사회생활을 조정할 단서로 읽습니다. 충이 없더라도 이사할 수 있고, 충이 있어도 이사를 뜻하지 않습니다. 거주지나 직장 이동을 생각한다면 비용과 이동 시간, 도움받을 사람을 비교하세요.`, [place(family), place(social), ...contact("년주"), ...contact("월주")], "지금의 주거·이동 방식에서 가장 바꾸고 싶은 조건은 무엇인가요?"),
  ];
}
