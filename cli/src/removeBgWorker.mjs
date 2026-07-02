// 배경제거 전용 워커 (자식 프로세스로 실행됨).
// sharp/onnxruntime 네이티브 라이브러리 충돌(세그폴트) 회피를 위해 이 프로세스에서는
// sharp 를 절대 import 하지 않는다. @imgly 만 사용.
import { removeBackground } from "@imgly/background-removal-node";
import fs from "fs/promises";

const [, , inputPath, outputPath, model = "medium"] = process.argv;

const buf = await fs.readFile(inputPath);
const blob = new Blob([buf], { type: "image/png" });
const result = await removeBackground(blob, {
  output: { format: "image/png", quality: 1.0 },
  model,
});
await fs.writeFile(outputPath, Buffer.from(await result.arrayBuffer()));
