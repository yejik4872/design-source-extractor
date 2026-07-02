// Real-ESRGAN(ncnn-vulkan) Windows 단독 실행파일 다운로드 + 압축 해제
// 실행:  npm run setup:upscaler
import fs from "fs/promises";
import { createWriteStream, existsSync } from "fs";
import { spawn } from "child_process";
import path from "path";
import { Readable } from "stream";
import { PATHS, UPSCALER_EXE } from "./config.mjs";

const RELEASE =
  "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip";

async function download(url, dest) {
  console.log(`다운로드 중: ${url}`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`다운로드 실패 HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  let got = 0;
  const file = createWriteStream(dest);
  const reader = Readable.fromWeb(res.body);
  reader.on("data", (c) => {
    got += c.length;
    if (total) process.stdout.write(`\r  ${(got / 1e6).toFixed(1)}/${(total / 1e6).toFixed(1)} MB`);
  });
  await new Promise((resolve, reject) => {
    reader.pipe(file);
    file.on("finish", resolve);
    file.on("error", reject);
    reader.on("error", reject);
  });
  process.stdout.write("\n");
}

function unzip(zipPath, destDir) {
  // Windows 기본 PowerShell Expand-Archive 사용 (별도 의존성 불필요)
  return new Promise((resolve, reject) => {
    const ps = spawn(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`,
      ],
      { windowsHide: true }
    );
    let err = "";
    ps.stderr.on("data", (d) => (err += d));
    ps.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err || `exit ${code}`))));
    ps.on("error", reject);
  });
}

async function main() {
  if (existsSync(UPSCALER_EXE)) {
    console.log(`✅ 이미 설치됨: ${UPSCALER_EXE}`);
    return;
  }
  await fs.mkdir(PATHS.bin, { recursive: true });
  const zipPath = path.join(PATHS.bin, "realesrgan.zip");

  await download(RELEASE, zipPath);
  console.log("압축 해제 중...");
  await unzip(zipPath, PATHS.bin);
  await fs.rm(zipPath, { force: true });

  if (existsSync(UPSCALER_EXE)) {
    console.log(`\n✅ 설치 완료: ${UPSCALER_EXE}`);
    console.log(`이제 'npm run extract' 시 AI 업스케일이 적용됩니다.`);
  } else {
    console.log(`\n⚠ exe를 찾지 못했습니다. ${PATHS.bin} 내용을 확인하세요.`);
    const files = await fs.readdir(PATHS.bin);
    console.log(files.join("\n"));
  }
}

main().catch((e) => {
  console.error("설치 실패:", e.message);
  process.exit(1);
});
