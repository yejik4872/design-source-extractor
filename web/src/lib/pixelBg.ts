// 픽셀아트 배경제거 (CLI cli/src/pixelBg.mjs 의 브라우저 이식판).
// sharp raw buffer → Canvas ImageData 로만 바뀌었고 알고리즘은 동일:
// - 이미 투명: 알파 이진화만 하고 통과
// - 단색 배경: 모서리에서 flood-fill 로 배경색 연결 영역만 제거 (안쪽 동색 보존)
// - 결과 알파는 항상 0/255 하드

function colorClose(
  data: Uint8ClampedArray,
  o: number,
  r: number,
  g: number,
  b: number,
  tol: number
): boolean {
  return (
    Math.abs(data[o] - r) <= tol &&
    Math.abs(data[o + 1] - g) <= tol &&
    Math.abs(data[o + 2] - b) <= tol
  );
}

export interface PixelBgOptions {
  tolerance?: number; // 배경색 매칭 허용 오차 (기본 32)
  forceColorKey?: boolean; // 이미 투명해도 색상키 강제
}

export interface PixelBgResult {
  imageData: ImageData;
  method: string;
}

export function pixelRemoveBg(
  src: ImageData,
  { tolerance = 32, forceColorKey = false }: PixelBgOptions = {}
): PixelBgResult {
  const W = src.width;
  const H = src.height;
  const N = W * H;
  // 원본을 건드리지 않도록 복사
  const data = new Uint8ClampedArray(src.data);

  // 1) 이미 투명한 이미지인지 판단
  let transparent = 0;
  for (let i = 0; i < N; i++) if (data[i * 4 + 3] < 16) transparent++;
  const alreadyTransparent = transparent > N * 0.02;

  if (alreadyTransparent && !forceColorKey) {
    for (let i = 0; i < N; i++) data[i * 4 + 3] = data[i * 4 + 3] < 128 ? 0 : 255;
    return {
      imageData: new ImageData(data, W, H),
      method: "기존 투명 유지 + 알파 이진화",
    };
  }

  // 2) 단색 배경: 가장자리 최빈 색을 배경색으로
  const counts = new Map<number, number>();
  const sampleBorder = (x: number, y: number) => {
    const o = (y * W + x) * 4;
    const key = (data[o] << 16) | (data[o + 1] << 8) | data[o + 2];
    counts.set(key, (counts.get(key) || 0) + 1);
  };
  for (let x = 0; x < W; x++) {
    sampleBorder(x, 0);
    sampleBorder(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    sampleBorder(0, y);
    sampleBorder(W - 1, y);
  }
  let bgKey = 0;
  let best = -1;
  for (const [k, c] of counts) if (c > best) { best = c; bgKey = k; }
  const br = (bgKey >> 16) & 0xff;
  const bg = (bgKey >> 8) & 0xff;
  const bb = bgKey & 0xff;

  // 3) 가장자리에서 flood-fill
  const isBg = new Uint8Array(N);
  const stack: number[] = [];
  const tryPush = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const idx = y * W + x;
    if (isBg[idx]) return;
    if (colorClose(data, idx * 4, br, bg, bb, tolerance)) {
      isBg[idx] = 1;
      stack.push(idx);
    }
  };
  for (let x = 0; x < W; x++) {
    tryPush(x, 0);
    tryPush(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    tryPush(0, y);
    tryPush(W - 1, y);
  }
  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % W;
    const y = (idx - x) / W;
    tryPush(x - 1, y);
    tryPush(x + 1, y);
    tryPush(x, y - 1);
    tryPush(x, y + 1);
  }

  // 4) 하드 알파 적용
  let removed = 0;
  for (let i = 0; i < N; i++) {
    if (isBg[i]) {
      data[i * 4 + 3] = 0;
      removed++;
    } else {
      data[i * 4 + 3] = 255;
    }
  }
  const pct = ((removed / N) * 100).toFixed(0);
  return {
    imageData: new ImageData(data, W, H),
    method: `색상키 flood-fill (배경 #${bgKey.toString(16).padStart(6, "0")}, ${pct}% 제거)`,
  };
}
