import type { DeepAnalysis } from "./deep-analysis";

export type FlowGroup = "peers" | "output" | "wealth" | "authority" | "resource";
export type RuleMode = "supported" | "support-needed" | "balanced" | "uncertain";
export const GROUP_THEMES: Record<FlowGroup, string> = {
  peers: "자기 기준과 협력", output: "표현과 완성", wealth: "자원과 성과 관리", authority: "책임과 기준", resource: "배움과 지원",
};
export function godGroup(god: string): FlowGroup {
  const groups: Record<string, FlowGroup> = { 비견:"peers", 겁재:"peers", 식신:"output", 상관:"output", 편재:"wealth", 정재:"wealth", 편관:"authority", 정관:"authority", 편인:"resource", 정인:"resource" };
  if (!groups[god]) throw new Error("십성 관계를 확인해 주세요.");
  return groups[god];
}
type Copy = [opportunity: string, risk: string, action: string];
const rules: Record<FlowGroup, Record<"supported" | "support-needed" | "balanced", Copy>> = {
  peers: {
    supported: ["이미 가진 기준을 동료와 나누며 각자의 전문성을 살릴 수 있습니다.", "내 방식과 상대의 방식이 맞서면 협력이 결정권 다툼으로 바뀔 수 있습니다.", "함께 정할 일과 혼자 책임질 일을 시작 전에 나누세요."],
    "support-needed": ["혼자 감당하던 일을 동료와 나눌 때 활동을 이어갈 여유가 생길 수 있습니다.", "도움을 얻으려다 상대의 몫까지 떠맡으면 부담이 다시 커집니다.", "도움받을 역할 한 가지와 내가 맡을 범위를 구체적으로 합의하세요."],
    balanced: ["독립적으로 할 일과 협력할 일을 골라 역할을 조정해 볼 수 있습니다.", "누가 결정하고 마무리하는지 흐리면 일이 겹치기 쉽습니다.", "공동 작업 하나에서 결정권자와 마감 책임자를 정하세요."],
  },
  output: {
    supported: ["쌓아 둔 생각과 경험을 눈에 보이는 결과물로 옮길 여지가 있습니다.", "표현에 자신이 붙어 상대의 요구를 건너뛰면 반응과 기대가 어긋날 수 있습니다.", "작은 완성물을 먼저 보여 주고 받은 의견 하나를 다음 작업에 반영하세요."],
    "support-needed": ["이미 익숙한 기술부터 작게 완성하면 무리하지 않고 표현할 기회를 만들 수 있습니다.", "새로운 발표와 제작을 동시에 늘리면 준비와 회복 시간이 부족해질 수 있습니다.", "이번에 내놓을 결과물을 하나로 좁히고 작업 시간의 상한을 정하세요."],
    balanced: ["배운 것을 표현하고 반응을 살피며 다음 방향을 고를 수 있습니다.", "새로운 아이디어가 계속 생기면 마무리가 뒤로 밀릴 수 있습니다.", "새 일을 추가하기 전에 진행 중인 작업 하나를 끝내세요."],
  },
  wealth: {
    supported: ["내가 가진 역량을 실제 자원이나 성과로 연결할 조건을 비교해 볼 수 있습니다.", "성과를 넓히는 데 몰두하면 관리할 시간과 비용이 예상보다 늘어날 수 있습니다.", "새 제안은 들어올 자원과 유지 비용을 같은 표에 적어 비교하세요."],
    "support-needed": ["확보한 시간과 자원을 먼저 정리하면 새로운 기회를 감당할 범위가 보입니다.", "눈에 보이는 보상만 따라가면 유지 비용과 책임이 쌓일 수 있습니다.", "새 약속을 늘리기 전에 기존 지출과 마감 중 줄일 항목 하나를 정하세요."],
    balanced: ["기회와 유지 부담을 함께 따져 필요한 자원을 선택할 수 있습니다.", "작은 약속이 누적되면 생활에서 쓸 여유가 줄어들 수 있습니다.", "제안 하나마다 필요한 시간과 비용, 그만둘 기준을 적으세요."],
  },
  authority: {
    supported: ["스스로 정한 기준을 실제 책임과 약속으로 옮겨 신뢰를 쌓을 수 있습니다.", "내 기준만 밀어붙이면 다른 사람의 기대나 평가 방식과 부딪힐 수 있습니다.", "맡은 역할의 완료 기준을 상대와 먼저 맞춰 보세요."],
    "support-needed": ["책임을 혼자 떠안지 않고 지원과 권한을 확보할 때 역할을 안정적으로 이어갈 수 있습니다.", "요구되는 수준에 비해 준비 시간이나 결정권이 부족하면 부담이 커집니다.", "새 역할을 맡기 전에 줄일 일과 도움을 요청할 사람을 정하세요."],
    balanced: ["약속과 평가 기준을 정리하면 맡은 역할의 우선순위가 분명해질 수 있습니다.", "모든 기대에 맞추려 하면 정작 중요한 일이 밀릴 수 있습니다.", "이번 기간에 꼭 지킬 기준 두 가지를 골라 상대와 공유하세요."],
  },
  resource: {
    supported: ["이미 익힌 지식을 정리해 다른 사람에게 전하거나 실제 활동에 활용할 수 있습니다.", "준비를 더 해야 한다는 생각이 실행을 미루는 이유가 될 수 있습니다.", "추가 학습 전에 알고 있는 내용 하나를 직접 사용해 보세요."],
    "support-needed": ["배울 순서와 도움받을 관계를 정리하면 바깥의 요구를 감당할 기반을 만들 수 있습니다.", "도움을 주는 사람의 기준에만 맞추면 내가 원하는 방향이 흐려질 수 있습니다.", "조언을 받을 질문 하나와 직접 결정할 항목 하나를 나누세요."],
    balanced: ["필요한 배움과 직접 해보는 시간을 번갈아 배치할 수 있습니다.", "자료를 모으는 일이 실제 연습을 대신하고 있지 않은지 살펴야 합니다.", "배운 내용마다 일상에서 적용할 작은 과제 하나를 붙이세요."],
  },
};

export function selectContextualRule(natal: DeepAnalysis, parts: {god:string;weight:number}[]) {
  if (!parts.length) throw new Error("운의 관계가 비어 있습니다.");
  const weights = Object.fromEntries(Object.keys(GROUP_THEMES).map(g => [g, 0])) as Record<FlowGroup,number>;
  for (const p of parts) weights[godGroup(p.god)] += p.weight;
  const group = (Object.keys(weights) as FlowGroup[]).sort((a,b) => weights[b]-weights[a] || Number(b===godGroup(parts[0].god))-Number(a===godGroup(parts[0].god)))[0];
  const s = natal.strength;
  const mode: RuleMode = s.sensitive || s.exceptional ? "uncertain" : s.score < 40 ? "support-needed" : s.score > 60 ? "supported" : "balanced";
  const base = rules[group][mode === "uncertain" ? "balanced" : mode];
  const [opportunity, risk, action] = base;
  return { id:`${group}:${mode}`, group, theme:GROUP_THEMES[group], mode, weights,
    opportunity: mode === "uncertain" ? `${GROUP_THEMES[group]}의 주제를 실제 생활 여건과 비교해 볼 시기입니다. 한 방향으로 역할을 크게 늘리기 전에 작은 변화부터 살펴보세요.` : opportunity,
    risk: mode === "uncertain" ? "같은 배치도 지원과 준비 여건에 따라 다르게 나타날 수 있어, 한 가지 성향으로 단정하면 선택을 좁힐 수 있습니다." : risk,
    action, evidenceIds:["natal_season","natal_roots","flow_parts","flow_balance"],
  };
}
