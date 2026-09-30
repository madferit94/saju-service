"use client";

import { useMemo, useRef, useState } from "react";
import lunar from "lunar-javascript";
import { calculateStars } from "../lib/saju/stars";
import type { DaewoonTimeline } from "../lib/saju/daewoon";
import type { CSSProperties } from "react";
import type { SajuChart } from "../lib/saju/chart";
import type { Benefactor } from "../lib/saju/benefactors";
import { buildManse, ELEMENT_NAMES, GOD_MEANINGS } from "../lib/saju/manse";

function Distribution({items,kind,center}:{items:{name:string;count:number;percent:number}[];kind:"element"|"god";center:string}) {
  let end=0;
  const colors=new Map(items.filter(i=>i.count).map((item,index)=>[item.name,kind==="element"?`var(--element-${item.name})`:`var(--god-${index%5})`]));
  const gradient=items.filter(i=>i.count).map(item=>{
    const start=end; end+=item.percent;
    return `${colors.get(item.name)} ${start}% ${end}%`;
  }).join(",");
  return <div className="distribution"><div className="distribution-ring" style={{background:`conic-gradient(${gradient})`}} aria-hidden="true"><span>{center}</span></div>
    <dl className="distribution-list">{items.map(item=><div key={item.name}><dt><i aria-hidden="true" style={{background:colors.get(item.name)??"var(--border)"}}/>{item.name}{kind==="element"?` · ${ELEMENT_NAMES[item.name]}`:<small>{GOD_MEANINGS[item.name]}</small>}</dt><dd>{item.percent.toFixed(1)}<small>% · {item.count}자</small></dd></div>)}</dl>
  </div>;
}
export default function MansePanel({chart,timeline,fortuneYear,mode="all"}:{chart:SajuChart;benefactors:Benefactor[];timeline?:DaewoonTimeline;fortuneYear?:number;mode?:"all"|"chart"|"elements"}) {
  const model=buildManse(chart);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const trigger=useRef<HTMLButtonElement|null>(null);
  const detail=useRef<HTMLElement|null>(null);
  const stars=useMemo(()=>{
    const year=fortuneYear ?? timeline?.currentYear;
    const period=timeline?.periods.find(p=>year && p.startYear<=year && p.endYear>=year);
    const flows=year ? [
      ...(period?.ganji ? [{label:`${year}년의 대운`,ganji:period.ganji}] : []),
      {label:`${year}년 세운`,ganji:lunar.Solar.fromYmdHms(year,7,1,12,0,0).getLunar().getEightChar().getYear()},
    ] : [];
    return calculateStars(chart,flows);
  },[chart,timeline,fortuneYear]);
  const selected=stars.find(s=>s.id===selectedId);
  function select(id:string,button:HTMLButtonElement) {
    trigger.current=button; setSelectedId(id);
    requestAnimationFrame(()=>{detail.current?.focus({preventScroll:true});detail.current?.scrollIntoView({block:"nearest",behavior:"smooth"});});
  }
  function close() {setSelectedId(null);trigger.current?.focus();}
  return <>
    {mode!=="elements" && <>
    <div className="manse-table-wrap" role="region" aria-label="나의 사주 네 기둥" tabIndex={0}><table className="manse-table"><caption>태어난 시·일·월·년으로 보는 네 기둥</caption><thead><tr><th scope="col">구분</th>{model.pillars.map(p=><th scope="col" className={p.label==="일주"?"my-pillar":""} key={p.label}>{p.label}<small>{({시주:"태어난 시",일주:"태어난 날 · 나",월주:"태어난 달",년주:"태어난 해"})[p.label]}</small></th>)}</tr></thead>
      <tbody>{["천간","천간 십성","지지","지지 십성","지장간","12운성","귀인·신살"].map(row=><tr key={row}><th scope="row">{row}</th>{model.pillars.map(p=><td key={p.label} className={p.label==="일주"?"my-pillar":""}>
        {row==="천간"||row==="지지" ? <div className="manse-character" style={{"--ink":`var(--ink-${row==="천간"?p.stemElement:p.branchElement})`} as CSSProperties}><strong>{row==="천간"?p.korean[0]:p.korean[1]}<span>{row==="천간"?p.stem:p.branch}</span></strong><small>{row==="천간"?p.stemElement:p.branchElement} · {ELEMENT_NAMES[row==="천간"?p.stemElement:p.branchElement]}</small></div>
        : row==="천간 십성" ? <span title={GOD_MEANINGS[p.stemGod]}>{p.label==="일주"?"비견 · 나":p.stemGod}</span>
        : row==="지지 십성" ? <span title={GOD_MEANINGS[p.branchGod]}>{p.branchGod}</span>
        : row==="지장간" ? p.hiddenStems.map(s=><span className="hidden-stem" key={s.stem}>{s.korean}({s.stem})</span>)
        : row==="12운성" ? p.stage
        : <span className="manse-stars">{stars.some(s=>s.matches.some(m=>m.pillar===p.label))?stars.filter(s=>s.matches.some(m=>m.pillar===p.label)).map(s=><button type="button" key={s.id} onClick={e=>select(s.id,e.currentTarget)} aria-label={`${p.label} ${s.name} 설명`} aria-controls="star-detail">{s.name}</button>):"—"}</span>}
      </td>)}</tr>)}</tbody></table></div>
    <section className="manse-benefactors"><h3>내 사주의 귀인과 신살</h3><p>이름을 누르면 뜻과 내 사주에서 읽는 방법을 볼 수 있어요.</p>
      <div className="star-chips">{[...stars].sort((a,b)=>Number(b.status==="matched")-Number(a.status==="matched")).map(s=><button type="button" className={`star-chip ${s.status==="matched"?"star-matched":""}`} key={s.id} onClick={e=>select(s.id,e.currentTarget)} aria-pressed={selectedId===s.id} aria-controls="star-detail"><strong>{s.name}</strong><span>{s.matches.length?s.matches.map(m=>m.pillar).join(" · "):s.status==="not-applicable"?"선택 규칙 대상 아님":"원국 해당 없음"}</span></button>)}</div>
      {selected && <article id="star-detail" className="star-detail" ref={detail} tabIndex={-1} aria-labelledby="star-detail-title" onKeyDown={e=>{if(e.key==="Escape")close();}}>
        <header><div><small>{selected.category}</small><h4 id="star-detail-title">{selected.name}</h4></div><button type="button" onClick={close} aria-label="귀인·신살 설명 닫기">닫기</button></header>
        <p>{selected.meaning}</p><h5>내 사주에서는</h5><p>{selected.interpretation}</p>
        {selected.matches.length>0 && <p className="star-rule">{selected.matches.map(m=>`${m.pillar} ${m.character} · ${m.bases.join(" / ")}`).join("; ")}</p>}
        {selected.status==="matched" && <div className="star-guidance"><div><h5>살려볼 점</h5><p>{selected.opportunity}</p></div><div><h5>함께 살필 점</h5><p>{selected.caution}</p></div><div><h5>생활에서 해보기</h5><p>{selected.action}</p></div></div>}
        <h5>운에서 만나는 시기</h5><p>{selected.flowMatches.length?selected.flowMatches.map(f=>`${f.label} ${f.ganji}에서 일치합니다 (${f.bases.join(" / ")}).`).join(" ")+" 태어난 사주의 보유 여부와 구별하며, 원국과 운의 전체 관계를 함께 읽습니다.":"표시 중인 대운·세운에서는 별도 일치가 없습니다."}</p>
        <p className="star-rule">적용 기준 · {selected.basis}</p>
      </article>}
      <p className="method-help">귀인·신살은 원국과 운을 보조하는 표지입니다. 개수로 길흉을 정하지 않습니다.</p>
    </section>
    </>}
    {mode!=="chart" && <section id="manse-elements" className="manse-elements"><p className="result-label">나를 이루는 다섯 가지 성질</p>{mode==="elements"?<h2>오행과 십성을 한눈에</h2>:<h3>오행과 십성을 한눈에</h3>}<p>오행은 나무·불·흙·금속·물, 십성은 나와 주변의 관계를 읽는 이름입니다.</p><div className="distribution-grid"><article><h4>오행 비율</h4><Distribution items={model.elements} kind="element" center={`${chart.dayMaster.korean}${chart.dayMaster.element}`}/></article><article><h4>십성 비율</h4><Distribution items={model.gods} kind="god" center="나와의 관계"/></article></div><p className="method-help">네 기둥의 대표 여덟 글자를 센 비율입니다.</p></section>}
  </>;
}
