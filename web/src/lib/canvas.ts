// Canvas 기반 이미지 유틸. CLI 버전의 sharp 역할을 브라우저 Canvas로 대체.
// 핵심 개념은 CLI와 동일: 이미지는 결국 RGBA 1차원 배열(ImageData.data)이다.

/** File/Blob → HTMLImageElement */
export function loadImage(src: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    img.onload = () => {
      if (typeof src !== "string") URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      if (typeof src !== "string") URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/** Blob → ImageData (원본 픽셀 배열) */
export async function blobToImageData(blob: Blob): Promise<ImageData> {
  const img = await loadImage(blob);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** ImageData → Blob(PNG) */
export function imageDataToBlob(imageData: ImageData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(imageData, 0, 0);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}

/** ImageData → data URL(미리보기용) */
export function imageDataToUrl(imageData: ImageData): string {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

/** ImageData를 지정 크기로 nearest 리샘플한 알파 마스크(다운샘플 분석용) */
export function downscaleAlpha(
  src: ImageData,
  targetW: number,
  targetH: number
): Uint8Array {
  const { width: W, height: H, data } = src;
  const out = new Uint8Array(targetW * targetH);
  for (let ty = 0; ty < targetH; ty++) {
    const sy = Math.min(H - 1, Math.floor((ty * H) / targetH));
    for (let tx = 0; tx < targetW; tx++) {
      const sx = Math.min(W - 1, Math.floor((tx * W) / targetW));
      out[ty * targetW + tx] = data[(sy * W + sx) * 4 + 3];
    }
  }
  return out;
}
