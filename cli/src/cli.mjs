#!/usr/bin/env node
// CLI 진입점:  node src/cli.mjs [입력경로...] [옵션]
// 입력 없으면 input/ 폴더 전체 처리
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { PATHS, INPUT_EXTS, DEFAULTS, UPSCALER_EXE } from "./config.mjs";
import { processImage } from "./pipeline.mjs";
import { writePreview } from "./preview.mjs";

function parseArgs(argv) {
  const opts = { inputs: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-upscale") opts.upscale = false;
    else if (a === "--no-split") opts.split = false;
    else if (a === "--scale") opts.scale = Number(argv[++i]);
    else if (a === "--bg-model") opts.bgModel = argv[++i];
    else if (a === "--pixel") opts.pixel = true;
    else if (a === "--tolerance") opts.tolerance = Number(argv[++i]);
    else if (a === "--force-colorkey") opts.forceColorKey = true;
    else if (a === "--out") opts.out = argv[++i];
    else if (a === "--help" || a === "-h") opts.help = true;
    else opts.inputs.push(a);
  }
  return opts;
}

function help() {
  console.log(`
🎨 Design Source Extractor
나노바나나 등 AI 저화질 이미지 → 업스케일 + 배경제거 + 요소별 투명 PNG

사용법:
  npm run extract                  input/ 폴더의 모든 이미지 처리
  npm run extract -- a.png b.png   특정 파일만 처리
  node src/cli.mjs <경로>          위와 동일

옵션:
  --no-upscale        업스케일 건너뛰기
  --no-split          요소 분리 건너뛰기 (전체 컷아웃만)
  --scale <2|3|4>     업스케일 배율 (일반 기본 ${DEFAULTS.scale}, 픽셀 기본 ${DEFAULTS.pixelScale})
  --bg-model <small|medium>  배경제거 모델 (기본 ${DEFAULTS.bgModel})
  --out <폴더>        출력 폴더 (기본 output/)

픽셀아트 모드:
  --pixel             픽셀아트 모드 (색상키 배경제거 + nearest 정수배 + 하드 알파)
  --tolerance <0-255> 배경색 매칭 허용 오차 (기본 ${DEFAULTS.pixelTolerance})
  --force-colorkey    이미 투명해도 색상키 제거 강제 실행

결과: output/<이미지명>/full.png + part-1.png, part-2.png ...
      output/preview.html 로 한눈에 확인
`);
}

async function collectInputs(inputs) {
  if (inputs.length === 0) {
    if (!existsSync(PATHS.input)) return [];
    const files = await fs.readdir(PATHS.input);
    return files
      .filter((f) => INPUT_EXTS.includes(path.extname(f).toLowerCase()))
      .map((f) => path.join(PATHS.input, f));
  }
  // 파일/폴더 혼합 허용
  const out = [];
  for (const inp of inputs) {
    const stat = await fs.stat(inp).catch(() => null);
    if (!stat) {
      console.warn(`  ⚠ 없음: ${inp}`);
      continue;
    }
    if (stat.isDirectory()) {
      const files = await fs.readdir(inp);
      for (const f of files)
        if (INPUT_EXTS.includes(path.extname(f).toLowerCase())) out.push(path.join(inp, f));
    } else out.push(inp);
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return help();

  const outputRoot = opts.out ? path.resolve(opts.out) : PATHS.output;
  await fs.mkdir(outputRoot, { recursive: true });

  const inputs = await collectInputs(opts.inputs);
  if (inputs.length === 0) {
    console.log(`처리할 이미지가 없습니다. input/ 폴더에 이미지를 넣거나 경로를 지정하세요.\n--help 로 사용법 확인`);
    return;
  }

  if (!opts.pixel && opts.upscale !== false && !existsSync(UPSCALER_EXE)) {
    console.log(`ℹ Real-ESRGAN 미설치 → Lanczos 폴백으로 진행됩니다.`);
    console.log(`  AI 업스케일 원하면:  npm run setup:upscaler\n`);
  }

  console.log(`총 ${inputs.length}개 이미지 처리 시작\n`);
  const results = [];
  for (let i = 0; i < inputs.length; i++) {
    const inp = inputs[i];
    console.log(`[${i + 1}/${inputs.length}] ${path.basename(inp)}`);
    try {
      results.push(await processImage(inp, outputRoot, opts));
    } catch (e) {
      console.error(`  ✗ 실패: ${e.message}`);
    }
    console.log("");
  }

  if (results.length) {
    const html = await writePreview(outputRoot, results);
    console.log(`✅ 완료! 결과: ${outputRoot}`);
    console.log(`   미리보기: ${html}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
