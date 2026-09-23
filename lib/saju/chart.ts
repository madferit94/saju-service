import lunar from "lunar-javascript";
import { resolveBirthMoment, type Birthplace } from "./birth-moment";
import { getCalendarCandidates, resolveSolarDate, type BirthCalendar, type LeapMonthChoice } from "./calendar";

const { Solar } = lunar;

export type SajuInput = {
  date: string;
  time: string;
  calendar: BirthCalendar;
  leapMonth?: LeapMonthChoice;
  topic: "general" | "career" | "relationship";
  question?: string;
  unknownTime?: boolean;
  birthplace?: Birthplace;
};

export type Pillar = {
  label: string;
  text: string;
  korean: string;
  stem: string;
  branch: string;
  stemElement: string;
  branchElement: string;
};

export type SajuChart = {
  pillars: Pillar[];
  elements: Record<"목" | "화" | "토" | "금" | "수", number>;
  dayMaster: { character: string; korean: string; element: string };
  method: string;
  engine: string;
  elementMethod: string;
  birthplace?: Birthplace;
};

export class InputError extends Error {
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }
}

const stems = [..."甲乙丙丁戊己庚辛壬癸"];
const branches = [..."子丑寅卯辰巳午未申酉戌亥"];
const stemKo = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const branchKo = [
  "자",
  "축",
  "인",
  "묘",
  "진",
  "사",
  "오",
  "미",
  "신",
  "유",
  "술",
  "해",
];
const stemElement = [
  "목",
  "목",
  "화",
  "화",
  "토",
  "토",
  "금",
  "금",
  "수",
  "수",
];
const branchElement = [
  "수",
  "토",
  "목",
  "목",
  "토",
  "화",
  "화",
  "토",
  "금",
  "금",
  "토",
  "수",
];

export const CALCULATION =
  "양력 · 한국 표준시(UTC+9) · 23시 일자 변경 · 진태양시 보정 없음";

export function validateInput(raw: SajuInput): SajuInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new InputError("입력 내용을 확인해주세요.");
  const date = raw.date;
  if (typeof date !== "string") throw new InputError("생년월일을 입력해주세요.", "date");
  try { getCalendarCandidates(raw); }
  catch (error) { throw new InputError(error instanceof Error ? error.message : "생년월일을 확인해주세요.", "date"); }
  if (raw.unknownTime === true)
    throw new InputError(
      "이번 버전은 출생 시각을 아는 경우에만 계산합니다.",
      "unknownTime",
    );
  if (
    typeof raw.time !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.time)
  )
    throw new InputError("태어난 시각을 정확히 입력해주세요.", "time");
  if (!["general", "career", "relationship"].includes(raw.topic))
    throw new InputError("풀이 주제를 선택해주세요.", "topic");
  if (raw.question !== undefined && typeof raw.question !== "string")
    throw new InputError("질문은 글자로 입력해주세요.", "question");

  const question = (raw.question || "").trim();
  if (question.length > 200)
    throw new InputError("질문은 200자까지 입력할 수 있어요.", "question");

  const birthplace = raw.birthplace;
  if (birthplace !== undefined) {
    if (!birthplace || typeof birthplace !== "object" ||
      !/^[A-Z]{2}$/.test(birthplace.countryCode) ||
      !birthplace.countryName?.trim() || !birthplace.city?.trim() ||
      !birthplace.timezone?.trim() ||
      !Number.isFinite(birthplace.longitude) || Math.abs(birthplace.longitude) > 180) {
      throw new InputError("출생 국가와 도시를 다시 선택해주세요.", "birthplace");
    }
    try { new Intl.DateTimeFormat("en", { timeZone: birthplace.timezone }); }
    catch { throw new InputError("출생 도시의 시간대를 확인할 수 없습니다.", "birthplace"); }
  }

  return {
    date,
    time: raw.time,
    calendar: raw.calendar,
    leapMonth: raw.calendar === "lunar" ? (raw.leapMonth ?? "regular") : undefined,
    unknownTime: false,
    topic: raw.topic,
    question,
    birthplace,
  };
}

function pillar(label: string, text: string): Pillar {
  const [stem, branch] = [...text];
  return {
    label,
    text,
    korean: stemKo[stems.indexOf(stem)] + branchKo[branches.indexOf(branch)],
    stem,
    branch,
    stemElement: stemElement[stems.indexOf(stem)],
    branchElement: branchElement[branches.indexOf(branch)],
  };
}

export function calculate(raw: SajuInput): SajuChart {
  const input = validateInput(raw);
  let solarDate: string;
  try { solarDate = resolveSolarDate(input); }
  catch (error) { throw new InputError(error instanceof Error ? error.message : "생년월일을 확인해주세요.", "date"); }
  let moment;
  try { moment = resolveBirthMoment(solarDate, input.time, input.birthplace); }
  catch (error) { throw new InputError(error instanceof Error ? error.message : "출생 시각을 확인해주세요.", "time"); }
  const chinaTime = moment.chinaTime;
  const terms = Solar.fromYmdHms(
    chinaTime.getUTCFullYear(),
    chinaTime.getUTCMonth() + 1,
    chinaTime.getUTCDate(),
    chinaTime.getUTCHours(),
    chinaTime.getUTCMinutes(),
    0,
  )
    .getLunar()
    .getEightChar();
  const localTime = moment.localMeanSolarTime;
  const local = Solar.fromYmdHms(
    localTime.getUTCFullYear(), localTime.getUTCMonth() + 1, localTime.getUTCDate(),
    localTime.getUTCHours(), localTime.getUTCMinutes(), 0,
  )
    .getLunar()
    .getEightChar();
  local.setSect(1);

  const pillars = [
    pillar("년주", terms.getYear()),
    pillar("월주", terms.getMonth()),
    pillar("일주", local.getDay()),
    pillar("시주", local.getTime()),
  ];
  const elements: SajuChart["elements"] = {
    목: 0,
    화: 0,
    토: 0,
    금: 0,
    수: 0,
  };
  pillars.forEach((item) => {
    elements[item.stemElement as keyof typeof elements]++;
    elements[item.branchElement as keyof typeof elements]++;
  });

  return {
    pillars,
    elements,
    dayMaster: {
      character: pillars[2].stem,
      korean: stemKo[stems.indexOf(pillars[2].stem)],
      element: pillars[2].stemElement,
    },
    method: `${input.calendar === "lunar" ? `음력 ${input.date}${input.leapMonth === "leap" ? " 윤달" : " 평달"} → 양력 ${solarDate} · ` : ""}${input.birthplace
      ? `${input.birthplace.countryName} ${input.birthplace.city} · ${input.birthplace.timezone}(${moment.timezoneOffset}) · 일·시주 경도 ${input.birthplace.longitude.toFixed(2)}° 지방평균시 · 년·월주 절기 기준 · 균시차 미적용`
      : CALCULATION}`,
    birthplace: input.birthplace,
    engine: "lunar-javascript@1.7.7",
    elementMethod:
      "천간과 지지의 대표 오행 8자를 센 값입니다. 지장간과 계절 가중치를 반영한 강약 판단은 아닙니다.",
  };
}
