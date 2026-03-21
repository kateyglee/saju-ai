// ── 상수 ─────────────────────────────────────────────────────────────────────
export const CG     = ["갑","을","병","정","무","기","경","신","임","계"];
export const CG_HJ  = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
export const JJ     = ["자","축","인","묘","진","사","오","미","신","유","술","해"];
export const JJ_HJ  = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
export const OH     = ["목","화","토","금","수"];
export const OH_HJ  = ["木","火","土","金","水"];
export const OH_C   = ["#5dba7d","#e8804a","#c4a96a","#8fa8c0","#5b9bd5"];
export const CG_OH  = [0,0,1,1,2,2,3,3,4,4];
export const JJ_OH  = [4,2,0,0,2,1,1,2,3,3,2,4];

export const HOURS = [
  {v:0,  l:"자시 子 00~01시"},
  {v:1,  l:"축시 丑 01~03시"},
  {v:3,  l:"인시 寅 03~05시"},
  {v:5,  l:"묘시 卯 05~07시"},
  {v:7,  l:"진시 辰 07~09시"},
  {v:9,  l:"사시 巳 09~11시"},
  {v:11, l:"오시 午 11~13시"},
  {v:13, l:"미시 未 13~15시"},
  {v:15, l:"신시 申 15~17시"},
  {v:17, l:"유시 酉 17~19시"},
  {v:19, l:"술시 戌 19~21시"},
  {v:21, l:"해시 亥 21~23시"},
  {v:23, l:"자시 子 23~01시 (야자시)"},
  {v:-1, l:"시간 모름"},
];

// ── 타입 ─────────────────────────────────────────────────────────────────────
export interface Pillar { cg: number; jj: number; }
export interface Saju {
  yp: Pillar; mp: Pillar; dp: Pillar; hp: Pillar | null;
}
export interface DaeunItem {
  cg: number; jj: number;
  startAge: number; endAge: number;
  isCurrent: boolean;
}
export interface SajuResult {
  saju: Saju;
  daeun: DaeunItem[];
  currentDaeun: DaeunItem | null;
  seun: Pillar;   // 올해 세운
  currentAge: number;
}

// ── 사주 계산 ─────────────────────────────────────────────────────────────────
function hToJJ(h: number): number {
  if (h === 23) return 0;
  return [0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,11][h];
}
function yP(y: number): Pillar {
  return { cg: ((y-4)%10+10)%10, jj: ((y-4)%12+12)%12 };
}
const JEOLGI_DAY = [6,4,6,5,6,6,7,8,8,8,7,7];
function mP(y: number, m: number, d: number): Pillar {
  const em = (d < JEOLGI_DAY[m-1]) ? (m===1 ? 12 : m-1) : m;
  const cgBase = [2,4,6,8,0,2,4,6,8,0][((y-4)%10+10)%10];
  const cg = ((cgBase + em - 2) % 10 + 10) % 10;
  const jj = em % 12;
  return { cg, jj };
}
function dP(y: number, m: number, d: number): Pillar {
  const a = Math.floor((14-m)/12);
  const yy = y+4800-a;
  const mm = m+12*a-3;
  const jdn = d + Math.floor((153*mm+2)/5) + 365*yy + Math.floor(yy/4) - Math.floor(yy/100) + Math.floor(yy/400) - 32045;
  const i = (jdn+49) % 60;
  return { cg: i%10, jj: i%12 };
}
function hP(dayCg: number, h: number): Pillar {
  const jj = hToJJ(h);
  const b = [0,2,4,6,8,0,2,4,6,8][dayCg];
  return { cg: (b+jj)%10, jj };
}
export function calcSaju(y: number, m: number, d: number, h: number): Saju {
  const yp = yP(y); const mp = mP(y, m, d);
  const dp = dP(y, m, d); const hp = h === -1 ? null : hP(dp.cg, h);
  return { yp, mp, dp, hp };
}
export function ohCounts(s: Saju): number[] {
  const c = [0,0,0,0,0];
  [s.yp, s.mp, s.dp, s.hp].filter(Boolean).forEach(p => {
    c[CG_OH[p!.cg]]++; c[JJ_OH[p!.jj]]++;
  });
  return c;
}

// ── 대운 계산 ─────────────────────────────────────────────────────────────────
function calcDaeunStartAge(y: number, m: number, d: number, gender: string): { startAge: number; isForward: boolean } {
  const yearCg = ((y-4)%10+10)%10;
  const isYang  = yearCg % 2 === 0;
  // 남자양간 or 여자음간 → 순행, 반대 → 역행
  const isForward = (gender === "M" && isYang) || (gender === "F" && !isYang);

  let days: number;
  if (isForward) {
    const jeolgiDay = JEOLGI_DAY[m-1];
    days = d <= jeolgiDay ? jeolgiDay - d : (30 - d) + JEOLGI_DAY[m % 12];
  } else {
    const jeolgiDay = JEOLGI_DAY[m-1];
    days = d >= jeolgiDay ? d - jeolgiDay : d + (30 - JEOLGI_DAY[(m-2+12)%12]);
  }
  return { startAge: Math.floor(days / 3), isForward };
}

export function calcDaeun(saju: Saju, birthYear: number, birthMonth: number, birthDay: number, gender: string): DaeunItem[] {
  const { startAge, isForward } = calcDaeunStartAge(birthYear, birthMonth, birthDay, gender);
  const currentYear = new Date().getFullYear();
  const currentAge  = currentYear - birthYear;
  const items: DaeunItem[] = [];

  for (let i = 1; i <= 8; i++) {
    const cg  = isForward ? (saju.mp.cg + i) % 10 : (saju.mp.cg - i + 100) % 10;
    const jj  = isForward ? (saju.mp.jj + i) % 12 : (saju.mp.jj - i + 120) % 12;
    const sa  = startAge + (i-1) * 10;
    const ea  = sa + 9;
    items.push({ cg, jj, startAge: sa, endAge: ea, isCurrent: currentAge >= sa && currentAge <= ea });
  }
  return items;
}

// 세운 (올해 년주)
export function calcSeun(year: number): Pillar {
  return yP(year);
}

// ── 통합 계산 ─────────────────────────────────────────────────────────────────
export function calcAll(y: number, m: number, d: number, h: number, gender: string): SajuResult {
  const saju   = calcSaju(y, m, d, h);
  const daeun  = calcDaeun(saju, y, m, d, gender);
  const currentYear = new Date().getFullYear();
  return {
    saju,
    daeun,
    currentDaeun: daeun.find(x => x.isCurrent) ?? null,
    seun: calcSeun(currentYear),
    currentAge: currentYear - y,
  };
}

// ── LLM 프롬프트 컨텍스트 생성 ───────────────────────────────────────────────
export function sajuToPromptContext(result: SajuResult, gender: string, year: number, month: number, day: number): string {
  const { saju, daeun, currentDaeun, seun, currentAge } = result;
  const counts = ohCounts(saju);
  const ohDesc = OH.map((n,i) => `${n}(${OH_HJ[i]}):${counts[i]}개`).join(" ");
  const currentYear = new Date().getFullYear();

  const pillars = [
    `년주: ${CG[saju.yp.cg]}${JJ[saju.yp.jj]}(${CG_HJ[saju.yp.cg]}${JJ_HJ[saju.yp.jj]}) — ${OH[CG_OH[saju.yp.cg]]}${OH[JJ_OH[saju.yp.jj]]}`,
    `월주: ${CG[saju.mp.cg]}${JJ[saju.mp.jj]}(${CG_HJ[saju.mp.cg]}${JJ_HJ[saju.mp.jj]}) — ${OH[CG_OH[saju.mp.cg]]}${OH[JJ_OH[saju.mp.jj]]}`,
    `일주: ${CG[saju.dp.cg]}${JJ[saju.dp.jj]}(${CG_HJ[saju.dp.cg]}${JJ_HJ[saju.dp.jj]}) — ${OH[CG_OH[saju.dp.cg]]}${OH[JJ_OH[saju.dp.jj]]} ← 일간(본인의 핵심 기운)`,
    saju.hp
      ? `시주: ${CG[saju.hp.cg]}${JJ[saju.hp.jj]}(${CG_HJ[saju.hp.cg]}${JJ_HJ[saju.hp.jj]}) — ${OH[CG_OH[saju.hp.cg]]}${OH[JJ_OH[saju.hp.jj]]}`
      : `시주: 미상`,
  ].join("\n");

  const daeunDesc = daeun.map(d =>
    `  ${d.startAge}~${d.endAge}세: ${CG[d.cg]}${JJ[d.jj]}(${CG_HJ[d.cg]}${JJ_HJ[d.jj]})${d.isCurrent ? " ← 현재" : ""}`
  ).join("\n");

  return `[사용자 정보]
생년월일: ${year}년 ${month}월 ${day}일 / 성별: ${gender === "F" ? "여성" : "남성"} / 현재 나이: ${currentAge}세

[사주팔자]
${pillars}

[오행 분포]
${ohDesc}

[대운 흐름]
${daeunDesc}

[현재 대운]
${currentDaeun ? `${CG[currentDaeun.cg]}${JJ[currentDaeun.jj]} 대운 (${currentDaeun.startAge}~${currentDaeun.endAge}세)` : "산출 불가"}

[${currentYear}년 세운]
${CG[seun.cg]}${JJ[seun.jj]}(${CG_HJ[seun.cg]}${JJ_HJ[seun.jj]}) — ${OH[CG_OH[seun.cg]]}${OH[JJ_OH[seun.jj]]}

${!saju.hp ? "※ 시주 미상으로 년·월·일주 기준 분석합니다." : ""}`;
}
