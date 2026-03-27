"use client";
import { useState, useEffect } from "react";
import { calcAll, calcSaju, sajuToPromptContext, HOURS, CG, CG_HJ, JJ, JJ_HJ, OH, OH_HJ, OH_C, CG_OH, JJ_OH, ohCounts } from "@/lib/saju";
import type { SajuResult, DaeunItem, Saju } from "@/lib/saju";

interface Message { role: "user" | "assistant"; content: string; }
interface Form { name: string; year: string; month: string; day: string; hour: number; gender: string; }
interface PartnerForm { year: string; month: string; day: string; hour: number; gender: string; }

// ── 인라인 마크다운 렌더 ──────────────────────────────────────────────────────
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} style={{ fontWeight: 600, color: "var(--text-primary)" }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    return <span key={i}>{part}</span>;
  });
}

function renderContent(content: string, isUser: boolean) {
  return content.split("\n").map((line, j) => {
    if (line.startsWith("### ")) return <p key={j} style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-accent-dk)", margin: "16px 0 6px" }}>{line.slice(4)}</p>;
    if (line.startsWith("## ")) return <p key={j} style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--text-accent)", margin: "16px 0 8px" }}>{line.slice(3)}</p>;
    if (line.startsWith("# ")) return <p key={j} style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: "16px 0 8px" }}>{line.slice(2)}</p>;
    if (line.startsWith("> ")) return <div key={j} style={{ borderLeft: "2px solid var(--border-accent)", paddingLeft: 12, color: "var(--text-md)", margin: "8px 0", fontStyle: "italic" }}>{line.slice(2)}</div>;
    if (line.startsWith("- ")) return <div key={j} style={{ display: "flex", gap: 8, margin: "4px 0" }}><span style={{ color: "var(--text-accent-dk)", flexShrink: 0, fontFamily: "var(--font-display)", fontSize: 11 }}>—</span><span style={{ color: "var(--text-md)" }}>{renderInline(line.slice(2))}</span></div>;
    if (line.match(/^\d+\. /)) return <div key={j} style={{ display: "flex", gap: 8, margin: "4px 0" }}><span style={{ color: "var(--text-accent-dk)", flexShrink: 0, fontFamily: "var(--font-display)", fontSize: 11, minWidth: 16 }}>{line.match(/^\d+/)?.[0]}.</span><span style={{ color: "var(--text-md)" }}>{renderInline(line.replace(/^\d+\. /, ""))}</span></div>;
    if (line === "---" || line === "***") return <hr key={j} style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0" }} />;
    if (line === "") return <div key={j} style={{ height: 8 }} />;
    return <div key={j} style={{ color: isUser ? "rgba(255,255,255,0.92)" : "var(--text-md)", lineHeight: 1.7 }}>{renderInline(line)}</div>;
  });
}

// ── 오행 색상 (Hum 팔레트로 조정) ───────────────────────────────────────────
const OH_HUM = ["#1A9E5C","#C47A10","#6B6B78","#1D5FA8","#505060"];

export default function Page() {
  const [step, setStep]           = useState<"form" | "chat">("form");
  const [form, setForm]           = useState<Form>({ name: "", year: "", month: "", day: "", hour: 11, gender: "F" });
  const [result, setResult]       = useState<SajuResult | null>(null);
  const [sajuCtx, setSajuCtx]     = useState("");
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [showPartner, setShowPartner] = useState(false);
  const [partner, setPartner]     = useState<PartnerForm>({ year: "", month: "", day: "", hour: -1, gender: "M" });
  const [partnerSaju, setPartnerSaju] = useState<Saju | null>(null);
  const [sideCollapsed, setSideCollapsed] = useState(false);

  const upd  = (k: keyof Form, v: string | number) => setForm(p => ({ ...p, [k]: v }));
  const updP = (k: keyof PartnerForm, v: string | number) => setPartner(p => ({ ...p, [k]: v }));

  function startChat() {
    if (!form.year || !form.month || !form.day) return;
    const r = calcAll(+form.year, +form.month, +form.day, +form.hour, form.gender);
    const ctx = sajuToPromptContext(r, form.gender, +form.year, +form.month, +form.day);
    setResult(r); setSajuCtx(ctx);
    const dp = r.saju.dp;
    const cd = r.currentDaeun;
    const sy = new Date().getFullYear();
    setMessages([{
      role: "assistant",
      content: `안녕하세요. ${form.year}년 ${form.month}월 ${form.day}일생 ${form.gender === "F" ? "여성" : "남성"}분의 사주를 분석했습니다.\n\n일간(日干)은 **${CG[dp.cg]}${JJ[dp.jj]}(${CG_HJ[dp.cg]}${JJ_HJ[dp.jj]})**으로 이것이 당신의 핵심 기운입니다.\n\n현재 **${cd ? CG[cd.cg] + JJ[cd.jj] + " 대운" : "대운 산출 중"}** 흐름이며, **${sy}년 ${CG[r.seun.cg]}${JJ[r.seun.jj]} 세운**이 운세에 영향을 주고 있어요.\n\n무엇이든 물어보세요.`
    }]);
    setStep("chat");
  }

  function analyzePartner() {
    if (!partner.year || !partner.month || !partner.day) return;
    const ps = calcSaju(+partner.year, +partner.month, +partner.day, +partner.hour);
    setPartnerSaju(ps);
    setShowPartner(false);
    const pDp = ps.dp;
    const compatCtx = `\n\n[궁합 상대방]\n생년월일: ${partner.year}년 ${partner.month}월 ${partner.day}일 / 성별: ${partner.gender === "F" ? "여성" : "남성"}\n사주: ${CG[ps.yp.cg]}${JJ[ps.yp.jj]} ${CG[ps.mp.cg]}${JJ[ps.mp.jj]} ${CG[pDp.cg]}${JJ[pDp.jj]}\n일간: ${CG[pDp.cg]}${JJ[pDp.jj]}(${CG_HJ[pDp.cg]}${JJ_HJ[pDp.jj]})`;
    setSajuCtx(prev => prev + compatCtx);
    setInput(`${partner.year}년 ${partner.month}월 ${partner.day}일생 ${partner.gender === "F" ? "여성" : "남성"}(${CG[pDp.cg]}${JJ[pDp.jj]} 일간)과의 궁합을 분석해주세요.`);
  }

  async function send(override?: string) {
    const txt = override ?? input;
    if (!txt.trim() || loading) return;
    const userMsg: Message = { role: "user", content: txt };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs); setInput(""); setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs, sajuContext: sajuCtx }),
      });
      if (!res.ok) throw new Error();
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let aiText = "";
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiText += decoder.decode(value, { stream: true });
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: "assistant", content: aiText }; return u; });
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "오류가 발생했습니다. 다시 시도해주세요." }]);
    } finally { setLoading(false); }
  }

  if (step === "form") return <FormPage form={form} upd={upd} onSubmit={startChat} />;

  return (
    <div className="light" style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>

      {/* ── 사이드바 ─────────────────────────────────────── */}
      <aside style={{
        width: sideCollapsed ? 52 : 260,
        minWidth: sideCollapsed ? 52 : 260,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        transition: "width 0.2s cubic-bezier(0.4,0,0.2,1), min-width 0.2s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
      }}>
        {/* 사이드바 헤더 */}
        <div style={{ padding: "14px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 52 }}>
          {!sideCollapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4" fill="var(--text-primary)"/>
                <circle cx="12" cy="12" r="7" stroke="var(--text-primary)" strokeWidth="1" strokeOpacity="0.35"/>
                <circle cx="12" cy="12" r="10.5" stroke="var(--text-primary)" strokeWidth="0.5" strokeOpacity="0.2"/>
              </svg>
              <span style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
                Aura
              </span>
            </div>
          )}
          <button onClick={() => setSideCollapsed(!sideCollapsed)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: "var(--radius-md)", color: "var(--text-muted)", display: "flex", alignItems: "center", marginLeft: sideCollapsed ? "auto" : 0 }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-lt)")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>

        {!sideCollapsed && result && (
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>

            {/* 사주팔자 + 이름 */}
            <SideSection label="사주팔자" right={form.name ? <span style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{form.name}</span> : undefined}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
                {[
                  { l: "시주", h: "時", p: result.saju.hp },
                  { l: "일주", h: "日", p: result.saju.dp },
                  { l: "월주", h: "月", p: result.saju.mp },
                  { l: "년주", h: "年", p: result.saju.yp },
                ].map(({ l, h, p }) => (
                  <div key={l} style={{ background: "var(--surface-lt)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "8px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 8, letterSpacing: "0.1em", color: "var(--text-muted)" }}>{h}</span>
                    {p ? (
                      <>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 18, lineHeight: 1.2, color: OH_HUM[CG_OH[p.cg]] }}>{CG[p.cg]}</span>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 18, lineHeight: 1.2, color: OH_HUM[JJ_OH[p.jj]] }}>{JJ[p.jj]}</span>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 8, color: "var(--text-muted)" }}>{CG_HJ[p.cg]}{JJ_HJ[p.jj]}</span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 16, color: "var(--text-disabled)" }}>?</span>
                        <span style={{ fontSize: 16, color: "var(--text-disabled)" }}>?</span>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 8, color: "var(--text-disabled)" }}>미상</span>
                      </>
                    )}
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 8, color: "var(--text-lt)", marginTop: 2 }}>{l}</span>
                  </div>
                ))}
              </div>
            </SideSection>

            {/* 오행 분포 */}
            <SideSection label="오행 분포">
              {(() => {
                const counts = ohCounts(result.saju);
                const mx = Math.max(...counts, 1);
                return OH.map((n, i) => (
                  <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 10, color: OH_HUM[i], width: 14, textAlign: "center" }}>{OH_HJ[i]}</span>
                    <div style={{ flex: 1, height: 2, background: "var(--surface-md)", borderRadius: 1 }}>
                      <div style={{ width: `${(counts[i] / mx) * 100}%`, height: "100%", background: OH_HUM[i], borderRadius: 1, transition: "width .6s ease" }} />
                    </div>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "var(--text-muted)", width: 12, textAlign: "right" }}>{counts[i]}</span>
                  </div>
                ));
              })()}
            </SideSection>

            {/* 대운 */}
            <SideSection label="대운 흐름">
              {result.daeun.map((d: DaeunItem) => (
                <div key={d.startAge} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
                  borderRadius: "var(--radius-md)", marginBottom: 2,
                  background: d.isCurrent ? "var(--accent-dim)" : "transparent",
                  border: d.isCurrent ? "1px solid var(--border-accent)" : "1px solid transparent",
                }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 9, color: d.isCurrent ? "var(--text-accent)" : "var(--text-muted)", minWidth: 44, letterSpacing: "0.02em" }}>{d.startAge}–{d.endAge}세</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 13, color: d.isCurrent ? "var(--text-accent)" : OH_HUM[CG_OH[d.cg]] }}>{CG[d.cg]}</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 13, color: d.isCurrent ? "var(--text-accent)" : OH_HUM[JJ_OH[d.jj]] }}>{JJ[d.jj]}</span>
                  {d.isCurrent && <span style={{ fontFamily: "var(--font-display)", fontSize: 8, color: "var(--text-accent)", marginLeft: "auto", letterSpacing: "0.1em" }}>NOW</span>}
                </div>
              ))}
            </SideSection>

            {/* 세운 */}
            <SideSection label={`${new Date().getFullYear()} 세운`}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: OH_HUM[CG_OH[result.seun.cg]] }}>{CG[result.seun.cg]}</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: OH_HUM[JJ_OH[result.seun.jj]] }}>{JJ[result.seun.jj]}</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "var(--text-muted)" }}>{CG_HJ[result.seun.cg]}{JJ_HJ[result.seun.jj]}</span>
              </div>
            </SideSection>

            {/* 궁합 */}
            <div style={{ padding: "0 12px", marginTop: 4 }}>
              <button onClick={() => setShowPartner(!showPartner)} style={{
                width: "100%", padding: "8px 12px", background: showPartner ? "var(--accent-dim)" : "transparent",
                border: "1px solid var(--border-dk)", borderRadius: "var(--radius-md)",
                fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 600,
                letterSpacing: "0.12em", textTransform: "uppercase",
                color: showPartner ? "var(--text-accent)" : "var(--text-lt)",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                transition: "all 0.12s",
              }}>
                <span>💑</span> 궁합 분석
              </button>
            </div>

            {showPartner && (
              <div style={{ padding: "12px 12px 0" }} className="fade-in">
                <div style={{ background: "var(--surface-lt)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px 14px 12px" }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 500, letterSpacing: "0.20em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>상대방 정보</p>
                  {([["년", "year", "1988"], ["월", "month", "3"], ["일", "day", "15"]] as const).map(([l, k, ph]) => (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 9, color: "var(--text-muted)", width: 14, letterSpacing: "0.1em" }}>{l.toUpperCase()}</span>
                      <input style={{
                        flex: 1, background: "var(--surface)", border: "1px solid var(--border-dk)",
                        borderRadius: "var(--radius)", padding: "6px 10px",
                        fontFamily: "var(--font-display)", fontSize: 12, color: "var(--text-primary)",
                        outline: "none", letterSpacing: "0.02em",
                      }} type="number" placeholder={ph} value={(partner as any)[k]}
                        onChange={e => updP(k, e.target.value)}
                        onFocus={e => (e.currentTarget.style.borderColor = "var(--border-accent)")}
                        onBlur={e => (e.currentTarget.style.borderColor = "var(--border-dk)")} />
                    </div>
                  ))}
                  <div style={{ marginBottom: 8 }}>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>시</p>
                    <select style={{
                      width: "100%", background: "var(--surface)", border: "1px solid var(--border-dk)",
                      borderRadius: "var(--radius)", padding: "6px 10px",
                      fontFamily: "var(--font-display)", fontSize: 11, color: "var(--text-primary)",
                      outline: "none", cursor: "pointer",
                    }} value={partner.hour} onChange={e => updP("hour", +e.target.value)}>
                      {HOURS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    {([["F", "여성"], ["M", "남성"]] as const).map(([v, l]) => (
                      <button key={v} onClick={() => updP("gender", v)} style={{
                        flex: 1, padding: "6px 0",
                        background: partner.gender === v ? "var(--accent-dim)" : "transparent",
                        border: `1px solid ${partner.gender === v ? "var(--border-accent)" : "var(--border-dk)"}`,
                        borderRadius: "var(--radius)", cursor: "pointer",
                        fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 600,
                        letterSpacing: "0.08em", textTransform: "uppercase",
                        color: partner.gender === v ? "var(--text-accent)" : "var(--text-lt)",
                      }}>{l}</button>
                    ))}
                  </div>
                  <button onClick={analyzePartner} style={{
                    width: "100%", padding: "9px", background: "linear-gradient(135deg, #F2F2F5, #C8C8D0, #9898A8)",
                    border: "none", borderRadius: "var(--radius)", cursor: "pointer",
                    fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600,
                    letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--btn-primary-text)",
                  }}>궁합 분석하기</button>
                </div>
              </div>
            )}

            {partnerSaju && (
              <SideSection label="상대 사주">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
                  {[{ l: "일주", p: partnerSaju.dp }, { l: "월주", p: partnerSaju.mp }, { l: "년주", p: partnerSaju.yp }].map(({ l, p }) => (
                    <div key={l} style={{ background: "var(--surface-lt)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "8px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: OH_HUM[CG_OH[p.cg]] }}>{CG[p.cg]}</span>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: OH_HUM[JJ_OH[p.jj]] }}>{JJ[p.jj]}</span>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 8, color: "var(--text-muted)" }}>{l}</span>
                    </div>
                  ))}
                </div>
              </SideSection>
            )}

          </div>
        )}

        {/* ── 사이드바 푸터 ── */}
        {!sideCollapsed && (
          <div style={{ borderTop: "1px solid var(--border)", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            {/* 다시 입력 아이콘 */}
            <button title="다시 입력" onClick={() => { setStep("form"); setMessages([]); setResult(null); setPartnerSaju(null); }}
              style={{ width: 32, height: 32, background: "transparent", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-lt)"; e.currentTarget.style.color = "var(--text-lt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>
            </button>
            {/* spacer */}
            <span style={{ flex: 1 }} />
            {/* 세팅 아이콘 */}
            <button title="설정"
              style={{ width: 32, height: 32, background: "transparent", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-lt)"; e.currentTarget.style.color = "var(--text-lt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>
        )}
      </aside>

      {/* ── 메인 채팅 ─────────────────────────────────────── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)" }}>

        {/* 헤더 */}
        <div style={{ padding: "0 24px", height: 52, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 500, letterSpacing: "0.20em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            {form.year}년 {form.month}월 {form.day}일 · {form.gender === "F" ? "여성" : "남성"}
          </span>
          {result?.currentDaeun && (
            <>
              <span style={{ color: "var(--border-dk)", fontSize: 10 }}>|</span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.08em", color: "var(--text-accent-dk)" }}>
                {CG[result.currentDaeun.cg]}{JJ[result.currentDaeun.jj]} 대운
              </span>
            </>
          )}
        </div>

        {/* 메시지 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 28px 0" }}>
          {messages.map((m, i) => (
            <div key={i} className="fade-in" style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 16 }}>

              <div style={{
                maxWidth: "72%", padding: "12px 16px",
                background: m.role === "user" ? "var(--surface-md)" : "var(--surface)",
                border: `1px solid ${m.role === "user" ? "var(--border-dk)" : "var(--border)"}`,
                borderRadius: m.role === "user" ? "var(--radius-lg) var(--radius-sm) var(--radius-lg) var(--radius-lg)" : "var(--radius-sm) var(--radius-lg) var(--radius-lg) var(--radius-lg)",
                fontFamily: "var(--font-body)", fontSize: 14, lineHeight: 1.7,
              }}>
                {renderContent(m.content, m.role === "user")}
              </div>
            </div>
          ))}
          {loading && (
            <div className="fade-in" style={{ display: "flex", marginBottom: 16 }}>

              <div style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm) var(--radius-lg) var(--radius-lg) var(--radius-lg)", display: "flex", gap: 5, alignItems: "center" }}>
                {[0, 1, 2].map(i => <span key={i} className="typing-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--text-muted)", display: "block", animationDelay: `${i * 0.2}s` }} />)}
              </div>
            </div>
          )}
        </div>

        {/* 빠른 질문 */}
        {messages.length <= 1 && (
          <div style={{ padding: "16px 28px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["성격과 적성 분석해줘", "올해 운세는?", "현재 대운 해석해줘", "직업운 알려줘", "연애운이 궁금해", "재물운 분석해줘"].map(q => (
              <button key={q} onClick={() => setInput(q)} style={{
                padding: "6px 14px", background: "transparent",
                border: "1px solid var(--border-dk)", borderRadius: "var(--radius-full)",
                fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 500,
                letterSpacing: "0.06em", color: "var(--text-lt)", cursor: "pointer",
                transition: "all 0.12s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.color = "var(--text-md)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-dk)"; e.currentTarget.style.color = "var(--text-lt)"; }}>
                {q}
              </button>
            ))}
          </div>
        )}

        {/* 입력창 */}
        <div style={{ padding: "16px 28px 20px", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 10, background: "var(--surface)", border: "1px solid var(--border-dk)", borderRadius: "var(--radius-lg)", padding: "10px 12px", transition: "border-color 0.15s" }}
            onFocus={() => { }} >
            <input style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-primary)",
              lineHeight: 1.5,
            }} placeholder="무엇이 궁금하세요?"
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()} />
            <button onClick={() => send()} disabled={loading || !input.trim()} style={{
              width: 32, height: 32, flexShrink: 0,
              background: loading || !input.trim() ? "var(--surface-md)" : "linear-gradient(135deg, #F2F2F5, #C8C8D0, #9898A8)",
              border: "none", borderRadius: "var(--radius-md)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}>
              {loading
                ? <div style={{ width: 12, height: 12, border: "2px solid var(--border-dk)", borderTopColor: "var(--text-accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={loading || !input.trim() ? "var(--text-muted)" : "var(--btn-primary-text)"} strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              }
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── 사이드바 섹션 컴포넌트 ────────────────────────────────────────────────────
function SideSection({ label, children, right }: { label: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ padding: "0 12px", marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 8px", paddingLeft: 2 }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 500, letterSpacing: "0.20em", textTransform: "uppercase", color: "var(--text-muted)", margin: 0 }}>{label}</p>
        {right}
      </div>
      {children}
    </div>
  );
}

// ── 입력 폼 (라이트 테마) ────────────────────────────────────────────────────
function FormPage({ form, upd, onSubmit }: { form: Form; upd: any; onSubmit: () => void }) {
  return (
    <div className="light" style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>

        {/* 로고 */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: "50%", background: "var(--surface-md)", marginBottom: 16 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4" fill="var(--text-primary)"/>
              <circle cx="12" cy="12" r="7" stroke="var(--text-primary)" strokeWidth="1" strokeOpacity="0.35"/>
              <circle cx="12" cy="12" r="10.5" stroke="var(--text-primary)" strokeWidth="0.5" strokeOpacity="0.2"/>
            </svg>
          </div>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 500, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 16 }}>사주팔자 · AI 운명 상담</p>
          <h1 style={{ fontFamily: "var(--font-body)", fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: "0 0 8px" }}>Aura</h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-lt)" }}>사주팔자 기반 AI 운명 상담</p>
        </div>

        {/* 카드 */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "32px 28px", boxShadow: "var(--shadow-md)" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 500, letterSpacing: "0.20em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 24 }}>생년월일시 입력</p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>이름</label>
            <input style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border-dk)", borderRadius: "var(--radius)", padding: "10px 14px", fontFamily: "var(--font-display)", fontSize: 14, color: "var(--text-primary)", outline: "none", letterSpacing: "0.02em" }}
              type="text" placeholder="예: 홍길동" value={form.name} onChange={e => upd("name", e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-dim)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border-dk)"; e.currentTarget.style.boxShadow = "none"; }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>생년</label>
            <input style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border-dk)", borderRadius: "var(--radius)", padding: "10px 14px", fontFamily: "var(--font-display)", fontSize: 14, color: "var(--text-primary)", outline: "none", letterSpacing: "0.02em" }}
              type="number" placeholder="예: 1990" value={form.year} onChange={e => upd("year", e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-dim)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border-dk)"; e.currentTarget.style.boxShadow = "none"; }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>생월</label>
            <input style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border-dk)", borderRadius: "var(--radius)", padding: "10px 14px", fontFamily: "var(--font-display)", fontSize: 14, color: "var(--text-primary)", outline: "none", letterSpacing: "0.02em" }}
              type="number" placeholder="1-12" value={form.month} onChange={e => upd("month", e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-dim)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border-dk)"; e.currentTarget.style.boxShadow = "none"; }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>생일</label>
            <input style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border-dk)", borderRadius: "var(--radius)", padding: "10px 14px", fontFamily: "var(--font-display)", fontSize: 14, color: "var(--text-primary)", outline: "none", letterSpacing: "0.02em" }}
              type="number" placeholder="1-31" value={form.day} onChange={e => upd("day", e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-dim)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border-dk)"; e.currentTarget.style.boxShadow = "none"; }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>생시</label>
            <select style={{
              width: "100%", background: "var(--surface)", border: "1px solid var(--border-dk)",
              borderRadius: "var(--radius)", padding: "10px 14px",
              fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-primary)",
              outline: "none", cursor: "pointer",
            }} value={form.hour} onChange={e => upd("hour", +e.target.value)}>
              {HOURS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={{ fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>성별</label>
            <div style={{ display: "flex", gap: 8 }}>
              {([["F", "여성"], ["M", "남성"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => upd("gender", v)} style={{
                  flex: 1, padding: "10px 0",
                  background: form.gender === v ? "var(--accent-dim)" : "var(--btn-outline-bg)",
                  border: `1px solid ${form.gender === v ? "var(--border-accent)" : "var(--border-dk)"}`,
                  borderRadius: "var(--radius)",
                  fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  color: form.gender === v ? "var(--text-accent)" : "var(--text-md)",
                  cursor: "pointer", transition: "all 0.12s",
                }}>{l}</button>
              ))}
            </div>
          </div>

          <button onClick={onSubmit} style={{
            width: "100%", padding: "12px 0",
            background: "var(--btn-primary-bg)",
            border: "none", borderRadius: "var(--radius)",
            fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 600,
            letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--btn-primary-text)",
            cursor: "pointer", transition: "background 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--btn-primary-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--btn-primary-bg)")}>
            사주 분석 시작
          </button>
        </div>
      </div>
    </div>
  );
}
