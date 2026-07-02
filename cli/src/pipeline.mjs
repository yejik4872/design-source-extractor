// 전체 파이프라인: 업스케일 → 배경제거 → 요소분리 → 저장
import fs from "fs/promises";
import path from "path";
import os from "os";
import { upscale } from "./upscale.mjs";
import { removeBg } from "./removeBg.mjs";
import { pixelRemoveBg } from "./pixelBg.mjs";
import { splitElements } from "./split.mjs";

/**
 * 이미지 1장 처리.
 * @returns {Promise<{name, full, parts, method}>}
 */
export async function processImage(inputPath, outputRoot, opts = {}) {
  const name = path.parse(inputPath).name;
  const outDir = path.join(outputRoot, name);
  await fs.mkdir(outDir, { recursive: true });

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dse-"));
  try {
    let up, nobg;

    if (opts.pixel) {
      // 픽셀아트: ① 배경제거(네이티브 색상키/투명유지) → ② nearest 정수배 업스케일
      const pb = await pixelRemoveBg(inputPath, tmpDir, {
        tolerance: opts.tolerance,
        forceColorKey: opts.forceColorKey,
      });
      console.log(`  ① 배경제거(픽셀): ${pb.method}`);
      up = await upscale(pb.path, tmpDir, {
        scale: opts.scale ?? 1,
        enabled: opts.upscale !== false,
        pixel: true,
      });
      console.log(`  ② 업스케일: ${up.method}`);
      nobg = up.path;
    } else {
      // 일반: ① AI 업스케일 → ② AI 배경제거
      up = await upscale(inputPath, tmpDir, {
        scale: opts.scale,
        model: opts.upscaleModel,
        enabled: opts.upscale !== false,
      });
      console.log(`  ① 업스케일: ${up.method}`);
      nobg = await removeBg(up.path, tmpDir, { model: opts.bgModel });
      console.log(`  ② 배경제거 완료`);
    }

    const fullOut = path.join(outDir, "full.png");
    await fs.copyFile(nobg, fullOut);

    // ③ 요소 분리
    let parts = [];
    if (opts.split !== false) {
      parts = await splitElements(nobg, outDir, opts);
      console.log(`  ③ 요소 분리: ${parts.length}개`);
    }

    return { name, full: fullOut, parts, method: up.method };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
