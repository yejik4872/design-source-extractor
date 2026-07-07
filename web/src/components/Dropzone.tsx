import { useCallback, useRef, useState } from "react";

interface Props {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];

export default function Dropzone({ onFiles, disabled }: Props) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const files = Array.from(list).filter((f) => ACCEPT.includes(f.type));
      if (files.length) onFiles(files);
    },
    [onFiles]
  );

  return (
    <div
      className={`dropzone${over ? " over" : ""}${disabled ? " disabled" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) handle(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        multiple
        hidden
        onChange={(e) => handle(e.target.files)}
      />
      <div className="dropzone-icon">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="2" />
          <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2" />
          <line x1="20" y1="4" x2="8.12" y2="15.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="14.47" y1="14.48" x2="20" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="8.12" y1="9.12" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <div className="dropzone-title">이미지를 드래그하거나 클릭해서 선택</div>
      <div className="dropzone-sub">
        <span className="chip">PNG</span>
        <span className="chip">JPG</span>
        <span className="chip">WebP</span>
        <span className="chip">여러 장 가능</span>
      </div>
    </div>
  );
}
