// 요소 분리 단계: 배경제거된 알파 채널의 연결 덩어리(connected components)를 찾아
// 요소별 고화질 투명 PNG로 잘라낸다. (서로 떨어진 요소에 대해 동작; 겹친 요소는 v2 SAM 필요)
import sharp from "sharp";
import path from "path";
import { DEFAULTS } from "./config.mjs";

/**
 * 다운샘플된 이진 마스크에서 연결 컴포넌트 라벨링(반복 스택 flood fill).
 * @returns {{labels:Int32Array, count:number, areas:number[], bbox:Array}}
 */
function labelComponents(mask, w, h, connectivity8) {
  const labels = new Int32Array(w * h).fill(0);
  const areas = [0]; // index 0 = 배경
  const bbox = [null];
  let current = 0;
  const stack = [];

  const neigh8 = [-1, 1, -w, w, -w - 1, -w + 1, w - 1, w + 1];
  const neigh4 = [-1, 1, -w, w];
  const neigh = connectivity8 ? neigh8 : neigh4;

  for (let start = 0; start < w * h; start++) {
    if (mask[start] === 0 || labels[start] !== 0) continue;
    current++;
    let area = 0;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    stack.length = 0;
    stack.push(start);
    labels[start] = current;

    while (stack.length) {
      const idx = stack.pop();
      const x = idx % w;
      const y = (idx - x) / w;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      for (const d of neigh) {
        const n = idx + d;
        if (n < 0 || n >= w * h) continue;
        // 가로 경계 넘어가는 이웃 방지
        const nx = n % w;
        if (Math.abs(nx - x) > 1) continue;
        if (mask[n] !== 0 && labels[n] === 0) {
          labels[n] = current;
          stack.push(n);
        }
      }
    }
    areas.push(area);
    bbox.push({ minX, minY, maxX, maxY });
  }
  return { labels, count: current, areas, bbox };
}

/**
 * 배경제거된 PNG를 요소별로 분리하여 저장.
 * @returns {Promise<Array<{file:string, width:number, height:number}>>}
 */
export async function splitElements(nobgPath, outDir, opts = {}) {
  const {
    alphaThreshold = DEFAULTS.alphaThreshold,
    workingMax = DEFAULTS.splitWorkingMax,
    minAreaRatio = DEFAULTS.minAreaRatio,
    padding = DEFAULTS.padding,
    connectivity8 = DEFAULTS.connectivity8,
  } = opts;

  const img = sharp(nobgPath).ensureAlpha();
  const meta = await img.metadata();
  const W = meta.width, H = meta.height;

  // 1) 분석용 다운샘플 알파 마스크 만들기
  const scale = Math.min(1, workingMax / Math.max(W, H));
  const ww = Math.max(1, Math.round(W * scale));
  const wh = Math.max(1, Math.round(H * scale));
  const { data: smallAlpha } = await sharp(nobgPath)
    .ensureAlpha()
    .resize(ww, wh, { fit: "fill" })
    .extractChannel("alpha")
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mask = new Uint8Array(ww * wh);
  for (let i = 0; i < mask.length; i++) mask[i] = smallAlpha[i] > alphaThreshold ? 1 : 0;

  // 2) 연결 컴포넌트 라벨링
  const { labels, count, areas, bbox } = labelComponents(mask, ww, wh, connectivity8);

  // 3) 유효 컴포넌트 필터 (노이즈 제거) + 좌측→우측 정렬
  const totalArea = areas.reduce((a, b) => a + b, 0);
  const minArea = totalArea * minAreaRatio;
  let comps = [];
  for (let c = 1; c <= count; c++) {
    if (areas[c] < minArea) continue;
    comps.push({ id: c, area: areas[c], bbox: bbox[c] });
  }
  comps.sort((a, b) => a.bbox.minX - b.bbox.minX); // 읽는 순서(좌→우)

  // 4) 풀해상도 라벨맵 (nearest 업스케일) 준비 — 요소별 마스킹용
  //    유효 컴포넌트만 1..N 으로 재번호 (255 클램프로 인한 충돌 방지)
  const remap = new Int32Array(count + 1); // 원래 라벨 -> 새 라벨(0=노이즈/버림)
  comps.forEach((c, i) => {
    c.newId = i + 1;
    remap[c.id] = i + 1;
  });
  const labelU8 = new Uint8Array(ww * wh);
  for (let i = 0; i < labels.length; i++) labelU8[i] = remap[labels[i]] & 0xff;
  const { data: fullLabel } = await sharp(Buffer.from(labelU8), {
    raw: { width: ww, height: wh, channels: 1 },
  })
    .resize(W, H, { kernel: "nearest" })
    .extractChannel(0) // resize 가 1ch→3ch 로 확장하므로 첫 채널만 다시 추출 (값 동일)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 원본 RGBA 픽셀
  const { data: rgba } = await img.raw().toBuffer({ resolveWithObject: true });

  const results = [];
  const invScale = 1 / scale;

  for (let n = 0; n < comps.length; n++) {
    const comp = comps[n];
    // 풀해상도 bbox + 패딩
    let x0 = Math.max(0, Math.floor(comp.bbox.minX * invScale) - padding);
    let y0 = Math.max(0, Math.floor(comp.bbox.minY * invScale) - padding);
    let x1 = Math.min(W, Math.ceil((comp.bbox.maxX + 1) * invScale) + padding);
    let y1 = Math.min(H, Math.ceil((comp.bbox.maxY + 1) * invScale) + padding);
    const cw = x1 - x0, ch = y1 - y0;
    if (cw <= 0 || ch <= 0) continue;

    // 해당 컴포넌트 픽셀만 남긴 RGBA 크롭 버퍼 생성
    const out = Buffer.alloc(cw * ch * 4);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const sx = x0 + x, sy = y0 + y;
        const sIdx = sy * W + sx;
        const dIdx = (y * cw + x) * 4;
        const srcRgba = sIdx * 4;
        if (fullLabel[sIdx] === comp.newId) {
          out[dIdx] = rgba[srcRgba];
          out[dIdx + 1] = rgba[srcRgba + 1];
          out[dIdx + 2] = rgba[srcRgba + 2];
          out[dIdx + 3] = rgba[srcRgba + 3];
        } // 그 외는 투명(0,0,0,0)
      }
    }

    const file = path.join(outDir, `part-${n + 1}.png`);
    await sharp(out, { raw: { width: cw, height: ch, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toFile(file);
    results.push({ file, width: cw, height: ch });
  }

  return results;
}
