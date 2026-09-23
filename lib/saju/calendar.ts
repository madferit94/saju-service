import lunar from "lunar-javascript";

const { Lunar, LunarYear } = lunar;

export type BirthCalendar = "solar" | "lunar";
export type LeapMonthChoice = "regular" | "leap" | "unknown";

export type CalendarInput = {
  date: string;
  calendar: BirthCalendar;
  leapMonth?: LeapMonthChoice;
};

export type CalendarCandidate<T extends CalendarInput = CalendarInput> = {
  input: T;
  solarDate: string;
  label: string;
};

function parseDate(date: string): [number, number, number] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("생년월일을 연·월·일에 맞게 입력해주세요.");
  }
  const [year, month, day] = date.split("-").map(Number);
  return [year, month, day];
}

function validSolarDate(year: number, month: number, day: number): boolean {
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day;
}

export function getCalendarCandidates<T extends CalendarInput>(input: T): CalendarCandidate<T>[] {
  const [year, month, day] = parseDate(input.date);
  if (input.calendar === "solar") {
    if (!validSolarDate(year, month, day)) throw new Error("실제로 존재하는 날짜를 입력해주세요.");
    if (year < 1990) throw new Error("양력 1990년 1월 1일 이후의 날짜를 지원합니다.");
    return [{ input, solarDate: input.date, label: "양력" }];
  }

  if (input.calendar !== "lunar") throw new Error("양력 또는 음력을 선택해주세요.");
  if (year < 1990 || year > 2100) throw new Error("음력 1990년부터 2100년까지 지원합니다.");
  if (month < 1 || month > 12 || day < 1 || day > 30) {
    throw new Error("음력 월은 1~12월, 일은 1~30일로 입력해주세요.");
  }

  const leapMonth = input.leapMonth ?? "regular";
  if (!["regular", "leap", "unknown"].includes(leapMonth)) throw new Error("평달·윤달·모름 중에서 선택해주세요.");

  let regularSolarDate: string;
  try {
    regularSolarDate = Lunar.fromYmd(year, month, day).getSolar().toYmd();
  } catch {
    throw new Error("해당 음력 평달에는 입력한 날짜가 없습니다.");
  }

  const leapMonthOfYear = LunarYear.fromYear(year).getLeapMonth();
  const hasLeapCandidate = leapMonthOfYear === month;
  if (leapMonth === "leap" && !hasLeapCandidate) {
    throw new Error(`음력 ${year}년에는 ${month}월 윤달이 없습니다. 평달 또는 모름을 선택해주세요.`);
  }

  const regularCandidate: CalendarCandidate<T> = {
    input: { ...input, calendar: "lunar", leapMonth: "regular" },
    solarDate: regularSolarDate,
    label: leapMonth === "unknown" && !hasLeapCandidate ? "평달 (해당 연·월에 윤달 없음)" : "평달",
  };
  if (leapMonth === "regular" || !hasLeapCandidate) {
    const solarYear = Number(regularSolarDate.slice(0, 4));
    if (solarYear < 1990) throw new Error("양력 1990년 1월 1일 이후의 출생 날짜를 지원합니다.");
    return [regularCandidate];
  }

  let leapSolarDate: string;
  try {
    leapSolarDate = Lunar.fromYmd(year, -month, day).getSolar().toYmd();
  } catch {
    if (leapMonth === "leap") throw new Error("해당 음력 윤달에는 입력한 날짜가 없습니다.");
    regularCandidate.label = "평달 (해당 날짜의 윤달 없음)";
    return [regularCandidate];
  }
  const leapYear = Number(leapSolarDate.slice(0, 4));
  const candidates: CalendarCandidate<T>[] = [regularCandidate];
  if (leapYear >= 1990) {
    candidates.push({
      input: { ...input, calendar: "lunar", leapMonth: "leap" },
      solarDate: leapSolarDate,
      label: "윤달",
    });
  } else if (leapMonth === "leap") {
    throw new Error("양력 1990년 1월 1일 이후의 출생 날짜를 지원합니다.");
  }
  return candidates;
}

export function resolveSolarDate(input: CalendarInput): string {
  const candidates = getCalendarCandidates(input);
  if (candidates.length > 1) {
    throw new Error("윤달 여부를 확인할 수 없습니다. 평달 또는 윤달을 선택하거나 두 결과를 비교해주세요.");
  }
  return candidates[0].solarDate;
}
