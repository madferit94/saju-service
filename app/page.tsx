import SajuForm from "./saju-form";

export default function Page() {
  return (
    <main>
      <header className="page-header">
        <p className="eyebrow">나의 사주 기록</p>
        <h1>나를 알고,<br/>다음 시간을 그리다.</h1>
        <p className="intro">
          한눈에 보는 만세력과 쉬운 말로 풀어낸 상담.<br/>지나온 경험과 앞으로의 선택을 차근차근 살펴보세요.
        </p>
      </header>
      <SajuForm />
    </main>
  );
}
