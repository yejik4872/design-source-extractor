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
      <div className="dropzone-icon">🖼️</div>
      <div className="dropzone-title">이미지를 여기로 드래그하거나 클릭해서 선택</div>
      <div className="dropzone-sub">PNG · JPG · WebP · 여러 장 가능 · 브라우저에서 바로 처리(서버 전송 없음)</div>
    </div>
  );
}
