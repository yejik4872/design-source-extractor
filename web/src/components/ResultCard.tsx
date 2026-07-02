import type { ProcessResult } from "../lib/pipeline";

interface Props {
  result: ProcessResult;
}

function download(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function ResultCard({ result }: Props) {
  const { name, method, full, parts } = result;

  return (
    <section className="card">
      <header className="card-head">
        <h2>{name}</h2>
        <span className="meta">
          {method} · 요소 {parts.length}개
        </span>
      </header>

      <div className="full-row">
        <div className="thumb checker large">
          <img src={full.url} alt={`${name} 배경제거 결과`} loading="lazy" />
        </div>
        <div className="full-info">
          <div className="dim">
            {full.width}×{full.height}
          </div>
          <button
            className="btn"
            onClick={() => download(full.url, `${name}_nobg.png`)}
          >
            전체 PNG 다운로드
          </button>
        </div>
      </div>

      {parts.length > 0 && (
        <div className="parts">
          {parts.map((p, i) => (
            <figure className="part" key={i}>
              <div className="thumb checker">
                <img src={p.url} alt={`${name} 요소 ${i + 1}`} loading="lazy" />
              </div>
              <figcaption>
                <span>
                  part-{i + 1} · {p.width}×{p.height}
                </span>
                <button
                  className="link"
                  onClick={() => download(p.url, `${name}_part-${i + 1}.png`)}
                >
                  ↓
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
