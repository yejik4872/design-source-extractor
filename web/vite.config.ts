import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 클라이언트 사이드 SPA. 정적 빌드 결과(dist/)를 Vercel에 배포.
export default defineConfig({
  plugins: [react()],
});
