import lunar from "lunar-javascript";
import { validateInput, type SajuInput } from "./chart";
import { resolveBirthMoment } from "./birth-moment";
import { Temporal } from "@js-temporal/polyfill";
import { resolveSolarDate } from "./calendar";

const { Solar } = lunar;

export type YunGender = 0 | 1;
export type PeriodStatus = "past" | "current" | "future";

export type DaewoonPeriod = {
  index: number;
  ganji: string;
  korean: string;
  startYear: number;
  endYear: number;
  startAge: number;
  endAge: number;
  status: PeriodStatus;
};

export type DaewoonTimeline = {
  periods: DaewoonPeriod[];
  firstStartDate: string;
  direction: "forward" | "backward";
  currentYear: number;
};

const stems = [..."甲乙丙丁戊己庚辛壬癸"];
const branches = [..."子丑寅卯辰巳午未申酉戌亥"];
const stemKo = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const branchKo = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];

function koreanGanji(ganji: string): string {
  if (!ganji) return "";
  const [stem, branch] = [...ganji];
  return stemKo[stems.indexOf(stem)] + branchKo[branches.indexOf(branch)];
}

export function calculateDaewoon(
  raw: SajuInput,
  gender: YunGender,
  currentYear = new Date().getFullYear(),
): DaewoonTimeline {
  const input = validateInput(raw);
  if (gender !== 0 && gender !== 1) {
    throw new Error("대운 계산 방식을 선택해주세요.");
  }

  const solarDate = resolveSolarDate(input);
  const [year] = solarDate.split("-").map(Number);
  let termsTime: Date;
  try { termsTime = resolveBirthMoment(solarDate, input.time, input.birthplace).chinaTime; }
  catch (error) { throw new Error(error instanceof Error ? error.message : "출생 시각을 확인해주세요."); }
  const yun = Solar.fromYmdHms(
    termsTime.getUTCFullYear(),
    termsTime.getUTCMonth() + 1,
    termsTime.getUTCDate(),
    termsTime.getUTCHours(),
    termsTime.getUTCMinutes(),
    0,
  )
    .getLunar()
    .getEightChar()
    .getYun(gender, 1);

  const startInstant = Date.parse(yun.getStartSolar().toYmdHms().replace(" ", "T") + "Z") - 8 * 60 * 60 * 1000;
  const startLocal = Temporal.Instant.fromEpochMilliseconds(startInstant)
    .toZonedDateTimeISO(input.birthplace?.timezone ?? "Asia/Seoul");
  const firstStartDate = startLocal.toPlainDate().toString();
  const firstStartYear = startLocal.year;

  const periods = yun
    .getDaYun(11)
    .map((period): DaewoonPeriod => {
      const index = period.getIndex();
      const startYear = index === 0 ? year : firstStartYear + (index - 1) * 10;
      const endYear = index === 0 ? firstStartYear - 1 : startYear + 9;
      const ganji = period.getGanZhi();

      return {
        index,
        ganji,
        korean: koreanGanji(ganji),
        startYear,
        endYear,
        startAge: startYear - year + 1,
        endAge: endYear - year + 1,
        status:
          endYear < currentYear
            ? "past"
            : startYear > currentYear
              ? "future"
              : "current",
      };
    })
    .filter((period) => period.endYear >= period.startYear);

  return {
    periods,
    firstStartDate,
    direction: yun.isForward() ? "forward" : "backward",
    currentYear,
  };
}
