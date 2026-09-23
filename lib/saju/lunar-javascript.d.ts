declare module "lunar-javascript" {
  class EightChar {
    setSect(value: number): void;
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;
    getYun(gender: 0 | 1, sect?: 1 | 2): Yun;
  }

  class DaYun {
    getIndex(): number;
    getStartYear(): number;
    getEndYear(): number;
    getStartAge(): number;
    getEndAge(): number;
    getGanZhi(): string;
  }

  class Yun {
    isForward(): boolean;
    getStartSolar(): Solar;
    getDaYun(count?: number): DaYun[];
  }

  class Lunar {
    static fromYmd(year: number, month: number, day: number): Lunar;
    getSolar(): Solar;
    getJieQiTable(): Record<string, Solar>;
    getEightChar(): EightChar;
  }

  class LunarYear {
    static fromYear(year: number): LunarYear;
    getLeapMonth(): number;
  }

  class Solar {
    static fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
    ): Solar;
    getLunar(): Lunar;
    toYmd(): string;
    toYmdHms(): string;
  }

  const lunar: { Solar: typeof Solar; Lunar: typeof Lunar; LunarYear: typeof LunarYear };
  export default lunar;
}
