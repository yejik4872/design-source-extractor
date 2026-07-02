import { useState } from "react";
import type { Mode } from "../lib/pipeline";

interface Tip {
  title: string;
  desc: string;
}

interface GuideData {
  intro: string;
  tips: Tip[];
  prompts: { label: string; text: string }[];
}

const GUIDES: Record<Mode, GuideData> = {
  general: {
    intro: "사진·일러스트·3D 렌더를 만들 때, 아래처럼 요청하면 배경제거·요소분리가 깔끔해집니다.",
    tips: [
      { title: "단색 배경", desc: "흰색·회색 같은 단일 배경에 올려달라고 요청 → AI가 객체를 또렷이 구분" },
      { title: "요소는 띄워서", desc: "여러 개면 서로 겹치지 않게 간격을 둬야 요소별로 분리됨" },
      { title: "그림자·반사 없이", desc: "드롭섀도/반사가 배경에 번지면 가장자리가 지저분해짐" },
      { title: "중앙 + 여백", desc: "피사체를 중앙에, 주변에 여백을 두면 잘림 없이 추출" },
    ],
    prompts: [
      {
        label: "기본 (단일 피사체 추출용) — 프롬프트 뒤에 붙이기",
        text: ", a single subject isolated on a plain solid light-gray background, centered with generous margin, no drop shadow, no reflection, clean high-contrast edges",
      },
      {
        label: "요소 분리까지 원할 때 (여러 개 배치)",
        text: ", multiple separate objects arranged with clear empty space between them, no overlapping, on a plain solid background, no shadows",
      },
    ],
  },
  pixel: {
    intro: "픽셀아트를 만들 때, 배경을 '단색'으로 지정하면 색상키 제거가 완벽하게 됩니다.",
    tips: [
      { title: "단색 배경 1가지 색", desc: "배경은 스프라이트에 안 쓰는 색으로 (예: 마젠타 #ff00ff)" },
      { title: "안티앨리어싱 없이", desc: "가장자리 흐림 없이 선명한 픽셀로 요청해야 칼각 유지" },
      { title: "투명 배경이면 더 좋음", desc: "가능하면 투명 배경으로. 안 되면 단색 배경 후 이 도구로 제거" },
    ],
    prompts: [
      {
        label: "픽셀아트 스프라이트 — 프롬프트에 포함",
        text: "pixel art sprite of [주제], on a solid flat magenta (#ff00ff) background not used anywhere in the subject, no anti-aliasing, crisp hard pixel edges, no gradients, no shadow",
      },
    ],
  },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard 권한 없을 때 무시 */
        }
      }}
    >
      {copied ? "복사됨 ✓" : "복사"}
    </button>
  );
}

export default function PromptGuide({ mode }: { mode: Mode }) {
  const [open, setOpen] = useState(false);
  const guide = GUIDES[mode];

  return (
    <div className="guide">
      <button className="guide-toggle" onClick={() => setOpen((o) => !o)}>
        <span>💡 배경제거 잘 되는 이미지 만드는 프롬프트 가이드</span>
        <span className="guide-mode">{mode === "general" ? "일반" : "픽셀아트"}</span>
        <span className={`chevron${open ? " up" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="guide-body">
          <p className="guide-intro">{guide.intro}</p>

          <ul className="guide-tips">
            {guide.tips.map((t, i) => (
              <li key={i}>
                <b>{t.title}</b> — {t.desc}
              </li>
            ))}
          </ul>

          <div className="guide-prompts">
            {guide.prompts.map((p, i) => (
              <div className="prompt-item" key={i}>
                <div className="prompt-label">
                  <span>{p.label}</span>
                  <CopyButton text={p.text} />
                </div>
                <code className="prompt-text">{p.text}</code>
              </div>
            ))}
          </div>

          <p className="guide-note">
            ※ 이미 압축·열화된 이미지(웹에서 캡처한 저화질 등)는 배경제거 대상이 아니에요.
            생성 단계부터 위처럼 만들면 가장 깨끗합니다.
          </p>
        </div>
      )}
    </div>
  );
}
