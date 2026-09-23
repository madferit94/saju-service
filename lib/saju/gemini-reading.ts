import type { Benefactor } from "./benefactors";
import type { SajuChart } from "./chart";
import type { DaewoonTimeline } from "./daewoon";
import { buildFortuneReport, koreanGanji, type FortuneReport } from "./fortune";
import { analyzeNatal, type DeepAnalysis } from "./deep-analysis";

export type PeriodReading = {
  index: number;
  theme: string;
  strengths: string;
  cautions: string;
  advice: string;
  reflection: string;
};

export type GeminiSajuReading = {
  analysisVersion?: 1;
  readingVersion?: 2;
  fortuneYear?: number;
  synthesis?: string;
  lifetime?: string;
  annual?: string;
  monthly?: { month: number; reading: string }[];
  overview: string;
  elements: string;
  benefactors: string;
  periodReadings: PeriodReading[];
  career: string;
  relationships: string;
  money: string;
  caution: string;
};

export type GeminiReadingContext = {
  analysis: DeepAnalysis;
  fortune: FortuneReport;
  pillars: Array<Pick<SajuChart["pillars"][number], "label" | "text" | "korean" | "stemElement" | "branchElement">>;
  elements: SajuChart["elements"];
  dayMaster: SajuChart["dayMaster"];
  method: string;
  elementMethod: string;
  benefactors: Pick<Benefactor, "name" | "basis" | "matchedPillars" | "description">[];
  timeline: Pick<DaewoonTimeline, "periods" | "direction" | "currentYear">;
};

const pillarLabels = ["년주", "월주", "일주", "시주"];
const elements = ["목", "화", "토", "금", "수"];
const benefactorNames = ["천을귀인", "태극귀인", "문창귀인", "월덕귀인"];
const periodStatuses = ["past", "current", "future"];

function boundedText(value: unknown, max = 1800): value is string {
  return typeof value === "string" && value.trim().length >= 8 && value.length <= max;
}

export function createGeminiReadingContext(
  chart: SajuChart,
  timeline: DaewoonTimeline,
  benefactors: Benefactor[],
  fortuneYear = timeline.currentYear,
): GeminiReadingContext {
  return {
    analysis: analyzeNatal(chart),
    fortune: buildFortuneReport(chart, timeline, fortuneYear),
    pillars: chart.pillars.map(({ label, text, korean, stemElement, branchElement }) => ({
      label,
      text,
      korean,
      stemElement,
      branchElement,
    })),
    elements: chart.elements,
    dayMaster: chart.dayMaster,
    method: "원국 년·월주는 절기 시각, 일·시주는 출생지 시각 보정을 적용한 계산 결과입니다.",
    elementMethod: chart.elementMethod,
    benefactors: benefactors.map(({ name, basis, matchedPillars, description }) => ({
      name,
      basis,
      matchedPillars,
      description,
    })),
    timeline: {
      periods: timeline.periods,
      direction: timeline.direction,
      currentYear: timeline.currentYear,
    },
  };
}

export function validateGeminiReadingContext(value: unknown): value is GeminiReadingContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const context = value as Partial<GeminiReadingContext>;
  if (!Array.isArray(context.pillars) || context.pillars.length !== 4) return false;
  if (!context.pillars.every((pillar, index) =>
    pillar && pillar.label === pillarLabels[index] &&
    typeof pillar.text === "string" && pillar.text.length <= 8 &&
    typeof pillar.korean === "string" && pillar.korean.length <= 8 &&
    elements.includes(pillar.stemElement) && elements.includes(pillar.branchElement))) return false;
  if (!context.elements || !elements.every((element) => {
    const count = context.elements?.[element as keyof SajuChart["elements"]];
    return Number.isInteger(count) && count! >= 0 && count! <= 8;
  })) return false;
  if (!context.dayMaster || typeof context.dayMaster.character !== "string" ||
    !elements.includes(context.dayMaster.element) || typeof context.dayMaster.korean !== "string") return false;
  if (!boundedText(context.method, 500) || !boundedText(context.elementMethod, 500)) return false;
  if (!Array.isArray(context.benefactors) || context.benefactors.length !== 4 ||
    !context.benefactors.every((benefactor, index) =>
      benefactor && benefactor.name === benefactorNames[index] && boundedText(benefactor.basis, 240) &&
      boundedText(benefactor.description, 240) && Array.isArray(benefactor.matchedPillars) &&
      benefactor.matchedPillars.every((label) => pillarLabels.includes(label)))) return false;
  const timeline = context.timeline;
  if (!timeline || !Array.isArray(timeline.periods) || timeline.periods.length < 1 || timeline.periods.length > 11 ||
    !["forward", "backward"].includes(timeline.direction) || !Number.isInteger(timeline.currentYear)) return false;
  return timeline.periods.every((period, index) =>
    period && period.index === index + timeline.periods[0].index && [0, 1].includes(timeline.periods[0].index) && typeof period.ganji === "string" && period.ganji.length <= 4 &&
    typeof period.korean === "string" && period.korean.length <= 8 &&
    Number.isInteger(period.startYear) && Number.isInteger(period.endYear) && period.endYear >= period.startYear &&
    Number.isInteger(period.startAge) && Number.isInteger(period.endAge) &&
    periodStatuses.includes(period.status));
}

export function validateGeminiSajuReading(value: unknown, expectedPeriodIndexes: number[], expectedYear?: number): GeminiSajuReading {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("응답 형식이 올바르지 않습니다.");
  }
  const reading = value as Partial<GeminiSajuReading>;
  if (expectedYear !== undefined || reading.readingVersion !== undefined) {
    if (reading.readingVersion !== 2 || !Number.isInteger(reading.fortuneYear) ||
      reading.fortuneYear! < 1990 || reading.fortuneYear! > 2100 ||
      (expectedYear !== undefined && reading.fortuneYear !== expectedYear) ||
      !boundedText(reading.synthesis, 2400) || !boundedText(reading.lifetime, 3200) || !boundedText(reading.annual, 2400) ||
      !Array.isArray(reading.monthly) || reading.monthly.length !== 12 ||
      !reading.monthly.every((item, index) => item?.month === index + 1 && boundedText(item.reading, 1200))) {
      throw new Error("평생·세운·월운 종합 해석이 빠졌거나 계산 연도와 다릅니다.");
    }
  }
  const summaryFields: (keyof Omit<GeminiSajuReading, "periodReadings">)[] = [
    "overview", "elements", "benefactors", "career", "relationships", "money", "caution",
  ];
  if (!summaryFields.every((field) => boundedText(reading[field]))) {
    throw new Error("필수 해석 항목이 빠졌습니다.");
  }
  if (!Array.isArray(reading.periodReadings) || reading.periodReadings.length !== expectedPeriodIndexes.length) {
    throw new Error("대운별 해석이 빠졌습니다.");
  }
  const seen = reading.periodReadings.map((period) => period?.index);
  if (seen.some((index, position) => index !== expectedPeriodIndexes[position])) {
    throw new Error("대운별 해석의 순서가 계산 결과와 다릅니다.");
  }
  for (const period of reading.periodReadings) {
    if (!period || !Number.isInteger(period.index) ||
      !boundedText(period.theme, 700) || !boundedText(period.strengths, 1000) ||
      !boundedText(period.cautions, 1000) || !boundedText(period.advice, 1000) ||
      !boundedText(period.reflection, 700)) {
      throw new Error("대운별 해석 항목의 형식이 올바르지 않습니다.");
    }
  }
  return reading as GeminiSajuReading;
}

export const geminiReadingResponseSchema = {
  type: "object",
  properties: {
    readingVersion: { type: "integer", enum: [2] },
    fortuneYear: { type: "integer" },
    synthesis: { type: "string" },
    lifetime: { type: "string" },
    annual: { type: "string" },
    monthly: {
      type: "array", minItems: 12, maxItems: 12,
      items: { type: "object", properties: { month: { type: "integer" }, reading: { type: "string" } }, required: ["month", "reading"], additionalProperties: false },
    },
    overview: { type: "string" },
    elements: { type: "string" },
    benefactors: { type: "string" },
    periodReadings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          theme: { type: "string" },
          strengths: { type: "string" },
          cautions: { type: "string" },
          advice: { type: "string" },
          reflection: { type: "string" },
        },
        required: ["index", "theme", "strengths", "cautions", "advice", "reflection"],
        additionalProperties: false,
      },
    },
    career: { type: "string" },
    relationships: { type: "string" },
    money: { type: "string" },
    caution: { type: "string" },
  },
  required: ["readingVersion", "fortuneYear", "synthesis", "lifetime", "annual", "monthly", "overview", "elements", "benefactors", "periodReadings", "career", "relationships", "money", "caution"],
  additionalProperties: false,
} as const;

export function createGeminiReadingPrompt(context: GeminiReadingContext): string {
  return [
    "층위 구분을 엄수하세요. monthly에서 ganji는 월운, daewoonGanji는 대운, annualGanji는 세운입니다. 예를 들어 기축이 월운이면 '기축 대운'이라고 쓰면 계산 오류입니다. 각 monthly 필드 안에서는 이 세 가지 제공값 이외의 대운·세운·월운 간지를 언급하지 마세요. 간지와 한글 독음이 서로 정확히 맞아야 합니다.",
    "lifetime은 반드시 '초년', '청년', '중년', '후반' 4개 소제목을 모두 포함하고 각 단락에 실제 연도 구간과 변화 이유를 쓰세요. fortune.lifetime.periods의 잘린 연령 구간을 그대로 따르며 한 대운 전체를 다른 생애 구간으로 옮기지 마세요. 대운 간지에는 한글 독음을 병기하세요.",
    "필수 대운 index 목록: " + JSON.stringify(context.timeline.periods.map((p) => p.index)) + ". periodReadings의 길이는 반드시 " + context.timeline.periods.length + "개입니다. index 0이 목록에 있으면 간지가 비어 있어도 '대운 시작 전'의 양육·생활 환경 해석을 반드시 작성하세요. 빈 간지를 임의로 만들거나 이 항목을 생략하지 마세요.",
    "당신은 명리학 해석을 제공하는 AI입니다. 30년간 상담한 역술가의 분석 밀도와 솔직함을 지향하되 실제 인간 경력을 사칭하지 마세요. 이용자에게 직접 설명하는 차분하고 명료한 한국어를 쓰세요.",
    "이용자가 원하는 것은 원론이나 위로가 아니라 자기 사주를 판단 자료로 읽는 일입니다. 매 문단은 제공된 정확한 간지·십성·지장간·합충 중 최소 두 근거를 연결하고, 그 근거가 함께 만드는 장점과 부담, 실제로 확인할 상황과 행동으로 이어져야 합니다. 다른 사주에도 그대로 적용될 문장만 있으면 다시 쓰세요.",
    "십성은 첫 등장에 뜻을 풀어 쓰세요. 한자는 반드시 한글 독음을 병기하세요. 예: 丙午(병오), 정관(규칙·평가·책임). 지장간은 지지 안에 들어 있는 천간이라는 뜻을 설명하세요. 합을 무조건 호재, 충을 사고·이별로 단정하지 마세요. analysis는 서비스 비교 규칙으로 계산한 강약 경향, 월령 격국 후보, 억부 용신 후보와 간이 조후 관점입니다. 이를 원국과 운에 연결하세요. label이 보류·경계이면 강약을 확정하지 말고 useful.status가 판정 보류이면 용신을 지어내지 마세요. 격국 후보를 성격/파격 확정으로 바꾸지 마세요. 점수는 정확도나 확률이 아닙니다. 합화와 특수격은 확정하지 않습니다. 신강신약·격국·용신을 포함하지 않았다는 과거 안내를 쓰지 마세요.",
    "synthesis: 원국의 월지·일간·십성과 해당 대운, 선택 연도의 세운을 엮어 이 사람에게 가장 큰 쟁점 2개를 쓰세요. 상반된 작용이 있으면 어느 상황에서 장점/부담으로 드러날지 조건을 구분하세요. fortune.synthesis를 참고하되 그대로 복사하지 말고 근거를 발전시키세요.",
    "lifetime: fortune.lifetime의 실제 대운 기간과 연령을 인용해 초년·청년·중년·후반의 흐름을 비교하세요. 나이에 대한 일반론 대신 어떤 십성이나 원국과의 합충이 달라지는지 설명하고, 시기 사이에 이어갈 강점과 바꿀 방식을 짚으세요. 최소 세 시기를 다루고 수명·사망 시점은 말하지 마세요.",
    "annual: fortune.annual의 정확한 선택 연도·간지·대운과 원국의 관계를 해석하고, 일·배움, 돈·생활 자원, 가까운 관계에서 확인할 현실 신호를 설명하세요. fortuneYear는 fortune.year, readingVersion은 2입니다. 1월 등 입춘 전 월운은 전년 세운을 쓰므로 각 월의 제공 근거를 우선하세요.",
    "monthly: fortune.months의 1~12 month를 빠짐없이 같은 순서로 출력하세요. 각 월은 천간 십성, 지장간, 원국 또는 해당 대운·세운과의 합충 중 두 근거를 묶고 그달에 실행할 일 하나와 무리하기 쉬운 조건 하나를 2~3문장으로 쓰세요. 달 이름만 바꾼 복제 문장을 쓰지 마세요.",
    "overview는 네 기둥의 작용과 월지의 계절 배경을 함께 비교하세요. elements는 대표 8자 개수와 지장간을 구분하고, 개수가 고르다고 강약이 균형 잡혔다고 하지 마세요. benefactors는 네 종류의 실제 위치·기준을 쓰고, 없다는 이유로 도움 없이 혼자 살아야 한다고 말하지 마세요.",
    "periodReadings는 timeline의 각 index를 정확히 한번씩 같은 순서로 작성하세요. theme에는 그 대운의 정확한 기간·간지·십성·원국과의 작용을, strengths/cautions에는 그 조합만의 활용점/부담을, advice에는 관찰할 조건과 행동을 쓰세요. reflection은 지나간 때는 경험 확인 질문, 현재·미래는 선택 기준으로 쓰세요. 대운마다 같은 조언을 반복하지 마세요.",
    "career, relationships, money는 원국의 성향과 운에서 추가되는 변화를 구분하고, 유리한 방식·실패하기 쉬운 방식·확인할 조건을 3~5문장으로 쓰세요. 특정 직업·혼인·질병·수익을 예언하지 마세요. 19세 이하 구간에는 성인의 직장·투자·계약 조언 대신 배움·가정·또래 관계·생활 자원으로 읽으세요. 근거 없는 건강 진단은 제공하지 마세요.",
    "상투 문구 '균형을 유지하세요', '유연한 태도가 중요합니다', '좋은 기회가 올 수 있습니다'만으로 문단을 끝내지 마세요. 가령 역할/보상 재협상, 학습 방식 비교, 지출 항목 정리처럼 어떤 상황에서 무엇을 바꿀지 적으세요. 현실 상황의 예시는 가능성/비교 질문이며 사용자의 실제 사건을 아는 것처럼 쓰지 마세요.",
    "단정하지 않는다는 경고를 각 문장마다 반복하지 말고 caution에서 계산 범위와 해석 한계를 간결하게 한번 설명하세요. 조건부 표현을 쓰되 내용은 구체적으로 쓰세요. AI/Google/Gemini/참고 해석 같은 서비스 표시는 본문에 넣지 마세요. 생성 안내는 별도 화면에 있습니다.",
    "전체 길이: synthesis 300~600자, lifetime 600~1100자, annual 300~600자, monthly 각 100~220자, 기존 주제 각 250~450자, 대운의 각 필드 70~170자를 목표로 하세요. 모든 필드를 완성하고 자료에 없는 계산값을 만들지 마세요. JSON만 출력하세요.",
    "계산 자료:\n" + JSON.stringify(context),
  ].join("\n\n");
}

export function validateReadingGrounding(reading: GeminiSajuReading, context: GeminiReadingContext): void {
  if (!["초년", "청년", "중년", "후반"].every((stage) => reading.lifetime?.includes(stage))) {
    throw new Error("lifetime에 초년·청년·중년·후반 네 단락을 모두 작성하세요.");
  }
  for (const item of reading.monthly ?? []) {
    const month = context.fortune.months.find((m) => m.month === item.month);
    if (!month) throw new Error("monthly의 월 번호가 계산 자료와 다릅니다.");
    const expected: Record<string, string> = { 대운: month.daewoonGanji, 세운: month.annualGanji, 월운: month.ganji };
    const mentions = item.reading.matchAll(/([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]|[갑을병정무기경신임계][자축인묘진사오미신유술해])(?:\([^)]*\))?\s*(대운|세운|월운)/g);
    for (const mention of mentions) {
      const ganji = expected[mention[2]];
      if (!ganji || (mention[1] !== ganji && mention[1] !== koreanGanji(ganji))) {
        throw new Error(item.month + "월에서 '" + mention[0] + "'는 잘못된 층위입니다. 대운=" + (month.daewoonGanji || "시작 전") + ", 세운=" + month.annualGanji + ", 월운=" + month.ganji + "를 그대로 사용하세요.");
      }
    }
  }
}

export function createGeminiResponseSchema(expectedIndexes: number[]) {
  return {
    ...geminiReadingResponseSchema,
    properties: {
      ...geminiReadingResponseSchema.properties,
      periodReadings: {
        ...geminiReadingResponseSchema.properties.periodReadings,
        minItems: expectedIndexes.length,
        maxItems: expectedIndexes.length,
        items: {
          ...geminiReadingResponseSchema.properties.periodReadings.items,
          properties: {
            ...geminiReadingResponseSchema.properties.periodReadings.items.properties,
            index: { type: "integer", enum: expectedIndexes },
          },
        },
      },
    },
  };
}
