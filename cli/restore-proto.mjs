// 프로토타입 v3: 연결 제약 복원 (region growing) + 배경색 정리
// - 복원은 "AI가 살린 영역에서 피사체색 픽셀로만 성장" → 배경 헤이즈 원천 차단
// - 정리는 "원본이 확실한 배경색" → 유령/찌꺼기 제거 (알파 불문)
// 사용: node restore-proto.mjs <원본> <배경제거결과> <출력> [t0] [t1]
import sharp from "sharp";

const [, , origPath, nobgPath, outPath, t0Arg, t1Arg] = process.argv;
const T0 = Number(t0Arg ?? 25); // 이하 = 확실한 배경색
const T1 = Number(t1Arg ?? 64); // 이상 = 확실한 피사체색

const orig = await sharp(origPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = orig.info;
const nobg = await sharp(nobgPath).resize(W, H, { fit: "fill" }).ensureAlpha().raw()
  .toBuffer({ resolveWithObject: true });
const o = orig.data;
const n = nobg.data;
const N = W * H;

// 1) 전역 배경색: AI가 투명 처리한 테두리 픽셀의 중앙값
const rs = [], gs = [], bs = [];
const sample = (x, y) => {
  const i = (y * W + x) * 4;
  if (n[i + 3] < 30) { rs.push(o[i]); gs.push(o[i + 1]); bs.push(o[i + 2]); }
};
for (let x = 0; x < W; x += 2) { sample(x, 0); sample(x, H - 1); }
for (let y = 0; y < H; y += 2) { sample(0, y); sample(W - 1, y); }
if (rs.length < 50) { console.log("⚠ 배경 샘플 부족 — 생략"); process.exit(1); }
const med = (a) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)];
const bgR = med(rs), bgG = med(gs), bgB = med(bs);
console.log(`배경색 rgb(${bgR},${bgG},${bgB}) | 샘플 ${rs.length}`);

// 픽셀별 색거리 사전 계산
const dist = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const p = i * 4;
  dist[i] = Math.hypot(o[p] - bgR, o[p + 1] - bgG, o[p + 2] - bgB);
}

// 2) region growing: 씨앗 = AI 알파 ≥ 200, 성장 = d ≥ T1 인 픽셀로만
const mask = new Uint8Array(N); // 1 = 피사체 확정
const stack = [];
for (let i = 0; i < N; i++) {
  if (n[i * 4 + 3] >= 200) { mask[i] = 1; stack.push(i); }
}
const seeds = stack.length;
let grown = 0;
while (stack.length) {
  const i = stack.pop();
  const x = i % W;
  for (const dyx of [-1, 1, -W, W]) {
    const j = i + dyx;
    if (j < 0 || j >= N || mask[j]) continue;
    if (Math.abs((j % W) - x) > 1) continue;
    if (dist[j] >= T1) { mask[j] = 1; stack.push(j); grown++; }
  }
}
console.log(`씨앗 ${seeds} | 성장 복원 ${grown}`);

// 2.5) 마스크 컴포넌트 검증: "확실한 피사체색(d>=T1)" 증거가 없는 덩어리는 유령 → 통째로 제거
{
  const label = new Int32Array(N);
  let cur = 0;
  const st = [];
  for (let s = 0; s < N; s++) {
    if (!mask[s] || label[s]) continue;
    cur++;
    let area = 0, strong = 0;
    st.length = 0; st.push(s); label[s] = cur;
    const members = [s];
    while (st.length) {
      const i = st.pop();
      area++;
      if (dist[i] >= T1) strong++;
      const x = i % W;
      for (const dyx of [-1, 1, -W, W]) {
        const j = i + dyx;
        if (j < 0 || j >= N || !mask[j] || label[j]) continue;
        if (Math.abs((j % W) - x) > 1) continue;
        label[j] = cur; st.push(j); members.push(j);
      }
    }
    const strongRatio = strong / area;
    if (strongRatio < 0.1 && area < N * 0.05) {
      // 피사체 증거 부족 + 크지도 않음 → 유령 덩어리 제거
      for (const m of members) { mask[m] = 0; n[m * 4 + 3] = 0; }
      console.log(`  유령 컴포넌트 제거: area=${area}, 증거율=${(strongRatio * 100).toFixed(1)}%`);
    }
  }
}

// 2.7) 지역 지지도 검사: 주변(반경 12px)에 강한 피사체색(d>=50)이 전혀 없는
//      마스크 픽셀은 본체에 얇게 연결된 유령 패치 → 제거
{
  const TS = 50, RAD = 12;
  const strong = new Uint8Array(N);
  for (let i = 0; i < N; i++) strong[i] = dist[i] >= TS ? 1 : 0;
  // 적분 이미지로 박스 합 (O(N))
  const integ = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      row += strong[y * W + x];
      integ[(y + 1) * (W + 1) + (x + 1)] = integ[y * (W + 1) + (x + 1)] + row;
    }
  }
  const boxSum = (x0, y0, x1, y1) =>
    integ[y1 * (W + 1) + x1] - integ[y0 * (W + 1) + x1] -
    integ[y1 * (W + 1) + x0] + integ[y0 * (W + 1) + x0];
  let ghostCut = 0;
  for (let i = 0; i < N; i++) {
    if (!mask[i] || dist[i] >= TS) continue;
    const x = i % W, y = (i - x) / W;
    const s = boxSum(Math.max(0, x - RAD), Math.max(0, y - RAD),
      Math.min(W, x + RAD + 1), Math.min(H, y + RAD + 1));
    if (s === 0) { mask[i] = 0; n[i * 4 + 3] = 0; ghostCut++; }
  }
  console.log(`지지도 부족 제거: ${ghostCut}`);
}

// 3) 출력 구성
const out = Buffer.from(n);
let cleaned = 0, feathered = 0;
for (let i = 0; i < N; i++) {
  const p = i * 4;
  const a = n[p + 3];
  if (mask[i]) {
    if (a < 255 && dist[i] >= T1) {
      // 성장으로 복원된 (또는 반투명이던) 피사체색 픽셀 → 원본으로 완전 복원
      out[p] = o[p]; out[p + 1] = o[p + 1]; out[p + 2] = o[p + 2];
      out[p + 3] = 255;
    }
    continue;
  }
  if (dist[i] <= T0) {
    // 확실한 배경색 & 피사체 미연결 → 제거 (유령/불투명 찌꺼기 포함)
    if (a > 0) { out[p + 3] = 0; cleaned++; }
  } else if (dist[i] < T1) {
    // 중간 지대: 피사체(mask)와 인접한 경우에만 소프트 엣지로 유지/보강
    const x = i % W;
    let adj = false;
    for (const dyx of [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1]) {
      const j = i + dyx;
      if (j < 0 || j >= N) continue;
      if (Math.abs((j % W) - x) > 1) continue;
      if (mask[j]) { adj = true; break; }
    }
    if (adj) {
      const t = (dist[i] - T0) / (T1 - T0);
      const diffA = Math.round(t * t * (3 - 2 * t) * 255);
      if (diffA > a) {
        out[p] = o[p]; out[p + 1] = o[p + 1]; out[p + 2] = o[p + 2];
        out[p + 3] = diffA;
        feathered++;
      }
    } else if (a > 0 && a < 200) {
      // 피사체와 무관한 중간색 잔재 → 제거
      out[p + 3] = 0;
      cleaned++;
    }
  }
}
console.log(`정리 ${cleaned} | 엣지 보강 ${feathered}`);

await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(outPath);
console.log(`저장: ${outPath}`);
