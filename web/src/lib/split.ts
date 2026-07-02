// 요소 분리 (CLI cli/src/split.mjs 의 브라우저 이식판).
// connected-component labeling(반복 스택 flood fill)로 서로 떨어진 요소를 잘라낸다.
// 브라우저판은 풀해상도에서 바로 라벨링 → 라벨맵 업스케일이 불필요(=CLI의 3채널 버그 원천 제거).

export interface SplitOptions {
  alphaThreshold?: number; // 이 알파값 초과 = 객체 (기본 25)
  minAreaRatio?: number; // 전체 객체 대비 이 비율 미만 덩어리는 노이즈로 무시 (기본 0.004)
  padding?: number; // 잘라낸 요소 여백 px (기본 8)
  connectivity8?: boolean; // 8방향 연결 (기본 true)
}

export interface SplitPart {
  imageData: ImageData;
  width: number;
  height: number;
}

interface Components {
  labels: Int32Array;
  count: number;
  areas: number[];
  bbox: (null | { minX: number; minY: number; maxX: number; maxY: number })[];
}

function labelComponents(
  mask: Uint8Array,
  w: number,
  h: number,
  connectivity8: boolean
): Components {
  const labels = new Int32Array(w * h);
  const areas: number[] = [0]; // index 0 = 배경
  const bbox: Components["bbox"] = [null];
  let current = 0;
  const stack: number[] = [];

  const neigh8 = [-1, 1, -w, w, -w - 1, -w + 1, w - 1, w + 1];
  const neigh4 = [-1, 1, -w, w];
  const neigh = connectivity8 ? neigh8 : neigh4;

  for (let start = 0; start < w * h; start++) {
    if (mask[start] === 0 || labels[start] !== 0) continue;
    current++;
    let area = 0;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    stack.length = 0;
    stack.push(start);
    labels[start] = current;

    while (stack.length) {
      const idx = stack.pop()!;
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
        const nx = n % w;
        if (Math.abs(nx - x) > 1) continue; // 가로 경계 넘는 이웃 방지
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

export function splitElements(src: ImageData, opts: SplitOptions = {}): SplitPart[] {
  const {
    alphaThreshold = 25,
    minAreaRatio = 0.004,
    padding = 8,
    connectivity8 = true,
  } = opts;

  const W = src.width;
  const H = src.height;
  const data = src.data;

  // 1) 알파 이진 마스크 (풀해상도)
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = data[i * 4 + 3] > alphaThreshold ? 1 : 0;

  // 2) 연결 컴포넌트 라벨링
  const { labels, count, areas, bbox } = labelComponents(mask, W, H, connectivity8);

  // 3) 유효 컴포넌트 필터 + 좌→우 정렬
  const totalArea = areas.reduce((a, b) => a + b, 0);
  const minArea = totalArea * minAreaRatio;
  const comps: { id: number; bbox: NonNullable<Components["bbox"][number]> }[] = [];
  for (let c = 1; c <= count; c++) {
    if (areas[c] < minArea) continue;
    comps.push({ id: c, bbox: bbox[c]! });
  }
  comps.sort((a, b) => a.bbox.minX - b.bbox.minX);

  // 4) 컴포넌트별 크롭 + 해당 라벨 픽셀만 남기기
  const parts: SplitPart[] = [];
  for (const comp of comps) {
    const x0 = Math.max(0, comp.bbox.minX - padding);
    const y0 = Math.max(0, comp.bbox.minY - padding);
    const x1 = Math.min(W, comp.bbox.maxX + 1 + padding);
    const y1 = Math.min(H, comp.bbox.maxY + 1 + padding);
    const cw = x1 - x0;
    const ch = y1 - y0;
    if (cw <= 0 || ch <= 0) continue;

    const out = new Uint8ClampedArray(cw * ch * 4);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const sIdx = (y0 + y) * W + (x0 + x);
        if (labels[sIdx] === comp.id) {
          const s = sIdx * 4;
          const d = (y * cw + x) * 4;
          out[d] = data[s];
          out[d + 1] = data[s + 1];
          out[d + 2] = data[s + 2];
          out[d + 3] = data[s + 3];
        } // 그 외는 투명(0,0,0,0)
      }
    }
    parts.push({ imageData: new ImageData(out, cw, ch), width: cw, height: ch });
  }

  return parts;
}
