// 프로젝트 전역 설정
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");

export const PATHS = {
  root: ROOT,
  input: path.join(ROOT, "input"),
  output: path.join(ROOT, "output"),
  bin: path.join(ROOT, "bin"),
};

// Real-ESRGAN 실행파일 경로 (setup:upscaler 로 설치됨)
export const UPSCALER_EXE = path.join(PATHS.bin, "realesrgan-ncnn-vulkan.exe");

export const DEFAULTS = {
  // 업스케일 배율 (Real-ESRGAN: 2,3,4 지원 / 모델에 따라 다름)
  scale: 4,
  upscaleModel: "realesrgan-x4plus", // 일반 이미지용 (애니풍이면 realesr-animevideov3)

  // 배경제거 모델: small | medium  (medium = IS-Net, 고품질)
  bgModel: "medium",

  // 요소 분리: 알파값이 이 값보다 큰 픽셀을 "객체"로 간주 (0-255)
  alphaThreshold: 25,
  // 요소 분리 시 분석 해상도(긴 변 기준). 너무 크면 느려서 다운샘플 후 분석
  splitWorkingMax: 1400,
  // 전체 객체 픽셀 대비 이 비율보다 작은 덩어리는 노이즈로 무시
  minAreaRatio: 0.004,
  // 잘라낸 요소 가장자리 여백(px, 풀해상도 기준)
  padding: 12,
  // 8방향 연결(true) / 4방향 연결(false)
  connectivity8: true,

  // --- 픽셀아트 모드 (--pixel) ---
  // 배경 색상 매칭 허용 오차(0-255, 채널별 최대차). 높을수록 비슷한 색도 배경 취급
  pixelTolerance: 32,
  // 픽셀아트 업스케일 정수 배율(1=원본 유지). nearest-neighbor 로 칼각 보존
  pixelScale: 1,
};

// 지원 입력 확장자
export const INPUT_EXTS = [".png", ".jpg", ".jpeg", ".webp"];
