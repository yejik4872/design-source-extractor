// 배경제거 단계: @imgly/background-removal-node (IS-Net, 로컬 실행)
// sharp 와 onnxruntime 네이티브 충돌(세그폴트)을 피하기 위해 별도 자식 프로세스에서 실행한다.
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import { DEFAULTS } from "./config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(__dirname, "removeBgWorker.mjs");

/**
 * 배경을 제거하고 투명 PNG로 저장한다.
 * @returns {Promise<string>} 배경제거된 파일 경로
 */
export async function removeBg(inputPath, tmpDir, { model = DEFAULTS.bgModel } = {}) {
  const outPath = path.join(tmpDir, "nobg.png");
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [WORKER, inputPath, outPath, model], {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve();
      // GLib 경고는 무시, 실제 실패 메시지만 노출
      else reject(new Error(`배경제거 실패 (code ${code}) ${err.split("\n").filter((l) => l && !l.includes("GLib")).slice(-3).join(" ")}`));
    });
  });
  return outPath;
}
