# 🎨 Design Source Extractor

AI 생성 이미지·픽셀아트의 **배경을 제거**하고 **요소별로 분리**해, 피그마 작업에 쓸
투명 PNG 소스로 뽑아내는 도구. **모든 처리가 브라우저(또는 로컬 CLI)에서 수행되어
이미지가 외부로 전송되지 않습니다.**

## 구성 (모노레포)

| 폴더 | 설명 |
|---|---|
| **[`web/`](web)** | 브라우저 웹앱 (React + Vite). 드래그&드롭 UI, 전부 클라이언트 사이드. **Vercel 배포 대상.** |
| **[`cli/`](cli)** | 터미널 CLI (Node.js). AI 업스케일(Real-ESRGAN) 포함. 로컬 전용. |

두 버전은 **같은 알고리즘**(색상키 flood-fill 배경제거, connected-components 요소 분리)을
공유합니다. 웹앱은 `sharp` 대신 Canvas를, `@imgly/background-removal-node` 대신
브라우저판 `@imgly/background-removal`을 사용합니다.

## 기능

- **일반 모드** — AI(IS-Net)로 주요 객체를 인식해 배경 제거. 사진·일러스트·3D 렌더용.
- **픽셀아트 모드** — 모서리 색상키 flood-fill + 하드 알파. 픽셀 칼각 보존, 단색 배경용.
- **요소 분리** — 서로 떨어진 요소(글자·아이콘 등)를 개별 투명 PNG로 분리.

- **요소 고화질 (AI 4x)** — 일반 모드에서 분리된 요소를 브라우저에서 ESRGAN(UpscalerJS)으로
  4배 업스케일. 요소 단위라 전체 이미지보다 훨씬 빠름. 토글로 켜고 끔.
  (알파는 별도 리샘플 + 가장자리 색 번짐 처리로 검은 할로 방지. 긴 변 1200px 초과 요소는 생략.)

> ℹ️ **전체 이미지 업스케일**은 CLI 전용입니다 (Real-ESRGAN 실행파일, 로컬).

## 웹앱 로컬 실행

```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

## Vercel 배포

이 레포는 모노레포라 웹앱이 `web/` 하위에 있습니다. Vercel에서 임포트할 때:

1. **New Project** → 이 GitHub 레포 선택
2. **Root Directory** 를 `web` 으로 설정 ← 중요
3. Framework Preset: **Vite** (자동 감지됨)
4. Build Command `npm run build`, Output `dist` (자동)
5. Deploy

정적 SPA라 서버리스 함수·환경변수 없이 그대로 배포됩니다.

## CLI 사용

[`cli/README.md`](cli/README.md) 참고. (업스케일 포함 전체 파이프라인)

## 한계 & 로드맵

- **겹치거나 붙은 요소**(예: X자 교차 공구)는 한 덩어리로 잡힘 → SAM 기반 분리는 로드맵.
- **이미 압축/열화된 실사용 이미지**는 대상 아님 (업스케일 ≠ 복원).

## 기술 스택

- **웹**: React, Vite, TypeScript, Canvas 2D, [`@imgly/background-removal`](https://github.com/imgly/background-removal-js)
- **CLI**: Node.js, [`sharp`](https://sharp.pixelplumbing.com/), [`@imgly/background-removal-node`](https://github.com/imgly/background-removal-js), [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN)
