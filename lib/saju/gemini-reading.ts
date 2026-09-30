import type { Benefactor } from "./benefactors";
import type { SajuChart } from "./chart";
import type { DaewoonTimeline } from "./daewoon";
import { buildFortuneReport, koreanGanji, type FortuneReport } from "./fortune";
import { analyzeNatal, type DeepAnalysis } from "./deep-analysis";
import { SAJU_READING_PLAIN_FOUNDATION } from "./reading-prompt";

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
    SAJU_READING_PLAIN_FOUNDATION,
    "<표현 예시>좋은 방식: '새로운 일을 맡을 때는 익히는 시간과 실제로 해 보는 시간을 나누는 편이 좋겠습니다. 준비만 길어지면 결과를 확인할 기회를 놓칠 수 있습니다.' 근거가 실제로 있을 때만 뒤에 '태어난 달의 배움에 관한 관계와 이번 시기의 표현에 관한 관계를 함께 읽은 풀이입니다.'처럼 덧붙이세요. 나쁜 방식: '편인과 식신이 작용하므로 길합니다.' 예시는 말투를 보여 줄 뿐이며 계산 자료에 없는 관계를 복사하지 마세요.</표현 예시>",
    "<정확한 시기>lifetime에는 '초년', '청년', '중년', '후반' 네 구간을 모두 쓰고 fortune.lifetime.periods의 실제 연도·나이·대운에 맞추세요. 대운 시작 전에는 없는 간지를 만들지 마세요. annual은 fortune.year의 세운과 해당 대운을 구분하세요. monthly는 fortune.months의 1~12월을 순서대로 쓰고, 각 월의 ganji=월운, annualGanji=세운, daewoonGanji=대운입니다. 각 값과 한글 독음은 제공 자료와 일치해야 합니다. 1월 입춘 전에는 전년도 세운이 적용될 수 있으므로 월별 제공 자료를 우선하세요.</정확한 시기>",
    "<조합 해석>각 시기의 combination에는 원국의 월령·뿌리·운의 지장간·투간·조후를 함께 본 결과가 있습니다. 같은 십성의 일반론을 반복하지 말고 opportunity/risk/reason에서 이 원국과 시기에 달라지는 핵심을 선택하세요. facts는 내부 근거이며 가중치 수치를 본문에 나열하지 마세요.</조합 해석>",
    "<항목별 과제>synthesis는 이 사주에서 가장 두드러진 생활 쟁점 두 가지를 원국과 선택한 해의 관계로 읽으세요. overview는 타고난 네 기둥의 차이를 설명하세요. elements는 대표 8글자의 개수와 지장간을 구분하고 단순 개수를 강약 판정으로 바꾸지 마세요. benefactors는 실제 확인된 귀인만 설명하세요. lifetime과 annual은 먼저 생활의 변화, 이어 실제 계산 근거와 달라질 조건을 쓰세요. monthly는 각 월마다 생활 상황과 한 가지 실천을 간결히 쓰세요. career·relationships·money는 원래 성향과 이번 시기의 변화를 구분하세요. 19세 이하에는 성인의 직장·투자·계약 조언을 쓰지 마세요. caution에는 해석의 한계를 한 번만 짧게 쓰세요.</항목별 과제>",
    "<대운별 항목>periodReadings는 다음 index를 빠짐없이 같은 순서로 작성하세요: " + JSON.stringify(context.timeline.periods.map((p) => p.index)) + ". 각 theme에는 해당 시기의 실제 기간과 관계를, strengths·cautions에는 활용점과 부담을, advice·reflection에는 현실에서 확인할 조건이나 행동을 평서문으로 쓰세요. 같은 조언을 모든 시기에 복사하지 마세요.</대운별 항목>",
    "<응답 형식>readingVersion=2, fortuneYear=fortune.year입니다. 기존 JSON 형식의 모든 필드와 12개월, " + context.timeline.periods.length + "개 대운 항목을 채우세요. 각 항목의 첫 두 문장은 쉬운 생활 말, 뒤의 한두 문장은 실제 계산 근거가 되게 하세요. 길이를 채우려고 근거를 반복하지 말고 JSON만 출력하세요.</응답 형식>",
    "<계산 자료>\n" + JSON.stringify(context) + "\n</계산 자료>",
    "<이번 과제>위 계산 자료만 바탕으로 이번 사람의 사주를 읽기 쉽게 풀이하세요. synthesis·annual·overview·elements·benefactors·career·relationships·money의 첫 두 문장에는 한자나 월지·지장간·십성·원국 같은 말을 쓰지 마세요. 생활 장면과 선택의 조건을 먼저 말하고 세 번째 문장부터 근거를 설명하세요. 응답 전에 연도·간지·대운·세운·월운 명칭이 계산 자료와 맞는지 확인하세요.</이번 과제>",
  ].join("\n\n");
}

export function validateReadingGrounding(reading: GeminiSajuReading, context: GeminiReadingContext): void {
  const technicalOpening = /[\u3400-\u9fff]|일간|월지|[년월일시]주|지장간|십성|[대세월]운|신강|신약|격국|용신|귀인|편인|정인|편관|정관|편재|정재|비견|겁재|식신|상관|원국|천간|지지|간지|합충|오행/;
  const synthesisOpening = reading.synthesis?.split(/[.!?。]/, 1)[0] ?? "";
  if (technicalOpening.test(synthesisOpening)) {
    throw new Error("synthesis 첫 문장은 한자·사주 용어 없이 생활에서 보이는 모습으로 다시 쓰세요. 계산 근거는 다음 문장부터 설명하세요.");
  }
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
