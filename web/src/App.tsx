import { useState } from "react";
import Dropzone from "./components/Dropzone";
import Controls, { type Settings } from "./components/Controls";
import PromptGuide from "./components/PromptGuide";
import ResultCard from "./components/ResultCard";
import { processImage, revokeResult, type ProcessResult } from "./lib/pipeline";
import "./App.css";

interface Status {
  busy: boolean;
  label: string;
}

export default function App() {
  const [settings, setSettings] = useState<Settings>({
    mode: "general",
    split: true,
    upscaleParts: true,
    upscaleScale: 4,
    tolerance: 32,
  });
  const [results, setResults] = useState<ProcessResult[]>([]);
  const [status, setStatus] = useState<Status>({ busy: false, label: "" });

  async function handleFiles(files: File[]) {
    setStatus({ busy: true, label: "준비 중…" });
    const collected: ProcessResult[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const prefix = files.length > 1 ? `[${i + 1}/${files.length}] ` : "";
        const res = await processImage(file, {
          mode: settings.mode,
          split: settings.split,
          upscaleParts: settings.upscaleParts,
          upscaleScale: settings.upscaleScale,
          tolerance: settings.tolerance,
          onProgress: (stage, ratio) =>
            setStatus({
              busy: true,
              label: `${prefix}${file.name} — ${stage}${
                ratio !== undefined ? ` ${Math.round(ratio * 100)}%` : ""
              }`,
            }),
        });
        collected.push(res);
        setResults((prev) => [res, ...prev]);
      }
    } catch (e) {
      console.error(e);
      setStatus({ busy: false, label: `오류: ${(e as Error).message}` });
      return;
    }
    setStatus({ busy: false, label: `완료 — ${collected.length}장 처리됨` });
  }

  function clearAll() {
    results.forEach(revokeResult);
    setResults([]);
    setStatus({ busy: false, label: "" });
  }

  return (
    <div className="app">
      <header className="app-head">
        <span className="badge">
          <span className="badge-dot" />
          100% 브라우저 처리 · 서버 전송 없음
        </span>
        <h1>
          배경은 지우고,
          <br />
          소스만 <span className="hl">싹둑</span>
        </h1>
        <p>
          AI 생성 이미지·픽셀아트의 배경을 제거하고 요소별로 분리합니다.
          모든 처리가 브라우저 안에서 끝나 이미지가 어디로도 전송되지 않아요.
        </p>
      </header>

      <Controls settings={settings} onChange={setSettings} disabled={status.busy} />

      <PromptGuide mode={settings.mode} />

      <Dropzone onFiles={handleFiles} disabled={status.busy} />

      {status.label && (
        <div className={`status${status.busy ? " busy" : ""}`}>
          {status.busy && <span className="spinner" />}
          {status.label}
        </div>
      )}

      {results.length > 0 && (
        <div className="results-head">
          <span>{results.length}개 결과</span>
          <button className="link" onClick={clearAll} disabled={status.busy}>
            전체 지우기
          </button>
        </div>
      )}

      <div className="results">
        {results.map((r, i) => (
          <ResultCard key={i} result={r} />
        ))}
      </div>

      <footer className="app-foot">
        일반 모드 배경제거 모델은 최초 1회 다운로드됩니다 · 처리·저장 모두 로컬(브라우저)에서 수행
      </footer>
    </div>
  );
}
