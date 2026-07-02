// 요소 업스케일: UpscalerJS(ESRGAN, TensorFlow.js) 4x — 전부 브라우저 로컬 실행.
// ESRGAN은 RGB 전용이라, 알파(투명도)는 별도로 고품질 리샘플한 뒤 재합성한다.
// 투명 픽셀의 RGB(보통 검정)가 가장자리로 번지는 할로를 막기 위해
// 업스케일 전에 불투명 픽셀의 색을 투명 영역으로 번지게(bleed) 한다.
import Upscaler from "upscaler";
import x2 from "@upscalerjs/esrgan-medium/2x";
import x3 from "@upscalerjs/esrgan-medium/3x";
import x4 from "@upscalerjs/esrgan-medium/4x";
import { loadImage } from "./canvas";

export type UpscaleScale = 2 | 3 | 4;

const MODELS = { 2: x2, 3: x3, 4: x4 } as const;

// 배율별로 업스케일러 인스턴스를 캐시 (모델 가중치는 최초 사용 시 로드)
const upscalers = new Map<UpscaleScale, InstanceType<typeof Upscaler>>();
function getUpscaler(scale: UpscaleScale): InstanceType<typeof Upscaler> {
  let u = upscalers.get(scale);
  if (!u) {
    u = new Upscaler({ model: MODELS[scale] });
    upscalers.set(scale, u);
  }
  return u;
}

/** 이 크기(긴 변)보다 큰 요소는 이미 충분히 크다고 보고 AI 업스케일을 생략 */
export const MAX_SOURCE_EDGE = 1200;

/** 불투명 픽셀의 색을 투명 이웃으로 번지게 해 가장자리 검정 할로를 방지 */
function bleedEdges(
  src: ImageData,
  iterations = 8
): Uint8ClampedArray<ArrayBuffer> {
  const W = src.width;
  const H = src.height;
  // 길이로 할당해 ArrayBuffer 백킹을 보장 (ImageData 생성자 타입 호환)
  const data = new Uint8ClampedArray(src.data.length);
  data.set(src.data);
  // colored[i] = RGB가 유효한 픽셀 (불투명이거나 이미 번짐)
  const colored = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) colored[i] = data[i * 4 + 3] > 0 ? 1 : 0;

  const offsets = [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1];
  for (let iter = 0; iter < iterations; iter++) {
    const next = new Uint8Array(colored);
    let changed = false;
    for (let i = 0; i < W * H; i++) {
      if (colored[i]) continue;
      const x = i % W;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (const d of offsets) {
        const j = i + d;
        if (j < 0 || j >= W * H) continue;
        const jx = j % W;
        if (Math.abs(jx - x) > 1) continue;
        if (!colored[j]) continue;
        r += data[j * 4];
        g += data[j * 4 + 1];
        b += data[j * 4 + 2];
        n++;
      }
      if (n > 0) {
        data[i * 4] = r / n;
        data[i * 4 + 1] = g / n;
        data[i * 4 + 2] = b / n;
        next[i] = 1;
        changed = true;
      }
    }
    colored.set(next);
    if (!changed) break;
  }
  return data;
}

function toCanvas(imageData: ImageData): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = imageData.width;
  c.height = imageData.height;
  c.getContext("2d")!.putImageData(imageData, 0, 0);
  return c;
}

/**
 * ImageData를 지정 배율로 업스케일한다 (RGB=ESRGAN, 알파=고품질 리샘플).
 * 원본이 이미 충분히 크면(MAX_SOURCE_EDGE 초과) 원본을 그대로 반환한다.
 */
export async function upscaleImageData(
  src: ImageData,
  scale: UpscaleScale = 4,
  onProgress?: (ratio: number) => void
): Promise<{ imageData: ImageData; upscaled: boolean }> {
  const W = src.width;
  const H = src.height;
  if (Math.max(W, H) > MAX_SOURCE_EDGE) {
    return { imageData: src, upscaled: false };
  }

  // 1) 가장자리 색 번짐 후 불투명 RGB 캔버스 준비
  const bled = bleedEdges(src);
  for (let i = 0; i < W * H; i++) bled[i * 4 + 3] = 255; // 알파 제거(불투명)
  const rgbCanvas = toCanvas(new ImageData(bled, W, H));

  // 2) ESRGAN으로 RGB 업스케일 (patch 단위로 처리해 UI 프리즈 방지)
  const resultSrc = await getUpscaler(scale).execute(rgbCanvas, {
    patchSize: 64,
    padding: 2,
    progress: (rate: number) => onProgress?.(rate),
  });
  const upImg = await loadImage(resultSrc);
  const OW = W * scale;
  const OH = H * scale;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = OW;
  outCanvas.height = OH;
  const outCtx = outCanvas.getContext("2d", { willReadFrequently: true })!;
  outCtx.drawImage(upImg, 0, 0, OW, OH);
  const out = outCtx.getImageData(0, 0, OW, OH);

  // 3) 알파 채널: 원본 RGBA를 고품질 리샘플해서 알파만 추출
  const alphaCanvas = document.createElement("canvas");
  alphaCanvas.width = OW;
  alphaCanvas.height = OH;
  const alphaCtx = alphaCanvas.getContext("2d", { willReadFrequently: true })!;
  alphaCtx.imageSmoothingEnabled = true;
  alphaCtx.imageSmoothingQuality = "high";
  alphaCtx.drawImage(toCanvas(src), 0, 0, OW, OH);
  const alphaData = alphaCtx.getImageData(0, 0, OW, OH).data;

  // 4) 합성: RGB는 모델 출력, 알파는 리샘플 결과
  for (let i = 0; i < OW * OH; i++) out.data[i * 4 + 3] = alphaData[i * 4 + 3];

  return { imageData: out, upscaled: true };
}
