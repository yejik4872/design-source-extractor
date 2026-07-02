// 결과를 한눈에 보는 HTML 미리보기 + 메타데이터 JSON 생성
import fs from "fs/promises";
import path from "path";

const CHECKER =
  "background-image:linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0;";

/**
 * @param {Array} items 각 이미지 처리 결과 [{name, full, parts:[{file,width,height}], method}]
 */
export async function writePreview(outputRoot, items) {
  const rel = (p) => path.relative(outputRoot, p).split(path.sep).join("/");

  const cards = items
    .map((it) => {
      const parts = it.parts
        .map(
          (p, i) => `
        <figure class="part">
          <div class="thumb" style="${CHECKER}"><img src="${rel(p.file)}" loading="lazy"></div>
          <figcaption>part-${i + 1} · ${p.width}×${p.height}
            <a download href="${rel(p.file)}">↓</a></figcaption>
        </figure>`
        )
        .join("");
      return `
      <section class="card">
        <header>
          <h2>${it.name}</h2>
          <span class="meta">업스케일: ${it.method} · 요소 ${it.parts.length}개</span>
        </header>
        <div class="full" style="${CHECKER}"><img src="${rel(it.full)}" loading="lazy"></div>
        <div class="parts">${parts}</div>
      </section>`;
    })
    .join("");

  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Design Source Extractor — 결과</title>
<style>
  :root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
  body{margin:0;background:#0f1115;color:#e6e8eb;padding:24px}
  h1{font-size:20px;margin:0 0 4px}
  .sub{color:#9aa0a6;font-size:13px;margin-bottom:24px}
  .card{background:#1a1d23;border:1px solid #2a2e36;border-radius:14px;padding:18px;margin-bottom:20px}
  .card header{display:flex;align-items:baseline;gap:12px;margin-bottom:12px;flex-wrap:wrap}
  .card h2{font-size:16px;margin:0}
  .meta{color:#9aa0a6;font-size:12px}
  .full{border-radius:10px;overflow:hidden;max-height:320px;display:flex;align-items:center;justify-content:center;padding:8px}
  .full img{max-width:100%;max-height:300px;object-fit:contain}
  .parts{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px}
  .part{margin:0;background:#12151a;border:1px solid #2a2e36;border-radius:10px;padding:8px;width:150px}
  .thumb{height:120px;border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden}
  .thumb img{max-width:100%;max-height:110px;object-fit:contain}
  figcaption{font-size:11px;color:#9aa0a6;margin-top:6px;display:flex;justify-content:space-between;align-items:center}
  figcaption a{color:#5b9dff;text-decoration:none;font-size:14px}
</style></head><body>
<h1>🎨 Design Source Extractor</h1>
<div class="sub">총 ${items.length}개 이미지 · 생성 결과는 각 이미지 폴더의 full.png / part-*.png 입니다</div>
${cards}
</body></html>`;

  const htmlPath = path.join(outputRoot, "preview.html");
  await fs.writeFile(htmlPath, html, "utf8");

  const manifest = items.map((it) => ({
    name: it.name,
    upscaleMethod: it.method,
    full: rel(it.full),
    parts: it.parts.map((p, i) => ({ id: i + 1, file: rel(p.file), width: p.width, height: p.height })),
  }));
  await fs.writeFile(path.join(outputRoot, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  return htmlPath;
}
