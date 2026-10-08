import Image from "next/image";
import SajuForm from "./saju-form";
import lanternJourney from "../public/images/lantern-journey.webp";

export default function Page() {
  return (
    <main>
      <header className="page-header journey-hero">
        <Image className="journey-hero-image" src={lanternJourney} alt="" fill priority sizes="(max-width: 1120px) 100vw, 1120px" />
        <div className="journey-hero-content">
          <p className="eyebrow">나의 대운, 나의 시간</p>
          <h1>나를 알고,<br/>다음 시간을 그리다.</h1>
          <p className="intro">지나온 시간을 이해하고, 앞으로의 선택을 살피는 일.<br/>당신의 길을 비추는 작은 등불이 되어드릴게요.</p>
          <a className="journey-start" href="?view=input#input-title">내 사주 보기 <span aria-hidden="true">↗</span></a>
          <p className="journey-caption">사주와 대운으로 읽는 나의 흐름</p>
        </div>
      </header>
      <SajuForm />
      <footer className="journey-footer">나의 대운, 나의 시간 <span aria-hidden="true">·</span> 내 길을 비추는 작은 등불</footer>
    </main>
  );
}
