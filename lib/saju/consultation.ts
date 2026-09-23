import type { GeminiReadingContext } from "./gemini-reading";
import { SEASONS, type LifeSeasonsReport } from "./life-seasons";

export const CHAPTERS = [
  {id:"natal",title:"나라는 사람의 바탕",focus:"네 기둥의 자리별 차이, 겉으로 보이는 태도와 안에서 원하는 것, 오행·십성·귀인 조합의 반복 패턴"},
  {id:"strength",title:"힘을 쓰는 방식과 회복 조건",focus:"신강신약 비교 규칙의 계절·뿌리·도움·소모 근거, 상반 조건, 판정이 달라지는 이유. 성격의 강약이나 신체 건강과 혼동 금지"},
  {id:"pattern",title:"격국과 용신을 함께 살피기",focus:"월지 본기와 투간에 따른 격국 후보, 억부 용신 후보와 조후 구별, 도움이 오히려 부담으로 바뀌는 조건. 보류이면 그 이유와 두 관점을 비교"},
  {id:"lifetime",title:"지나온 삶과 앞으로의 전환점",focus:"초년·청년·중년·후반 실제 대운 연도와 전환, 과거 경험 확인, 현재 대운/세운 중첩, 다음 시기에 바꿀 방식. 수명 예언 금지"},
  {id:"career",title:"일·배움·사회에서의 자리",focus:"맞는 일의 방식과 환경, 조직/독립/협업의 조건별 차이, 평가와 책임의 충돌, 현재 연도와 대운에서 검토할 선택. 직업 확정 금지"},
  {id:"money",title:"돈과 생활 자원을 다루는 방식",focus:"벌기·남기기·나누기·부담의 차이, 재성과 비겁/식상/관성 조합, 수입 방식과 지출·공동 자원의 위험 신호. 투자종목/수익률 추천 금지"},
  {id:"relationships",title:"가까운 관계와 인연의 흐름",focus:"가족·친구·연인/동반자에서 표현·거리·책임의 차이, 일지와 다른 자리의 상호작용, 관계에서 반복하는 기대와 실제 대화. 결혼유무/성적지향 가정 금지"},
  {id:"choices",title:"지금의 선택을 정리하는 상담",focus:"이번 연도/절입월의 계산과 앞선 사주 구조를 연결한 우선순위 세 가지, 30일 실험과 90일 돌아보기, 실제 경험이 해석과 다를 때 수정할 판단. 훈계와 자기계발 일반론 금지"},
] as const;
export type ChapterId = typeof CHAPTERS[number]["id"];
export type ConsultationSection = { heading:string; text:string; evidenceIds:string[]; counterpoint:string; example:string; question:string; action:string };
export const READING_STYLE_VERSION = 3;
export const CHAPTER_LABELS: Record<ChapterId,string> = {natal:"나는 어떤 사람일까요",strength:"어떤 환경에서 잘 풀릴까요",pattern:"나에게 도움이 되는 방향",lifetime:"지나온 삶과 앞으로의 변화",career:"나에게 맞는 일과 배우는 방법",money:"돈을 벌고 지키는 습관",relationships:"가까운 사람과 잘 지내는 방법",choices:"지금 무엇부터 해볼까요"};
export type ConsultationChapter = { id:ChapterId; title:string; summary?:string; sections:ConsultationSection[] };
export type Consultation = {version:1;analysisVersion:1;readingStyleVersion?:2|3;year:number;chapters:ConsultationChapter[]};

export function consultationFacts(context:GeminiReadingContext) {
  return [
    ...context.analysis.facts,
    ...context.pillars.map((p,i)=>({id:`pillar_${i}`,text:`${p.label} ${p.text}(${p.korean}) · 천간 ${p.stemElement}, 지지 ${p.branchElement}`})),
    ...context.fortune.natal.contacts.map((text,i)=>({id:`contact_${i}`,text})),
    ...context.benefactors.map((b,i)=>({id:`benefactor_${i}`,text:`${b.name}: ${b.basis}. 해당 자리: ${b.matchedPillars.join("·") || "없음"}`})),
    ...context.timeline.periods.map(p=>({id:`period_${p.index}`,text:`${p.startYear}~${p.endYear}년 / ${p.startAge}~${p.endAge}세 ${p.ganji}(${p.korean || "대운 시작 전"}) ${p.status}`})),
    {id:"annual",text:`${context.fortune.year}년 ${context.fortune.annual.ganji}(${context.fortune.annual.korean}) 세운 · ${context.fortune.annual.daewoon}. ${context.fortune.annual.evidence.join(". ")}`},
    ...context.fortune.months.map(m=>({id:`month_${m.month}`,text:`${m.month}월 ${m.ganji}(${m.korean}) 월운, 대운 ${m.daewoonGanji || "시작 전"}, 세운 ${m.annualGanji}. ${m.evidence.join(". ")}`})),
  ];
}
function text(value:unknown,min:number,max:number): value is string {return typeof value==="string" && value.trim().length>=min && value.length<=max;}

export function validateChapter(value:unknown,id:ChapterId,validIds?:string[]):ConsultationChapter {
  if(!value || typeof value!=="object") throw new Error("상담 장의 형식이 올바르지 않습니다.");
  const c=value as ConsultationChapter;
  const definition=CHAPTERS.find(item=>item.id===id);
  if(!definition || c.id!==id || c.title!==definition.title || !Array.isArray(c.sections) || c.sections.length<3 || c.sections.length>4) throw new Error("상담 장의 제목·순서와 3~4개 절을 확인해 주세요.");
  if(c.summary!==undefined && !text(c.summary,30,180)) throw new Error("상담 장 요약은 30~180자의 글이어야 합니다.");
  for(const s of c.sections) {
    if(!s || !text(s.heading,3,100) || !text(s.text,160,2200) || !text(s.counterpoint,25,700) || !text(s.example,25,700) || !text(s.question,10,300) || !text(s.action,20,700)) throw new Error("각 절에 충분한 설명과 반대 조건·가정 예시·확인 질문·실천 항목을 작성해 주세요.");
    if(!Array.isArray(s.evidenceIds) || s.evidenceIds.length<2 || s.evidenceIds.length>6 || new Set(s.evidenceIds).size!==s.evidenceIds.length || s.evidenceIds.some(e=> typeof e!=="string" || !/^[a-z]+(?:_[a-z0-9]+)*$/.test(e) || (validIds && !validIds.includes(e)))) throw new Error("각 절은 제공된 서로 다른 근거 ID 2~6개만 인용해야 합니다.");
    if (/체력|번아웃|무기력|탈진|불면|질환|에너지/.test([s.text,s.counterpoint,s.example,s.question,s.action].join(" "))) throw new Error("강약을 체력·에너지 소진·건강 증상으로 설명하지 마세요. 역할·권한·지원·표현·자원 배분의 구체적 조건으로 다시 풀어 주세요.");
  }
  if(new Set(c.sections.map(s=>s.text.trim())).size!==c.sections.length) throw new Error("동일한 문단을 복제하지 마세요.");
  return c;
}
export function validatePlainChapter(value:unknown,id:ChapterId,validIds?:string[]):ConsultationChapter {
  const chapter=validateChapter(value,id,validIds);
  if(!text(chapter.summary,30,180)) throw new Error("이 장의 핵심을 쉬운 생활 말로 30~180자 요약해 주세요.");
  if(/체력|번아웃|무기력|탈진|불면|질환|에너지/.test(chapter.summary)) throw new Error("장 요약도 강약을 체력·건강·에너지로 설명하지 말고 구체적인 생활 조건으로 쓰세요.");
  const technical=/[\u3400-\u9fff]|일간|월지|투간|본기|지장간|격국|용신|신강|신약|십성|재성|관성|식상|생조|조후|억부/;
  if(technical.test(chapter.summary)) throw new Error("장 요약은 한자·전문 용어 없이 생활 속 특징과 조건을 바로 말하세요.");
  if(chapter.sections.some(s=>technical.test(s.text.split(/[.!?\n]/)[0]))) throw new Error("각 절 첫 문장은 생활 이야기로 시작하세요. 사주 전문용어와 한자는 두 번째 문단에서 쉬운 뜻과 함께 설명하세요.");
  if(chapter.sections.some(s=>s.text.trim().length<280 || s.text.split(/\n+/).filter(p=>p.trim()).length<2)) throw new Error("쉬운 말이어도 설명을 줄이지 마세요. 각 절 본문을 최소280자, 줄바꿈으로 나눈 2개 이상 문단으로 작성하고 개인별 근거를 생활 상황과 연결하세요.");
  return chapter;
}
function checkObviousCurrentSeasonMismatch(content:string,report:LifeSeasonsReport) {
  if(!report.current) return;
  const year=report.current.currentYear;
  const pattern=new RegExp(`(?:현재|지금|${year}년)\\s*(?:현재\\s*)?(?:(?:계절|시기|대운)\\s*)?(?:은|는|이|가|의|에는|으로)?\\s*(봄|여름|가을|겨울)(?=\\s|[.,!?]|입니다|이다|이라고|이라|$)`,"g");
  for(const match of content.matchAll(pattern)) if(match[1]!==report.current.seasonLabel) throw new Error("현재 대운의 계절을 계산 결과와 다르게 적었습니다.");
}
export function validateSeasonedChapter(value:unknown,id:ChapterId,validIds?:string[],lifeSeasons?:LifeSeasonsReport):ConsultationChapter {
  const chapter=validatePlainChapter(value,id,validIds);
  if(/(?:살펴봅니다|다룹니다|비교합니다|확인합니다|알아봅니다)[.!?]?\s*$/.test(chapter.summary||"")) throw new Error("장 요약은 내용을 소개하지 말고 이 사람의 생활 조건을 직접 말하세요.");
  if(id==="lifetime" && lifeSeasons?.current) {
    const content=[chapter.summary,...chapter.sections.map(s=>s.text)].join(" ");
    checkObviousCurrentSeasonMismatch(content,lifeSeasons);
    const current=lifeSeasons.current;
    if(!content.includes(current.seasonLabel) || !content.includes(String(current.currentYear))) throw new Error(`현재 대운의 ${current.currentYear}년·${current.seasonLabel} 계절을 구체적으로 설명하세요.`);
    const position=lifeSeasons.periods.findIndex(p=>p.index===current.periodIndex);
    const neighbors=lifeSeasons.periods.slice(Math.max(0,position-1),position+2).map(p=>p.seasonLabel);
    if(new Set(neighbors).size>1 && !neighbors.some(season=>season!==current.seasonLabel && content.includes(season))) throw new Error("이전 또는 다음 대운의 다른 계절 주제와 현재를 비교하세요.");
  }
  return chapter;
}
export function enrichLifeSeasonChapter(value:unknown,lifeSeasons?:LifeSeasonsReport):unknown {
  if(!lifeSeasons?.current || !value || typeof value!=="object") return value;
  const chapter=value as ConsultationChapter;
  if(chapter.id!=="lifetime" || !Array.isArray(chapter.sections) || typeof chapter.sections[0]?.text!=="string") return value;
  const current=lifeSeasons.current;
  const content=[chapter.summary,...chapter.sections.map(s=>s.text)].join(" ");
  checkObviousCurrentSeasonMismatch(content,lifeSeasons);
  const position=lifeSeasons.periods.findIndex(p=>p.index===current.periodIndex);
  const period=lifeSeasons.periods[position];
  if(!period) return value;
  const neighbors=lifeSeasons.periods.slice(Math.max(0,position-1),position+2).filter(p=>p.seasonLabel!==current.seasonLabel);
  const missingCurrent=!content.includes(current.seasonLabel)||!content.includes(String(current.currentYear));
  const missingNeighbor=neighbors.length>0 && !neighbors.some(p=>content.includes(p.seasonLabel));
  if(!missingCurrent && !missingNeighbor) return value;
  const facts=[`${current.currentYear}년은 ${period.startYear}~${period.endYear}년 ${period.korean} 대운 안에 있습니다. 인생 그래프에서는 이 구간을 ${current.seasonLabel}, 곧 ${SEASONS[current.season].theme}의 시기로 읽습니다. ${SEASONS[current.season].description}`];
  if(missingNeighbor) {
    const neighbor=neighbors[0];
    facts.push(`${neighbor.startYear}~${neighbor.endYear}년 ${neighbor.korean} 대운은 ${neighbor.seasonLabel}의 주제인 ${SEASONS[neighbor.season].theme}가 앞섭니다. 두 시기의 차이를 실제 경험과 생활 조건에 비춰 확인해야 합니다.`);
  }
  const first=chapter.sections[0];
  const paragraphs=first.text.split(/\n\s*\n/);
  paragraphs.splice(1,0,facts.join(" "));
  return {...chapter,sections:[{...first,text:paragraphs.join("\n\n")},...chapter.sections.slice(1)]};
}
export function validateConsultation(value:unknown,validIds?:string[],lifeSeasons?:LifeSeasonsReport):Consultation {
  if(!value || typeof value!=="object") throw new Error("상담 저장 형식이 올바르지 않습니다.");
  const c=value as Consultation;
  if(c.version!==1 || c.analysisVersion!==1 || !Number.isInteger(c.year) || c.year<1990 || c.year>2100 || !Array.isArray(c.chapters) || c.chapters.length>8) throw new Error("상담 저장 버전이나 연도가 올바르지 않습니다.");
  if(c.readingStyleVersion!==undefined && c.readingStyleVersion!==2 && c.readingStyleVersion!==3) throw new Error("상담 문체 버전을 확인해 주세요.");
  const positions=c.chapters.map(ch=>CHAPTERS.findIndex(def=>def.id===ch?.id));
  if(positions.some((p,i)=>p<0 || (i>0 && positions[i-1]>=p))) throw new Error("상담 장이 중복되거나 순서가 잘못되었습니다.");
  c.chapters.forEach(ch=>c.readingStyleVersion===3 ? validateSeasonedChapter(ch,ch.id,validIds,lifeSeasons) : c.readingStyleVersion===2 ? validatePlainChapter(ch,ch.id,validIds) : validateChapter(ch,ch.id,validIds));
  return c;
}
export function consultationSchema(id:ChapterId) {
  const definition=CHAPTERS.find(c=>c.id===id)!;
  return {type:"object",properties:{id:{type:"string",enum:[id]},title:{type:"string",enum:[definition.title]},summary:{type:"string",minLength:30,maxLength:180,description:"개인별 생활 특징과 조건을 바로 말하는 핵심 요약. 내용 소개, 추상적인 에너지 표현 금지."},sections:{type:"array",minItems:3,maxItems:4,items:{type:"object",properties:{heading:{type:"string"},text:{type:"string",minLength:280,maxLength:2200,description:"400~650자의 충분한 설명. 줄바꿈 2~3문단, 실제 서로 다른 개인별 근거 둘과 생활상황을 연결. 최소280자."},evidenceIds:{type:"array",minItems:2,maxItems:6,items:{type:"string"}},counterpoint:{type:"string",minLength:25},example:{type:"string",minLength:25},question:{type:"string",minLength:10},action:{type:"string",minLength:20}},required:["heading","text","evidenceIds","counterpoint","example","question","action"],additionalProperties:false}}},required:["id","title","summary","sections"],additionalProperties:false};
}
export function consultationPrompt(context:GeminiReadingContext,id:ChapterId,lifeSeasons?:LifeSeasonsReport) {
  const chapter=CHAPTERS.find(c=>c.id===id)!;
  return [
    "30년간 다양한 내담자를 상담해 온 역술가의 설명 방식과 판단 태도를 참고해, 눈앞의 한 사람에게 차분히 이야기하듯 한국어 존댓말로 풀이하세요. 분석은 긴 상담을 마친 뒤 건네는 기록처럼 깊게 쓰되, 당신 자신이 실제 사람이나 그런 경력을 가졌다고 사칭하지 마세요. 상담 시간을 보장하지 마세요.",
    `이번 장은 ${chapter.id}: ${CHAPTER_LABELS[id]}. 저장용 title은 ${chapter.title}로 고정합니다. 집중할 내용: ${chapter.focus}. 이 장만 작성하세요. 다른 장을 요약해 분량을 채우지 마세요.`,
    "3~4절을 작성합니다. 각 절 text는 한국어 400~650자를 목표로 충분히 풉니다(최소280자·2문단). 읽는 순서: 생활 속 상황 → 이 사람의 사주에서 그렇게 읽는 구체적 이유 둘 이상과 그 둘이 맞물리는 방식 → 살릴 점과 불편한 부담 → 다르게 나타날 조건 → 확인할 행동. 계산 자료를 나열하며 시작하지 마세요. 어떤 사주에도 맞는 일반론만 있으면 다시 쓰세요. 좋은 소리만 하거나 공포를 조장하지 마세요. 부담은 막연한 경고가 아니라 어느 관계·환경·선택에서 커지는지 말하세요.",
    "각 절 evidenceIds에는 아래 근거 목록의 서로 다른 ID 2~6개를 넣습니다. 같은 두 근거를 모든 절에서 반복하지 마세요. counterpoint에는 본 해석을 약하게 하거나 반대로 읽게 하는 실제 계산 조건, example에는 '예를 들어 ~한 상황이라면'으로 시작하는 가정 장면, question에는 이용자의 실제 경험을 확인하는 질문, action에는 그 답에 따라 달라질 구체적 실천을 적습니다. 각 필드를 같은 문장으로 반복하지 마세요.",
    "analysis.strength의 label을 존중하세요. 신강/신약은 성격·의지·신체 건강의 강약이 아닙니다. 수치는 서비스 휴리스틱 비교값이며 성공확률이 아닙니다. 경계·특수격이면 양쪽 근거를 설명하고 확정하지 마세요. pattern은 격국 후보이지 성격/파격 확정이 아닙니다. useful.status가 판정 보류이면 용신을 임의로 확정하지 마세요. 격국의 월령 용신과 억부의 균형 오행, 조후 관점을 혼용하지 마세요. 화/수의 계절 보완도 최종 용신이 아닙니다.",
    "한자는 반드시 한글 독음을 병기하고 전문용어는 첫 등장에 일상 말로 설명하세요. 합화/종격/파격·미래 사건을 지어내지 마세요. 현재 나이는 timeline.currentYear와 대운 나이 관계로 확인합니다. 미성년기는 배움·가족·또래 경험으로 읽고 성인 직장/투자를 가정하지 마세요. 과거는 확인 질문, 미래는 선택 조건으로 씁니다. 결혼·사망·질병·수익을 확정하지 마세요.",
    "시기 언급은 자료의 실제 연도와 간지를 그대로 사용합니다. 월운과 세운과 대운의 간지를 섞지 마세요. 년도만 보고 양력 1월부터 세운이 바뀐다고 하지 마세요. 판단 보류를 내용 없음으로 처리하지 말고 왜 두 해석이 갈리는지 상담처럼 설명하세요. '포함하지 않았습니다'라는 예전 안내를 복사하지 마세요. 서비스/AI/Gemini라는 표시는 본문에 넣지 않습니다.",
    "분량을 억지로 늘리는 반복, '균형을 유지하세요', '유연하게 대처하세요'로 끝나는 원론을 피하세요. 실제 사건을 들었다고 꾸미지 마세요. JSON만 출력하세요.",
    "강약을 피로·체력·번아웃·무기력·탈진·에너지 소진에 연결하는 문장을 쓰지 마세요. '에너지'처럼 추상적인 단어 자체도 쓰지 않습니다. 대신 지원 없이 책임이 늘어나는 구조, 발언권과 실제 권한의 차이, 본인 기준과 조직 평가의 충돌 등 해당 십성 조합이 만드는 구체적 관계로 설명하세요. 모든 장을 마감·완벽주의·문서화 조언으로 반복하지 말고 가정생활·배움·친구관계·금전 분담 등 그 장의 상황에 맞추세요. 투간/뿌리/합충이 실제 어느 자리에 있는지 정확히 구분하고 문장 오탈자를 점검하세요.",
    "가장 중요한 문체 규칙: 독자는 사주를 처음 보는 일반인입니다. 쉬운 말이 분석의 얕음을 뜻하지 않습니다. summary는 30~180자로 전문용어와 한자 없이 이번 장이 자기 생활에 어떤 뜻인지 적습니다. 절 제목도 생활 말로 씁니다. text는 여러 짧은 문단으로 나누고 문단 사이는 줄바꿈으로 구분합니다. 각 절의 첫 문장은 25~80자의 순수 생활 문장으로만 쓰세요. 예: '주변의 기대와 내 선택이 부딪힐 때, 무엇을 먼저 지킬지 고민하게 됩니다.' 첫 문장에 한자·대운 간지·일간·월지·격국·용신·십성 이름을 넣지 마세요. 두 번째 문단부터 계산 근거를 설명합니다. 전문용어를 세 개 이상 이어 붙이지 마세요. 필요한 용어는 바로 쉬운 뜻을 붙이세요. 예: 식신(꾸준히 만들고 익히는 성향), 재성(돈과 생활 자원을 다루는 관계), 용신(균형을 살필 때 도움이 될 수 있는 요소). 투간·득령·통근 같은 말을 독자가 이미 안다고 가정하지 마세요.",
    "쉬운 설명의 예: ‘식상이 재성을 생하므로 재물로 유통됩니다’ 대신 ‘익힌 기술을 실제 결과물로 내놓을 때 수입으로 이어질 가능성을 살펴봅니다. 다만 맡은 일이 늘어도 보상이 그대로라면 이 장점이 부담이 될 수 있어요.’처럼 풉니다. 예시 문장을 모든 사주에 복사하지 말고 이번 계산의 서로 다른 근거로 설명하세요. 반대 조건도 쉬운 말로 쓰고, 마지막 실천은 언제·누구와·무엇을 확인할지 보이게 합니다.",
    "쉬운 상담의 최종 작성 기준: summary는 전문 용어와 한자 없이 생활의 특징과 조건을 바로 말하세요. '살펴봅니다/다룹니다/비교합니다/확인합니다'처럼 장의 내용을 소개하면 실패입니다. 예: '익숙한 일을 더 낫게 바꾸는 데 관심이 갈 수 있어요. 다만 생활비를 안정적으로 마련해야 할 때는 새 시도를 작게 시작하는 편이 맞는지 생각해 보세요.' 각 절 text는 400~650자, 최소280자이고 2~3문단입니다. 첫 문장과 첫 문단은 사주 용어 없이 생활 이야기만 씁니다. 두 번째 문단에서 실제 근거 두 개를 쉬운 뜻과 함께 짚으세요. 기둥의 모든 한자를 나열하지 말고 필요한 이름만 쓰세요. 계산 설명이 생활 설명보다 길어지지 않게 합니다. 예시 문구는 해당 사주의 근거가 맞을 때만 참고하고 그대로 복사하지 마세요.",
    ...(id==="lifetime" && lifeSeasons ? ["이번 사람의 대운별 인생 4계절 계산 자료:\n"+JSON.stringify({method:lifeSeasons.method,current:lifeSeasons.current,periods:lifeSeasons.periods.map(p=>({startYear:p.startYear,endYear:p.endYear,startAge:p.startAge,endAge:p.endAge,ganji:p.ganji,korean:p.korean,season:p.seasonLabel,secondarySeason:p.secondarySeason,stemGod:p.stemGod,branchGod:p.branchGod,reason:p.reason}))}),`평생 운 장에서는 현재 ${lifeSeasons.current?.currentYear??lifeSeasons.periods[0]?.startYear}년과 현재 계절 ${lifeSeasons.current?.seasonLabel??"대운 시작 전"}을 본문에 정확히 쓰세요. 첫째 또는 둘째 절에서 현재 계절이 이 사람에게 뜻하는 생활 상황과 부담을 설명하고, 앞뒤 시기의 계절 이름도 직접 써서 무엇이 달라지는지 비교하세요. 계절은 고정 나이 구분이나 길흉 등급이 아니며, 반복되거나 건너뛸 수 있습니다. 실제 사건은 이용자에게 확인하고 그래프와 다른 계절을 임의로 만들지 마세요.`] : []),
    "검증된 계산 자료:\n"+JSON.stringify(context),
    "인용 가능한 근거 목록:\n"+JSON.stringify(consultationFacts(context)),
  ].join("\n\n");
}
