import type { Mode } from "../lib/pipeline";

export interface Settings {
  mode: Mode;
  split: boolean;
  tolerance: number;
}

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  disabled?: boolean;
}

export default function Controls({ settings, onChange, disabled }: Props) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  return (
    <div className="controls">
      <div className="control-group">
        <span className="control-label">모드</span>
        <div className="seg">
          <button
            className={settings.mode === "general" ? "active" : ""}
            onClick={() => set({ mode: "general" })}
            disabled={disabled}
          >
            일반 (AI)
          </button>
          <button
            className={settings.mode === "pixel" ? "active" : ""}
            onClick={() => set({ mode: "pixel" })}
            disabled={disabled}
          >
            픽셀아트
          </button>
        </div>
      </div>

      <label className="control-group checkbox">
        <input
          type="checkbox"
          checked={settings.split}
          onChange={(e) => set({ split: e.target.checked })}
          disabled={disabled}
        />
        <span>요소 분리</span>
      </label>

      {settings.mode === "pixel" && (
        <div className="control-group">
          <span className="control-label">
            배경색 허용 오차 <b>{settings.tolerance}</b>
          </span>
          <input
            type="range"
            min={0}
            max={128}
            value={settings.tolerance}
            onChange={(e) => set({ tolerance: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
      )}

      <div className="controls-hint">
        {settings.mode === "general"
          ? "AI가 주요 객체를 인식해 배경 제거. 사진·일러스트·3D 렌더용."
          : "모서리 색상키 flood-fill + 하드 알파. 픽셀 칼각 보존, 단색 배경용."}
      </div>
    </div>
  );
}
