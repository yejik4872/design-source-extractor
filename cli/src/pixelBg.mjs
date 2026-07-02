// 픽셀아트 전용 배경제거.
// - 이미 투명한 이미지: 알파를 이진화(하드)만 하고 통과 (픽셀 경계 보존)
// - 단색 배경: 가장자리에서 flood-fill 로 배경색과 연결된 영역만 제거 (안쪽 같은 색은 보존)
// - 결과 알파는 항상 0/255 하드 → 안티앨리어싱 없는 칼각 유지
// onnx 미사용(순수 sharp) 이라 같은 프로세스에서 실행해도 안전.
import sharp from "sharp";
import path from "path";
import { DEFAULTS } from "./config.mjs";

function colorClose(data, o, r, g, b, tol) {
  return (
    Math.abs(data[o] - r) <= tol &&
    Math.abs(data[o + 1] - g) <= tol &&
    Math.abs(data[o + 2] - b) <= tol
  );
}

/**
 * @returns {Promise<{path:string, method:string}>}
 */
export async function pixelRemoveBg(inputPath, tmpDir, {
  tolerance = DEFAULTS.pixelTolerance,
  forceColorKey = false,
} = {}) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const N = W * H;
  const outPath = path.join(tmpDir, "nobg.png");

  // 1) 이미 투명한 이미지인지 판단
  let transparent = 0;
  for (let i = 0; i < N; i++) if (data[i * 4 + 3] < 16) transparent++;
  const alreadyTransparent = transparent > N * 0.02;

  if (alreadyTransparent && !forceColorKey) {
    // 알파 이진화만 (반투명 가장자리 → 칼각)
    for (let i = 0; i < N; i++) data[i * 4 + 3] = data[i * 4 + 3] < 128 ? 0 : 255;
    await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    return { path: outPath, method: "기존 투명 유지 + 알파 이진화" };
  }

  // 2) 단색 배경: 가장자리 픽셀의 최빈 색을 배경색으로
  const counts = new Map();
  const sampleBorder = (x, y) => {
    const o = (y * W + x) * 4;
    const key = (data[o] << 16) | (data[o + 1] << 8) | data[o + 2];
    counts.set(key, (counts.get(key) || 0) + 1);
  };
  for (let x = 0; x < W; x++) { sampleBorder(x, 0); sampleBorder(x, H - 1); }
  for (let y = 0; y < H; y++) { sampleBorder(0, y); sampleBorder(W - 1, y); }
  let bgKey = 0, best = -1;
  for (const [k, c] of counts) if (c > best) { best = c; bgKey = k; }
  const br = (bgKey >> 16) & 0xff, bg = (bgKey >> 8) & 0xff, bb = bgKey & 0xff;

  // 3) 가장자리에서 flood-fill (배경색과 연결된 영역만 배경으로 마킹)
  const isBg = new Uint8Array(N);
  const stack = [];
  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const idx = y * W + x;
    if (isBg[idx]) return;
    if (colorClose(data, idx * 4, br, bg, bb, tolerance)) {
      isBg[idx] = 1;
      stack.push(idx);
    }
  };
  for (let x = 0; x < W; x++) { tryPush(x, 0); tryPush(x, H - 1); }
  for (let y = 0; y < H; y++) { tryPush(0, y); tryPush(W - 1, y); }
  while (stack.length) {
    const idx = stack.pop();
    const x = idx % W, y = (idx - x) / W;
    tryPush(x - 1, y); tryPush(x + 1, y); tryPush(x, y - 1); tryPush(x, y + 1);
  }

  // 4) 하드 알파 적용
  let removed = 0;
  for (let i = 0; i < N; i++) {
    if (isBg[i]) { data[i * 4 + 3] = 0; removed++; }
    else data[i * 4 + 3] = 255;
  }
  await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  const pct = ((removed / N) * 100).toFixed(0);
  return { path: outPath, method: `색상키 flood-fill (배경 #${bgKey.toString(16).padStart(6, "0")}, ${pct}% 제거)` };
}
