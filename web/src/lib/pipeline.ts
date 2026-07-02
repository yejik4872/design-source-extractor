// 전체 파이프라인 (브라우저판). CLI cli/src/pipeline.mjs 대응.
// 일반 모드:  @imgly 배경제거 → 요소분리
// 픽셀 모드:  색상키 flood-fill 배경제거 → 요소분리
import { blobToImageData, imageDataToBlob } from "./canvas";
import { removeBg } from "./removeBg";
import { pixelRemoveBg } from "./pixelBg";
import { splitElements, type SplitOptions } from "./split";

export type Mode = "general" | "pixel";

export interface ProcessOptions {
  mode: Mode;
  split?: boolean;
  tolerance?: number; // 픽셀 모드
  forceColorKey?: boolean; // 픽셀 모드
  splitOptions?: SplitOptions;
  onProgress?: (stage: string, ratio?: number) => void;
}

export interface ResultImage {
  url: string; // 미리보기/다운로드용 object URL
  blob: Blob;
  width: number;
  height: number;
}

export interface ProcessResult {
  name: string;
  method: string;
  full: ResultImage;
  parts: ResultImage[];
}

async function toResult(imageData: ImageData): Promise<ResultImage> {
  const blob = await imageDataToBlob(imageData);
  return {
    url: URL.createObjectURL(blob),
    blob,
    width: imageData.width,
    height: imageData.height,
  };
}

export async function processImage(
  file: File,
  opts: ProcessOptions
): Promise<ProcessResult> {
  const name = file.name.replace(/\.[^.]+$/, "");
  let full: ImageData;
  let method: string;

  if (opts.mode === "pixel") {
    opts.onProgress?.("배경제거(픽셀)");
    const src = await blobToImageData(file);
    const res = pixelRemoveBg(src, {
      tolerance: opts.tolerance,
      forceColorKey: opts.forceColorKey,
    });
    full = res.imageData;
    method = res.method;
  } else {
    opts.onProgress?.("배경제거(AI)", 0);
    const blob = await removeBg(file, (r) => opts.onProgress?.("배경제거(AI)", r));
    full = await blobToImageData(blob);
    method = "AI 배경제거 (IS-Net)";
  }

  let parts: ResultImage[] = [];
  if (opts.split !== false) {
    opts.onProgress?.("요소 분리");
    const partData = splitElements(full, opts.splitOptions);
    parts = await Promise.all(partData.map((p) => toResult(p.imageData)));
  }

  const fullResult = await toResult(full);
  return { name, method, full: fullResult, parts };
}

/** 결과 이미지들의 object URL 정리(메모리 해제) */
export function revokeResult(result: ProcessResult) {
  URL.revokeObjectURL(result.full.url);
  result.parts.forEach((p) => URL.revokeObjectURL(p.url));
}
