const productionUrl = "https://saju-service-steel.vercel.app/";

export function publicShareUrl(origin: string): string {
  const url = new URL(origin);
  return ["localhost", "127.0.0.1"].includes(url.hostname) ? productionUrl : `${url.origin}/`;
}

export function shareCopy(line: string, url: string): string {
  return `“${line}”\n\n나도 내 사주 한줄평 보기\n${url}`;
}

function wrappedLines(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const char of Array.from(text)) {
    const next = current + char;
    if (current && context.measureText(next).width > maxWidth) {
      lines.push(current.trim());
      current = char.trimStart();
    } else {
      current = next;
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

export async function renderDoryeongCard(line: string): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지를 만들 수 없습니다.");

  const sky = context.createLinearGradient(0, 0, 1080, 1350);
  sky.addColorStop(0, "#07132b");
  sky.addColorStop(.55, "#152d53");
  sky.addColorStop(1, "#334875");
  context.fillStyle = sky;
  context.fillRect(0, 0, 1080, 1350);

  for (let i = 0; i < 75; i++) {
    const x = 50 + (i * 383) % 980;
    const y = 42 + (i * 211) % 1210;
    context.beginPath();
    context.arc(x, y, i % 8 === 0 ? 3 : 1.4, 0, Math.PI * 2);
    context.fillStyle = i % 4 === 0 ? "#f4e5ad" : "#ffffffaa";
    context.fill();
  }

  // An illuminated path and lantern echo the landing artwork without loading private data.
  context.strokeStyle = "#e8bd72";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(190, 1170);
  context.lineTo(380, 1100);
  context.lineTo(710, 1090);
  context.lineTo(900, 1030);
  context.stroke();
  context.fillStyle = "#efcd8b";
  context.fillRect(810, 110, 68, 82);
  context.strokeStyle = "#a8783d";
  context.lineWidth = 5;
  context.strokeRect(810, 110, 68, 82);
  context.beginPath();
  context.moveTo(800, 110);
  context.lineTo(844, 86);
  context.lineTo(888, 110);
  context.stroke();

  context.strokeStyle = "#d9c99588";
  context.lineWidth = 2;
  context.strokeRect(54, 54, 972, 1242);
  context.fillStyle = "#0c1b37dd";
  context.fillRect(100, 306, 880, 738);

  context.textAlign = "center";
  context.fillStyle = "#e7d7ab";
  context.font = "700 33px sans-serif";
  context.fillText("내 길을 비추는 한마디", 540, 238);

  context.fillStyle = "#fff9ec";
  context.font = '700 62px "Batang", Georgia, serif';
  const lines = wrappedLines(context, `“${line}”`, 770);
  const lineHeight = 93;
  const firstBaseline = 675 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((part, index) => context.fillText(part, 540, firstBaseline + index * lineHeight));

  context.strokeStyle = "#dccb9a";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(400, 1135);
  context.lineTo(680, 1135);
  context.stroke();
  context.fillStyle = "#e7d7ab";
  context.font = "500 30px sans-serif";
  context.fillText("나의 대운, 나의 시간", 540, 1205);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("이미지를 저장할 수 없습니다.");
  return blob;
}
