import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { calculate, InputError, validateInput, type SajuInput } from "../../../lib/saju/chart";
import { calculateDaewoon } from "../../../lib/saju/daewoon";
import { calculateBenefactors } from "../../../lib/saju/benefactors";
import { createGeminiReadingContext } from "../../../lib/saju/gemini-reading";
import { CHAPTERS, consultationFacts, consultationPrompt, consultationSchema, validateChapter, type ChapterId } from "../../../lib/saju/consultation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;
const fail = (status:number,message:string) => NextResponse.json({error:{message}},{status,headers:{"Cache-Control":"no-store"}});

export async function POST(request:Request) {
  let body;
  try {
    const raw=await request.text();
    if(raw.length>24000) return fail(413,"요청이 너무 큽니다.");
    body=JSON.parse(raw);
  } catch { return fail(400,"요청 내용을 확인해 주세요."); }
  if(!body || typeof body!=="object" || body.consent!==true) return fail(400,"계산 정보 전송에 먼저 동의해 주세요.");
  if(!CHAPTERS.some(c=>c.id===body.chapterId) || ![0,1].includes(body.yunGender) || !Number.isInteger(body.fortuneYear) || body.fortuneYear<1990 || body.fortuneYear>2100) return fail(400,"상담 주제·계산 기준·연도를 확인해 주세요.");
  try {
    const input=validateInput(body.input as SajuInput);
    if(!input.birthplace) return fail(400,"태어난 국가와 도시를 선택해 주세요.");
    const apiKey=process.env.GEMINI_API_KEY?.trim();
    if(!apiKey) return fail(503,"Gemini API 키가 설정되지 않았습니다. 서버 설정을 확인해 주세요.");
    const chart=calculate(input), timeline=calculateDaewoon(input,body.yunGender);
    const context=createGeminiReadingContext(chart,timeline,calculateBenefactors(chart),body.fortuneYear);
    const chapterId=body.chapterId as ChapterId;
    const ai=new GoogleGenAI({apiKey,httpOptions:{timeout:90000}});
    let correction="";
    for(let attempt=0;attempt<2;attempt++) {
      const response=await ai.models.generateContent({model:"gemini-3.5-flash-lite",contents:consultationPrompt(context,chapterId)+correction,
        config:{abortSignal:request.signal,responseMimeType:"application/json",responseJsonSchema:consultationSchema(chapterId),maxOutputTokens:8192,temperature:.45}});
      try {
        const chapter=validateChapter(JSON.parse(response.text||"{}"),chapterId,consultationFacts(context).map(f=>f.id));
        return NextResponse.json({chapter,analysisVersion:1,year:body.fortuneYear},{headers:{"Cache-Control":"no-store"}});
      } catch(caught) {
        if(attempt===1) return fail(502,"이번 장의 설명이나 근거가 충분하지 않아 표시하지 않았습니다. 완성된 장은 유지되니 이어서 작성해 주세요.");
        correction="\n\n직전 응답 검증 오류: "+(caught instanceof Error ? caught.message : "형식 오류")+" 각 절의 본문은 최소160자, 반대 조건25자, 가정 예시25자, 질문10자, 행동20자 이상이며 서로 다른 실제 근거2개 이상이 필요합니다. 완전한 JSON을 다시 작성하세요.";
      }
    }
    return fail(502,"상담을 완성하지 못했습니다. 이어서 작성해 주세요.");
  } catch(caught) {
    if(caught instanceof InputError) return fail(400,caught.message);
    const error=caught as {status?:number;statusCode?:number;name?:string};
    const status=error?.status??error?.statusCode;
    if(status===402) return fail(402,"Gemini 사용 크레딧이 부족합니다. 사용 가능 크레딧과 결제 설정을 확인한 후 이어서 작성해 주세요.");
    if(status===429) return fail(429,"요청이 잠시 몰렸습니다. 조금 뒤 이어서 작성해 주세요.");
    if(status===401||status===403) return fail(503,"Gemini API 키의 사용 권한을 확인해 주세요.");
    if(error?.name==="AbortError"||error?.name==="TimeoutError") return fail(504,"이번 장의 작성 시간이 초과됐습니다. 완성된 장은 유지됩니다.");
    return fail(502,"상담 서비스에 연결하지 못했습니다. 완성된 장은 유지되니 잠시 후 이어서 작성해 주세요.");
  }
}
