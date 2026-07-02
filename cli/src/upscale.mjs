// 업스케일 단계: Real-ESRGAN(있으면) → 없으면 sharp Lanczos 폴백
import { spawn } from "child_process";
import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { UPSCALER_EXE, DEFAULTS } from "./config.mjs";

function runRealEsrgan(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(UPSCALER_EXE, args, { windowsHide: true });
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Real-ESRGAN 종료 코드 ${code}\n${stderr.slice(-500)}`));
    });
  });
}

/**
 * 이미지를 업스케일한다.
 * @returns {Promise<{path:string, method:string}>} 업스케일된 임시 파일 경로
 */
export async function upscale(inputPath, tmpDir, {
  scale = DEFAULTS.scale,
  model = DEFAULTS.upscaleModel,
  enabled = true,
  pixel = false,
} = {}) {
  const outPath = path.join(tmpDir, "upscaled.png");

  if (!enabled) {
    await fs.copyFile(inputPath, outPath);
    return { path: outPath, method: "none (복사)" };
  }

  // 픽셀아트: nearest-neighbor 정수배 (AI 업스케일은 칼각을 뭉개므로 사용 안 함)
  if (pixel) {
    if (scale <= 1) {
      await fs.copyFile(inputPath, outPath);
      return { path: outPath, method: "none (픽셀 원본 유지)" };
    }
    const meta = await sharp(inputPath).metadata();
    await sharp(inputPath)
      .resize({ width: meta.width * scale, height: meta.height * scale, kernel: "nearest" })
      .png()
      .toFile(outPath);
    return { path: outPath, method: `nearest ${scale}x (픽셀아트)` };
  }

  // 1순위: Real-ESRGAN (AI 업스케일)
  if (existsSync(UPSCALER_EXE)) {
    try {
      const modelsDir = path.join(path.dirname(UPSCALER_EXE), "models");
      const args = ["-i", inputPath, "-o", outPath, "-s", String(scale), "-n", model];
      if (existsSync(modelsDir)) args.push("-m", modelsDir);
      await runRealEsrgan(args);
      if (existsSync(outPath)) return { path: outPath, method: `Real-ESRGAN ${scale}x (${model})` };
    } catch (e) {
      console.warn(`  ⚠ Real-ESRGAN 실패, Lanczos 폴백: ${e.message.split("\n")[0]}`);
    }
  }

  // 2순위 폴백: sharp Lanczos (AI 아님, 그래도 단순 확대보단 나음)
  const meta = await sharp(inputPath).metadata();
  await sharp(inputPath)
    .resize({ width: Math.round(meta.width * scale), kernel: "lanczos3" })
    .png()
    .toFile(outPath);
  return { path: outPath, method: `Lanczos ${scale}x (폴백)` };
}
