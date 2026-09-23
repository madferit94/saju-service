import SajuForm from "./saju-form";

export default function Page() {
  return (
    <main>
      <header className="page-header">
        <p className="eyebrow">나의 대운, 나의 시간</p>
        <h1>인생의 흐름을 한눈에 살펴보세요.</h1>
        <p className="intro">
          나에게 맞는 대운을 따라 지나온 시간과 지금, 앞으로의 시간을 이어서 볼 수 있습니다.
        </p>
      </header>
      <SajuForm />
    </main>
  );
}
