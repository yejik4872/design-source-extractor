// 일반 모드 배경제거: @imgly/background-removal 브라우저판(WASM/onnx-web).
// 모델 에셋은 최초 실행 시 CDN에서 로드됨. 이미지는 브라우저 밖으로 나가지 않음.
import { removeBackground, type Config } from "@imgly/background-removal";

export async function removeBg(
  input: Blob,
  onProgress?: (ratio: number) => void
): Promise<Blob> {
  const config: Config = {
    output: { format: "image/png", quality: 1.0 },
    progress: (_key, current, total) => {
      if (onProgress && total > 0) onProgress(current / total);
    },
  };
  return removeBackground(input, config);
}
