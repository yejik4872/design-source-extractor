# 🎨 Design Source Extractor

나노바나나(Gemini) 등 **AI로 생성한 저화질 이미지**나 **픽셀아트**를, 피그마 작업에 쓸 수 있는
**고화질 투명 PNG 소스**로 자동 변환하는 CLI 도구.

## 무엇을 하나

두 가지 모드가 있고, 이미지 종류에 따라 처리 방식이 다릅니다.

### 일반 모드 (사진/일러스트/3D 렌더)

```
저화질 AI 이미지  →  ① AI 업스케일  →  ② 배경제거  →  ③ 요소별 분리  →  고화질 투명 PNG
```

- **① 업스케일** — Real-ESRGAN(AI)로 4배 확대해 화질 복원. 미설치 시 Lanczos로 폴백.
- **② 배경제거** — `@imgly/background-removal-node` (IS-Net 모델, 로컬 실행, 무료).
- **③ 요소 분리** — 알파 채널의 연결 덩어리를 찾아 요소별로 잘라냄.

### 픽셀아트 모드 (`--pixel`)

```
픽셀아트  →  ① 색상키 배경제거(하드 알파)  →  ② nearest 정수배 업스케일  →  ③ 요소별 분리
```

픽셀아트는 일반 이미지와 정반대로 처리해야 합니다.

- **① 배경제거** — AI 모델은 가장자리를 부드럽게(안티앨리어싱) 만들어 픽셀 칼각을 뭉갬.
  대신 **모서리에서 배경색 flood-fill**로 배경과 *연결된* 영역만 제거 →
  안쪽에 배경과 같은 색이 있어도 보존됨. 알파는 항상 **0/255 하드**라 칼각 유지.
  이미 투명한 이미지는 건드리지 않고 알파 이진화만 하고 통과.
- **② 업스케일** — AI 대신 **nearest-neighbor 정수배**로 확대(`--scale`). 기본은 원본 유지(1x).

전부 **로컬에서 무료** 실행됩니다. (이미지가 외부로 전송되지 않음)

## 설치

```bash
npm install
npm run setup:upscaler   # Real-ESRGAN 다운로드(일반 모드 AI 업스케일용, ~약 50MB)
                          # 픽셀아트 모드만 쓸 거면 설치 불필요
```

## 사용법

```bash
# input/ 폴더의 모든 이미지 처리 (일반 모드)
npm run extract

# 특정 파일만
npm run extract -- C:/path/to/image.png

# 일반 모드 옵션
npm run extract -- --scale 4 --bg-model medium
npm run extract -- --no-upscale      # 업스케일 생략
npm run extract -- --no-split        # 전체 컷아웃만(요소분리 X)
```

### 픽셀아트

```bash
# 픽셀아트 모드 (색상키 배경제거 + 하드 알파, 원본 해상도 유지)
npm run extract -- sprite.png --pixel

# nearest 정수배로 8배 확대 (칼각 유지)
npm run extract -- sprite.png --pixel --scale 8

# 배경색 매칭 허용 오차 조절 (기본 32, 그라데이션 배경이면 높이기)
npm run extract -- sprite.png --pixel --tolerance 48

# 이미 투명해도 색상키 제거를 강제 실행
npm run extract -- sprite.png --pixel --force-colorkey
```

## 옵션 전체

| 옵션 | 설명 |
|---|---|
| `--pixel` | 픽셀아트 모드 (색상키 배경제거 + nearest 정수배 + 하드 알파) |
| `--scale <n>` | 업스케일 배율 (일반 기본 4, 픽셀 기본 1) |
| `--bg-model <small\|medium>` | 일반 모드 배경제거 모델 (기본 medium) |
| `--tolerance <0-255>` | (픽셀) 배경색 매칭 허용 오차 (기본 32) |
| `--force-colorkey` | (픽셀) 이미 투명해도 색상키 제거 강제 |
| `--no-upscale` | 업스케일 생략 |
| `--no-split` | 요소 분리 생략 (전체 컷아웃만) |
| `--out <폴더>` | 출력 폴더 (기본 output/) |
| `--help`, `-h` | 도움말 |

## 결과물

```
output/
  <이미지명>/
    full.png        ← 배경제거된 전체 컷아웃
    part-1.png      ← 분리된 요소 1 (좌→우 순서)
    part-2.png
    ...
  preview.html      ← 결과 한눈에 보기 (브라우저로 열기)
  manifest.json     ← 결과 메타데이터(피그마 임포트 등 자동화용)
```

## 한계 & 로드맵

- **서로 떨어진 요소**(예: O·N·E 글자, 분리된 아이콘)는 자동 분리 OK.
- **겹치거나 붙은 요소**(예: X자로 교차한 공구)는 한 덩어리로 잡힘
  → v2에서 **SAM(Segment Anything)** 기반 클릭/자동 분리 예정.
- **글래스/3D 렌더**는 벡터화가 아니라 고화질 투명 PNG 레이어로 추출(의도된 동작).
- 픽셀아트 색상키는 **단색 배경**에 최적화. 복잡한/그라데이션 배경은 `--tolerance`를 올리거나 일반 모드를 사용.
- (예정) `manifest.json` → 피그마 자동 임포트 플러그인.

## 동작 메모 (개발자용)

- 배경제거(onnxruntime)와 `sharp`를 같은 프로세스에서 쓰면 **세그폴트** 발생 →
  일반 모드 배경제거는 별도 자식 프로세스(`src/removeBgWorker.mjs`)에서 실행.
  픽셀 모드 색상키는 순수 `sharp`라 같은 프로세스에서 실행.
- `sharp`는 1채널 raw를 resize하면 3채널로 자동 확장 → 라벨맵은 `.extractChannel(0)`로 1채널 복원.

## 기술 스택

- Node.js (ESM)
- [`@imgly/background-removal-node`](https://github.com/imgly/background-removal-js) — 배경제거(일반 모드)
- [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) — AI 업스케일(일반 모드)
- [`sharp`](https://sharp.pixelplumbing.com/) — 이미지 처리/요소 분리/픽셀 색상키
