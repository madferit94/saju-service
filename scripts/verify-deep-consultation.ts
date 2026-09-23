import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CHAPTERS, READING_STYLE_VERSION, validateSeasonedChapter, type ConsultationChapter } from "../lib/saju/consultation";

async function main() {
  const input = { date:"1994-12-01",time:"08:37",calendar:"solar",topic:"general",birthplace:{countryCode:"KR",countryName:"대한민국",city:"Seoul",province:"Seoul",timezone:"Asia/Seoul",longitude:126.978}};
  const chapters:ConsultationChapter[]=[];
  const target=join(tmpdir(),`saju-consultation-readable-v${READING_STYLE_VERSION}-synthetic-20260923-r2.json`);
  const previous = existsSync(target) ? JSON.parse(readFileSync(target,"utf8")).chapters as ConsultationChapter[] : [];
  for(const definition of CHAPTERS) {
    if(process.argv.length>2 && !process.argv.slice(2).includes(definition.id)) continue;
    const cached = previous.find(c=>c.id===definition.id);
    if(cached) {
      try { validateSeasonedChapter(cached,definition.id); chapters.push(cached); console.log(JSON.stringify({id:definition.id,revalidated:true})); continue; } catch { /* Only regenerate concrete validation failures. */ }
    }
    const response=await fetch("http://localhost:3000/api/consultation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({consent:true,input,yunGender:0,fortuneYear:2026,chapterId:definition.id})});
    const body=await response.json();
    if(!response.ok) {console.log(JSON.stringify({id:definition.id,status:response.status,error:body.error}));process.exitCode=1;break;}
    const chapter=validateSeasonedChapter(body.chapter,definition.id);
    chapters.push(chapter);
    writeFileSync(target,JSON.stringify({version:1,analysisVersion:1,readingStyleVersion:READING_STYLE_VERSION,year:2026,chapters},null,2));
    console.log(JSON.stringify({id:chapter.id,status:response.status,sections:chapter.sections.length,bodyLengths:chapter.sections.map(s=>s.text.length),totalChars:JSON.stringify(chapter).length,firstHeading:chapter.sections[0].heading}));
  }
  writeFileSync(target,JSON.stringify({version:1,analysisVersion:1,readingStyleVersion:READING_STYLE_VERSION,year:2026,chapters},null,2));
  console.log(JSON.stringify({completed:chapters.length,target}));
}
main().catch(error=>{console.error(error instanceof Error ? error.message:"Failed");process.exitCode=1;});
