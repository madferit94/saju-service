import type { GeminiReadingContext } from "./gemini-reading";

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
export type ConsultationChapter = { id:ChapterId; title:string; sections:ConsultationSection[] };
export type Consultation = {version:1;analysisVersion:1;year:number;chapters:ConsultationChapter[]};

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
  for(const s of c.sections) {
    if(!s || !text(s.heading,3,100) || !text(s.text,160,2200) || !text(s.counterpoint,25,700) || !text(s.example,25,700) || !text(s.question,10,300) || !text(s.action,20,700)) throw new Error("각 절에 충분한 설명과 반대 조건·가정 예시·확인 질문·실천 항목을 작성해 주세요.");
    if(!Array.isArray(s.evidenceIds) || s.evidenceIds.length<2 || s.evidenceIds.length>6 || new Set(s.evidenceIds).size!==s.evidenceIds.length || s.evidenceIds.some(e=> typeof e!=="string" || !/^[a-z]+(?:_[a-z0-9]+)*$/.test(e) || (validIds && !validIds.includes(e)))) throw new Error("각 절은 제공된 서로 다른 근거 ID 2~6개만 인용해야 합니다.");
    if (/체력|번아웃|무기력|탈진|불면|질환|에너지/.test([s.text,s.counterpoint,s.example,s.question,s.action].join(" "))) throw new Error("강약을 체력·에너지 소진·건강 증상으로 설명하지 마세요. 역할·권한·지원·표현·자원 배분의 구체적 조건으로 다시 풀어 주세요.");
  }
  if(new Set(c.sections.map(s=>s.text.trim())).size!==c.sections.length) throw new Error("동일한 문단을 복제하지 마세요.");
  return c;
}
export function validateConsultation(value:unknown,validIds?:string[]):Consultation {
  if(!value || typeof value!=="object") throw new Error("상담 저장 형식이 올바르지 않습니다.");
  const c=value as Consultation;
  if(c.version!==1 || c.analysisVersion!==1 || !Number.isInteger(c.year) || c.year<1990 || c.year>2100 || !Array.isArray(c.chapters) || c.chapters.length>8) throw new Error("상담 저장 버전이나 연도가 올바르지 않습니다.");
  const positions=c.chapters.map(ch=>CHAPTERS.findIndex(def=>def.id===ch?.id));
  if(positions.some((p,i)=>p<0 || (i>0 && positions[i-1]>=p))) throw new Error("상담 장이 중복되거나 순서가 잘못되었습니다.");
  c.chapters.forEach(ch=>validateChapter(ch,ch.id,validIds));
  return c;
}
export function consultationSchema(id:ChapterId) {
  const definition=CHAPTERS.find(c=>c.id===id)!;
  return {type:"object",properties:{id:{type:"string",enum:[id]},title:{type:"string",enum:[definition.title]},sections:{type:"array",minItems:3,maxItems:4,items:{type:"object",properties:{heading:{type:"string"},text:{type:"string"},evidenceIds:{type:"array",minItems:2,maxItems:6,items:{type:"string"}},counterpoint:{type:"string"},example:{type:"string"},question:{type:"string"},action:{type:"string"}},required:["heading","text","evidenceIds","counterpoint","example","question","action"],additionalProperties:false}}},required:["id","title","sections"],additionalProperties:false};
}
export function consultationPrompt(context:GeminiReadingContext,id:ChapterId) {
  const chapter=CHAPTERS.find(c=>c.id===id)!;
  return [
    "당신은 명리학 상담을 글로 풀어주는 AI입니다. 30년 경력의 역술가에게 2시간 이상 깊이 상담받는 듯한 분석 밀도와 솔직함을 지향합니다. 실제 경력·상담시간·신통력을 사칭하지 마세요. 한국어 존댓말로 바로 이용자에게 설명하세요.",
    `이번 장은 ${chapter.id}: ${chapter.title}. 집중할 내용: ${chapter.focus}. 이 장만 작성하세요. 다른 장을 요약해 분량을 채우지 마세요.`,
    "3~4절을 작성합니다. 각 절 text는 한국어 300~500자를 목표로 충분히 풉니다(최소160자). 구조: 정확한 원국/시기 근거 둘 이상 → 이 둘이 함께 작용하는 이유 → 강점과 부담의 갈림길 → 현실에서 관찰할 신호. 어떤 사주에도 맞는 일반론만 있으면 다시 쓰세요. 좋은 소리만 하거나 공포를 조장하지 마세요.",
    "각 절 evidenceIds에는 아래 근거 목록의 서로 다른 ID 2~6개를 넣습니다. 같은 두 근거를 모든 절에서 반복하지 마세요. counterpoint에는 본 해석을 약하게 하거나 반대로 읽게 하는 실제 계산 조건, example에는 '예를 들어 ~한 상황이라면'으로 시작하는 가정 장면, question에는 이용자의 실제 경험을 확인하는 질문, action에는 그 답에 따라 달라질 구체적 실천을 적습니다. 각 필드를 같은 문장으로 반복하지 마세요.",
    "analysis.strength의 label을 존중하세요. 신강/신약은 성격·의지·신체 건강의 강약이 아닙니다. 수치는 서비스 휴리스틱 비교값이며 성공확률이 아닙니다. 경계·특수격이면 양쪽 근거를 설명하고 확정하지 마세요. pattern은 격국 후보이지 성격/파격 확정이 아닙니다. useful.status가 판정 보류이면 용신을 임의로 확정하지 마세요. 격국의 월령 용신과 억부의 균형 오행, 조후 관점을 혼용하지 마세요. 화/수의 계절 보완도 최종 용신이 아닙니다.",
    "한자는 반드시 한글 독음을 병기하고 전문용어는 첫 등장에 일상 말로 설명하세요. 합화/종격/파격·미래 사건을 지어내지 마세요. 현재 나이는 timeline.currentYear와 대운 나이 관계로 확인합니다. 미성년기는 배움·가족·또래 경험으로 읽고 성인 직장/투자를 가정하지 마세요. 과거는 확인 질문, 미래는 선택 조건으로 씁니다. 결혼·사망·질병·수익을 확정하지 마세요.",
    "시기 언급은 자료의 실제 연도와 간지를 그대로 사용합니다. 월운과 세운과 대운의 간지를 섞지 마세요. 년도만 보고 양력 1월부터 세운이 바뀐다고 하지 마세요. 판단 보류를 내용 없음으로 처리하지 말고 왜 두 해석이 갈리는지 상담처럼 설명하세요. '포함하지 않았습니다'라는 예전 안내를 복사하지 마세요. 서비스/AI/Gemini라는 표시는 본문에 넣지 않습니다.",
    "분량을 억지로 늘리는 반복, '균형을 유지하세요', '유연하게 대처하세요'로 끝나는 원론을 피하세요. 실제 사건을 들었다고 꾸미지 마세요. JSON만 출력하세요.",
    "강약을 피로·체력·번아웃·무기력·탈진·에너지 소진에 연결하는 문장을 쓰지 마세요. '에너지'처럼 추상적인 단어 자체도 쓰지 않습니다. 대신 지원 없이 책임이 늘어나는 구조, 발언권과 실제 권한의 차이, 본인 기준과 조직 평가의 충돌 등 해당 십성 조합이 만드는 구체적 관계로 설명하세요. 모든 장을 마감·완벽주의·문서화 조언으로 반복하지 말고 가정생활·배움·친구관계·금전 분담 등 그 장의 상황에 맞추세요. 투간/뿌리/합충이 실제 어느 자리에 있는지 정확히 구분하고 문장 오탈자를 점검하세요.",
    "검증된 계산 자료:\n"+JSON.stringify(context),
    "인용 가능한 근거 목록:\n"+JSON.stringify(consultationFacts(context)),
  ].join("\n\n");
}
