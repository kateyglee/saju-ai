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

// ── 십성(十星) 계산 ─────────────────────────────────────────────────────────
// 일간 기준으로 다른 천간/지지의 십성 관계를 판단
const SIPSUNG_NAME = ["비견","겁재","식신","상관","편재","정재","편관","정관","편인","정인"];
// 일간 오행에서 다른 오행까지의 십성 기본 인덱스 (같은 오행=비견/겁재, 내가 생=식신/상관, ...)
// 오행 관계: 비겁(같음), 식상(내가 생), 재성(내가 극), 관성(나를 극), 인성(나를 생)
const OH_RELATION: number[][] = [
  // 목  화  토  금  수  (대상 오행)
  [0, 2, 4, 6, 8], // 일간=목: 목=비겁, 화=식상, 토=재성, 금=관성, 수=인성
  [8, 0, 2, 4, 6], // 일간=화
  [6, 8, 0, 2, 4], // 일간=토
  [4, 6, 8, 0, 2], // 일간=금
  [2, 4, 6, 8, 0], // 일간=수
];

export function calcSipsung(dayCg: number, targetCg: number): string {
  const dayOh = CG_OH[dayCg];
  const targetOh = CG_OH[targetCg];
  const baseIdx = OH_RELATION[dayOh][targetOh];
  // 음양이 같으면 편(+0), 다르면 정(+1)
  const samePolarity = (dayCg % 2) === (targetCg % 2);
  return SIPSUNG_NAME[baseIdx + (samePolarity ? 0 : 1)];
}

export function calcSipsungJJ(dayCg: number, targetJj: number): string {
  const dayOh = CG_OH[dayCg];
  const targetOh = JJ_OH[targetJj];
  const baseIdx = OH_RELATION[dayOh][targetOh];
  // 지지 음양: 자인진오신술=양, 축묘사미유해=음
  const jjPolarity = [0,1,0,1,0,1,0,1,0,1,0,1][targetJj]; // 양=0 음=1
  const cgPolarity = dayCg % 2; // 양=0 음=1
  const samePolarity = cgPolarity === jjPolarity;
  return SIPSUNG_NAME[baseIdx + (samePolarity ? 0 : 1)];
}

// ── 천간 합(合)/충(沖) ───────────────────────────────────────────────────────
// 천간합: 갑기합(토), 을경합(금), 병신합(수), 정임합(목), 무계합(화)
const CG_HAP_PAIRS: [number,number,string][] = [[0,5,"토"],[1,6,"금"],[2,7,"수"],[3,8,"목"],[4,9,"화"]];
// 천간충: 갑경충, 을신충, 병임충, 정계충, 무갑충 (간격 6)
export function findCgHap(cg1: number, cg2: number): string | null {
  for (const [a,b,oh] of CG_HAP_PAIRS) {
    if ((cg1===a && cg2===b) || (cg1===b && cg2===a)) return `${CG[a]}${CG[b]}합(${oh})`;
  }
  return null;
}
export function findCgChung(cg1: number, cg2: number): string | null {
  if (Math.abs(cg1-cg2) === 6 || Math.abs(cg1-cg2) === 4) {
    // 천간충: 갑경, 을신, 병임, 정계
    const pairs: [number,number][] = [[0,6],[1,7],[2,8],[3,9]];
    for (const [a,b] of pairs) {
      if ((cg1===a && cg2===b) || (cg1===b && cg2===a)) return `${CG[a]}${CG[b]}충`;
    }
  }
  return null;
}

// ── 지지 합(合)/충(沖)/형(刑)/삼합(三合) ────────────────────────────────────
// 지지육합: 자축(토), 인해(목), 묘술(화), 진유(금), 사신(수), 오미(토)
const JJ_YUKHAP: [number,number,string][] = [[0,1,"토"],[2,11,"목"],[3,10,"화"],[4,9,"금"],[5,8,"수"],[6,7,"토"]];
// 지지충: 자오, 축미, 인신, 묘유, 진술, 사해 (간격 6)
// 지지삼합: 인오술(화), 해묘미(목), 신자진(수), 사유축(금)
const JJ_SAMHAP: [number,number,number,string][] = [[2,6,10,"화"],[11,3,7,"목"],[8,0,4,"수"],[5,9,1,"금"]];
// 지지형: 인사형, 사신형(무은지형), 축술형, 술미형, 자묘형(무례지형)
const JJ_HYUNG: [number,number,string][] = [[2,5,"인사형"],[5,8,"사신형"],[1,10,"축술형"],[10,7,"술미형"],[0,3,"자묘형"]];

export function findJjRelations(jj1: number, jj2: number): string[] {
  const results: string[] = [];
  // 육합
  for (const [a,b,oh] of JJ_YUKHAP) {
    if ((jj1===a && jj2===b) || (jj1===b && jj2===a)) results.push(`${JJ[a]}${JJ[b]}합(${oh})`);
  }
  // 충 (간격 6)
  if ((jj1+6)%12 === jj2 || (jj2+6)%12 === jj1) results.push(`${JJ[jj1]}${JJ[jj2]}충`);
  // 형
  for (const [a,b,name] of JJ_HYUNG) {
    if ((jj1===a && jj2===b) || (jj1===b && jj2===a)) results.push(`${name}(${JJ[a]}${JJ[b]})`);
  }
  return results;
}

// 사주 내부의 모든 합충형 분석
export function analyzeSajuRelations(saju: Saju): string[] {
  const results: string[] = [];
  const pillars = [
    { name: "년", p: saju.yp }, { name: "월", p: saju.mp },
    { name: "일", p: saju.dp }, ...(saju.hp ? [{ name: "시", p: saju.hp }] : []),
  ];
  for (let i = 0; i < pillars.length; i++) {
    for (let j = i+1; j < pillars.length; j++) {
      const a = pillars[i], b = pillars[j];
      // 천간 합/충
      const cgH = findCgHap(a.p.cg, b.p.cg);
      if (cgH) results.push(`${a.name}${b.name} 천간 ${cgH}`);
      const cgC = findCgChung(a.p.cg, b.p.cg);
      if (cgC) results.push(`${a.name}${b.name} 천간 ${cgC}`);
      // 지지 관계
      const jjR = findJjRelations(a.p.jj, b.p.jj);
      jjR.forEach(r => results.push(`${a.name}${b.name} 지지 ${r}`));
    }
  }
  // 삼합 체크
  const jjs = pillars.map(p => p.p.jj);
  for (const [a,b,c,oh] of JJ_SAMHAP) {
    if (jjs.includes(a) && jjs.includes(b) && jjs.includes(c)) {
      results.push(`삼합 ${JJ[a]}${JJ[b]}${JJ[c]}(${oh}국)`);
    }
  }
  return results;
}

// ── 용신(用神) 추정 ─────────────────────────────────────────────────────────
// 간단한 억부법 기반: 일간이 강하면 설기/극기하는 오행이 용신, 약하면 생조하는 오행이 용신
export function estimateYongsin(saju: Saju): { yongsin: string; yongsinOh: number; reason: string } {
  const dayCg = saju.dp.cg;
  const dayOh = CG_OH[dayCg];
  const counts = ohCounts(saju);

  // 일간 강약 판단: 비겁(같은 오행) + 인성(나를 생하는 오행) 개수
  const SANG_CYCLE = [4,0,1,2,3]; // 수→목, 목→화, 화→토, 토→금, 금→수
  const bigyeop = counts[dayOh]; // 같은 오행
  const insung = counts[SANG_CYCLE[dayOh]]; // 나를 생하는 오행
  const strength = bigyeop + insung;
  const total = counts.reduce((a,b) => a+b, 0);

  const isStrong = strength > total / 2;

  // 상생 순서: 목→화→토→금→수→목
  const NEXT = [1,2,3,4,0]; // 내가 생하는 오행 (식상)
  const KEUK = [2,3,4,0,1]; // 내가 극하는 오행 (재성)

  if (isStrong) {
    // 강하면: 식상(설기) 또는 재성(소모)이 용신
    const sikOh = NEXT[dayOh];
    return { yongsin: OH[sikOh], yongsinOh: sikOh, reason: `일간이 강함(비겁+인성=${strength}) → ${OH[sikOh]}(설기)이 필요` };
  } else {
    // 약하면: 인성(생조) 또는 비겁(도움)이 용신
    const insungOh = SANG_CYCLE[dayOh];
    return { yongsin: OH[insungOh], yongsinOh: insungOh, reason: `일간이 약함(비겁+인성=${strength}) → ${OH[insungOh]}(생조)이 필요` };
  }
}

// ── LLM 프롬프트 컨텍스트 생성 ───────────────────────────────────────────────
export function sajuToPromptContext(result: SajuResult, gender: string, year: number, month: number, day: number): string {
  const { saju, daeun, currentDaeun, seun, currentAge } = result;
  const counts = ohCounts(saju);
  const ohDesc = OH.map((n,i) => `${n}(${OH_HJ[i]}):${counts[i]}개`).join(" ");
  const currentYear = new Date().getFullYear();
  const dayCg = saju.dp.cg;

  // 사주 기둥 + 십성
  const formatPillar = (name: string, p: Pillar, isDay?: boolean) => {
    const cgSs = isDay ? "일간" : calcSipsung(dayCg, p.cg);
    const jjSs = calcSipsungJJ(dayCg, p.jj);
    return `${name}: ${CG[p.cg]}${JJ[p.jj]}(${CG_HJ[p.cg]}${JJ_HJ[p.jj]}) — 천간:${OH[CG_OH[p.cg]]}(${cgSs}) 지지:${OH[JJ_OH[p.jj]]}(${jjSs})`;
  };
  const pillars = [
    formatPillar("년주", saju.yp),
    formatPillar("월주", saju.mp),
    formatPillar("일주", saju.dp, true) + " ← 본인",
    saju.hp ? formatPillar("시주", saju.hp) : "시주: 미상",
  ].join("\n");

  // 합충형 분석
  const relations = analyzeSajuRelations(saju);
  const relDesc = relations.length > 0 ? relations.join("\n") : "특별한 합/충/형 없음";

  // 용신
  const ys = estimateYongsin(saju);

  // 대운 + 십성
  const daeunDesc = daeun.map(d => {
    const dSs = calcSipsung(dayCg, d.cg);
    return `  ${d.startAge}~${d.endAge}세: ${CG[d.cg]}${JJ[d.jj]}(${dSs})${d.isCurrent ? " ← 현재" : ""}`;
  }).join("\n");

  // 세운 십성
  const seunSs = calcSipsung(dayCg, seun.cg);

  // 오행 강약 분석
  const maxOh = counts.indexOf(Math.max(...counts));
  const minOh = counts.indexOf(Math.min(...counts));
  const ohAnalysis = `가장 강한 오행: ${OH[maxOh]}(${counts[maxOh]}개) / 가장 약한 오행: ${OH[minOh]}(${counts[minOh]}개)`;

  return `[사주 정보]
생년월일: ${year}년 ${month}월 ${day}일 / 성별: ${gender === "F" ? "여성" : "남성"} / 현재 나이: ${currentAge}세

[사주팔자 — 십성 포함]
${pillars}

[오행 분포]
${ohDesc}
${ohAnalysis}

[용신(用神) 추정]
${ys.yongsin}(${OH_HJ[ys.yongsinOh]}) — ${ys.reason}

[합(合)/충(沖)/형(刑) 분석]
${relDesc}

[대운 흐름 — 십성 포함]
${daeunDesc}

[현재 대운]
${currentDaeun ? `${CG[currentDaeun.cg]}${JJ[currentDaeun.jj]} 대운 (${calcSipsung(dayCg, currentDaeun.cg)}, ${currentDaeun.startAge}~${currentDaeun.endAge}세)` : "산출 불가"}

[${currentYear}년 세운]
${CG[seun.cg]}${JJ[seun.jj]}(${CG_HJ[seun.cg]}${JJ_HJ[seun.jj]}) — ${OH[CG_OH[seun.cg]]}${OH[JJ_OH[seun.jj]]}(${seunSs})

${!saju.hp ? "※ 시주 미상으로 년·월·일주 기준 분석합니다." : ""}`;
}
