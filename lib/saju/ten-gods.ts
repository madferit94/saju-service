const stems = [..."甲乙丙丁戊己庚辛壬癸"];
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
