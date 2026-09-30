"use client";

import { useState } from "react";
import { publicShareUrl, renderDoryeongCard, shareCopy } from "../lib/share/doryeong-card";

export default function DoryeongShareCard({ line }: { line: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function saveImage() {
    setBusy(true);
    setMessage("카드 이미지를 만드는 중입니다…");
    try {
      const blob = await renderDoryeongCard(line);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "도령의-사주-한줄평.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setMessage("이미지 다운로드를 시작했습니다. 브라우저 다운로드 목록에서 확인해 주세요.");
    } catch {
      setMessage("이미지를 만들지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    setMessage("공유할 내용을 준비하고 있습니다…");
    const url = publicShareUrl(window.location.origin);
    const text = shareCopy(line, url);
    try {
      const localPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);
      if (navigator.share && !localPreview) {
        let files: File[] | undefined;
        if (navigator.canShare) {
          try {
            const blob = await renderDoryeongCard(line);
            const file = new File([blob], "도령의-사주-한줄평.png", { type: "image/png" });
            if (navigator.canShare({ files: [file] })) files = [file];
          } catch {
            // 이미지 공유가 안 되는 기기에서는 문장과 주소를 공유합니다.
          }
        }
        await navigator.share({ title: "도령의 사주 한줄평", text: `“${line}”\n\n나도 내 사주 한줄평 보기`, url, ...(files ? { files } : {}) });
        setMessage("공유 창을 열었습니다.");
        return;
      }
      await navigator.clipboard.writeText(text);
      setMessage("한줄평과 사이트 주소를 복사했습니다. 원하는 곳에 붙여넣으세요.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessage("공유를 취소했습니다.");
      } else {
        setMessage("공유하지 못했습니다. 이미지 저장 버튼을 이용해 주세요.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="doryeong-share" aria-label="도령 한줄평 공유 카드">
      <div className="doryeong-share-preview" aria-label={`공유 카드 미리보기: ${line}`}>
        <span className="doryeong-share-heading">별빛 도령의 한마디</span>
        <p>“{line}”</p>
        <span className="doryeong-share-brand">나의 대운, 나의 시간</span>
      </div>
      <p className="doryeong-share-help">카드에는 한줄평만 담깁니다. 생년월일과 출생지는 포함되지 않습니다.</p>
      <div className="doryeong-share-actions">
        <button type="button" onClick={share} disabled={busy}>{busy ? "준비 중…" : "한줄평 공유하기"}</button>
        <button type="button" className="doryeong-share-save" onClick={saveImage} disabled={busy}>카드 이미지 저장</button>
      </div>
      {message && <p className="doryeong-share-message" role="status">{message}</p>}
    </section>
  );
}
