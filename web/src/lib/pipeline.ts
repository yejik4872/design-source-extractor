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
  upscaleParts?: boolean; // 일반 모드: 분리된 요소를 AI 업스케일
  upscaleScale?: 2 | 3 | 4; // 업스케일 배율 (기본 4)
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
  let upscaledCount = 0;
  if (opts.split !== false) {
    opts.onProgress?.("요소 분리");
    const partData = splitElements(full, opts.splitOptions);

    if (opts.upscaleParts && opts.mode === "general") {
      // TF.js가 무거워서 업스케일을 실제 사용할 때만 동적 로드 (코드 스플리팅)
      opts.onProgress?.("업스케일 모델 로딩");
      const { upscaleImageData } = await import("./upscale");
      const scale = opts.upscaleScale ?? 4;
      // 요소별 AI 업스케일 (요소는 작아서 전체 이미지보다 훨씬 빠름)
      for (let i = 0; i < partData.length; i++) {
        opts.onProgress?.(`요소 업스케일 ${i + 1}/${partData.length}`, 0);
        const res = await upscaleImageData(partData[i].imageData, scale, (r) =>
          opts.onProgress?.(`요소 업스케일 ${i + 1}/${partData.length}`, r)
        );
        partData[i] = {
          imageData: res.imageData,
          width: res.imageData.width,
          height: res.imageData.height,
        };
        if (res.upscaled) upscaledCount++;
      }
    }

    parts = await Promise.all(partData.map((p) => toResult(p.imageData)));
  }

  if (upscaledCount > 0)
    method += ` + AI ${opts.upscaleScale ?? 4}x 업스케일 (${upscaledCount}개)`;

  const fullResult = await toResult(full);
  return { name, method, full: fullResult, parts };
}

/** 결과 이미지들의 object URL 정리(메모리 해제) */
export function revokeResult(result: ProcessResult) {
  URL.revokeObjectURL(result.full.url);
  result.parts.forEach((p) => URL.revokeObjectURL(p.url));
}
