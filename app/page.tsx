"use client";
import { useState } from "react";
import { calcSaju, sajuToPromptContext, HOURS, CG, CG_HJ, JJ, JJ_HJ, OH, OH_HJ, OH_C, CG_OH, JJ_OH, ohCounts } from "@/lib/saju";
import type { Saju } from "@/lib/saju";

// ── 타입 ─────────────────────────────────────────────────────────────────────
interface Message { role: "user" | "assistant"; content: string; }
interface Form { year: string; month: string; day: string; hour: number; gender: string; }

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function Page() {
  const [step, setStep]       = useState<"form" | "chat">("form");
  const [form, setForm]       = useState<Form>({ year: "", month: "", day: "", hour: 11, gender: "F" });
  const [saju, setSaju]       = useState<Saju | null>(null);
  const [sajuCtx, setSajuCtx] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);

  const upd = (k: keyof Form, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  // 사주 계산 후 채팅 시작
  function startChat() {
    if (!form.year || !form.month || !form.day) return;
    const s = calcSaju(+form.year, +form.month, +form.day, +form.hour);
    const ctx = sajuToPromptContext(s, form.gender, +form.year, +form.month, +form.day);
    setSaju(s);
    setSajuCtx(ctx);
    const welcome: Message = {
      role: "assistant",
      content: `안녕하세요! ${form.year}년 ${form.month}월 ${form.day}일생 ${form.gender === "F" ? "여성" : "남성"}분의 사주를 확인했습니다.\n\n일간(日干)은 **${CG[s.dp.cg]}${JJ[s.dp.jj]}(${CG_HJ[s.dp.cg]}${JJ_HJ[s.dp.jj]})**으로, 이것이 당신의 핵심 기운입니다.\n\n궁금한 것은 무엇이든 물어보세요. 성격, 직업운, 재물운, 연애운, 올해 운세 등 어떤 것이든 사주를 바탕으로 분석해드립니다. 😊`,
    };
    setMessages([welcome]);
    setStep("chat");
  }

  // 메시지 전송
  async function send() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          sajuContext: sajuCtx,
        }),
      });

      if (!res.ok) throw new Error("API 오류");

      // 스트리밍 처리
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let aiText = "";
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiText += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: aiText };
          return updated;
        });
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "오류가 발생했습니다. 다시 시도해주세요." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.root}>
      <div style={S.bg} />

      {step === "form" && <FormView form={form} upd={upd} onSubmit={startChat} />}
      {step === "chat" && saju && (
        <ChatView
          saju={saju}
          form={form}
          messages={messages}
          input={input}
          loading={loading}
          setInput={setInput}
          onSend={send}
          onReset={() => { setStep("form"); setMessages([]); setSaju(null); }}
        />
      )}
    </div>
  );
}

// ── 입력 폼 ───────────────────────────────────────────────────────────────────
function FormView({ form, upd, onSubmit }: { form: Form; upd: any; onSubmit: () => void }) {
  return (
    <div style={S.formWrap}>
      <div style={S.logo}>
        <p style={S.logoBadge}>四柱八字 · AI 명리</p>
        <h1 style={S.logoTitle}>命<span style={{ color: "#c4952a" }}>·</span>理 AI</h1>
        <p style={S.logoSub}>사주팔자 기반 AI 명리 상담</p>
      </div>

      <div style={S.card}>
        <p style={S.cardTitle}>생년월일시를 입력해주세요</p>

        {([["생년", "year", "예: 1990"], ["생월", "month", "1–12"], ["생일", "day", "1–31"]] as const).map(([label, key, ph]) => (
          <div key={key} style={S.row}>
            <span style={S.lbl}>{label}</span>
            <input
              style={S.inp}
              type="number"
              placeholder={ph}
              value={(form as any)[key]}
              onChange={e => upd(key, e.target.value)}
            />
          </div>
        ))}

        <div style={S.row}>
          <span style={S.lbl}>생시</span>
          <select style={S.sel} value={form.hour} onChange={e => upd("hour", +e.target.value)}>
            {HOURS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>

        <div style={S.row}>
          <span style={S.lbl}>성별</span>
          <div style={{ display: "flex", gap: 8, flex: 1 }}>
            {([["F", "여성"], ["M", "남성"]] as const).map(([v, l]) => (
              <button
                key={v}
                style={{ ...S.gb, ...(form.gender === v ? S.gbOn : {}) }}
                onClick={() => upd("gender", v)}
              >{l}</button>
            ))}
          </div>
        </div>

        <button style={S.cta} onClick={onSubmit}>사주 분석 시작 →</button>
      </div>
    </div>
  );
}

// ── 채팅 뷰 ──────────────────────────────────────────────────────────────────
function ChatView({ saju, form, messages, input, loading, setInput, onSend, onReset }: any) {
  const counts = ohCounts(saju);
  const pillars = [
    { l: "시주", h: "時柱", p: saju.hp },
    { l: "일주", h: "日柱", p: saju.dp },
    { l: "월주", h: "月柱", p: saju.mp },
    { l: "년주", h: "年柱", p: saju.yp },
  ];

  const QUICK = ["성격과 적성을 알려줘", "올해 운세는?", "직업운 분석해줘", "연애운이 궁금해", "재물운 알려줘", "지금 대운이 어때?"];

  return (
    <div style={S.chatRoot}>

      {/* 사이드바 */}
      <aside style={S.sidebar}>
        <div style={S.sideTop}>
          <h2 style={S.sideTitle}>命理 AI</h2>
          <button style={S.resetBtn} onClick={onReset}>← 다시 입력</button>
        </div>

        {/* 사주 카드 */}
        <div style={S.sideCard}>
          <p style={S.sideCardTitle}>사주팔자</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
            {pillars.map(({ l, h, p }) => (
              <div key={l} style={S.pBox}>
                <span style={{ fontSize: 9, color: "#9a8858" }}>{h}</span>
                {p ? (
                  <>
                    <span style={{ fontSize: 22, color: `hsl(${CG_OH[p.cg]*72},60%,55%)` }}>{CG[p.cg]}</span>
                    <span style={{ fontSize: 22, color: `hsl(${JJ_OH[p.jj]*72},60%,55%)` }}>{JJ[p.jj]}</span>
                    <span style={{ fontSize: 9, color: "#7a6535" }}>{CG_HJ[p.cg]}{JJ_HJ[p.jj]}</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 20, color: "#bbb" }}>?</span>
                    <span style={{ fontSize: 20, color: "#bbb" }}>?</span>
                    <span style={{ fontSize: 9, color: "#bbb" }}>미상</span>
                  </>
                )}
                <span style={{ fontSize: 9, color: "#8a7040" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 오행 분포 */}
        <div style={S.sideCard}>
          <p style={S.sideCardTitle}>오행 분포</p>
          {OH.map((name, i) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ width: 14, fontSize: 12, color: OH_C[i], textAlign: "center" }}>{OH_HJ[i]}</span>
              <div style={{ flex: 1, height: 2, background: "#e8e0d0" }}>
                <div style={{ width: `${(counts[i] / Math.max(...counts, 1)) * 100}%`, height: "100%", background: OH_C[i] }} />
              </div>
              <span style={{ fontSize: 10, color: "#9a8858", width: 12 }}>{counts[i]}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 10, color: "#b0a080", textAlign: "center", marginTop: "auto" }}>
          {form.year}년 {form.month}월 {form.day}일<br />
          {form.gender === "F" ? "여성" : "남성"}
        </p>
      </aside>

      {/* 채팅 영역 */}
      <main style={S.chatMain}>

        {/* 메시지 목록 */}
        <div style={S.msgList}>
          {messages.map((m: Message, i: number) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 16 }}>
              {m.role === "assistant" && (
                <div style={S.aiAvatar}>命</div>
              )}
              <div style={{
                ...S.bubble,
                ...(m.role === "user" ? S.bubbleUser : S.bubbleAI),
                maxWidth: "75%",
              }}>
                {m.content.split("\n").map((line, j) => (
                  <span key={j}>
                    {line.split(/(\*\*[^*]+\*\*)/).map((part, k) =>
                      part.startsWith("**") && part.endsWith("**")
                        ? <strong key={k}>{part.slice(2, -2)}</strong>
                        : part
                    )}
                    {j < m.content.split("\n").length - 1 && <br />}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={S.aiAvatar}>命</div>
              <div style={{ ...S.bubble, ...S.bubbleAI, color: "#9a8858" }}>분석 중...</div>
            </div>
          )}
        </div>

        {/* 빠른 질문 */}
        {messages.length <= 1 && (
          <div style={S.quickWrap}>
            {QUICK.map(q => (
              <button key={q} style={S.quickBtn} onClick={() => { setInput(q); }}>
                {q}
              </button>
            ))}
          </div>
        )}

        {/* 입력창 */}
        <div style={S.inputRow}>
          <input
            style={S.inputBox}
            placeholder="궁금한 것을 물어보세요..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && onSend()}
          />
          <button style={{ ...S.sendBtn, opacity: loading || !input.trim() ? 0.5 : 1 }} onClick={onSend} disabled={loading || !input.trim()}>
            전송
          </button>
        </div>
      </main>
    </div>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root:       { minHeight: "100vh", background: "#faf6ee", fontFamily: "Georgia, serif", position: "relative" },
  bg:         { position: "fixed", inset: 0, background: "radial-gradient(ellipse at 20% 0%, rgba(196,149,42,.06) 0%, transparent 60%)", pointerEvents: "none" },

  // 폼
  formWrap:   { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "40px 16px" },
  logo:       { textAlign: "center", marginBottom: 36 },
  logoBadge:  { fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8a7040", border: "1px solid #d4b870", padding: "4px 14px", display: "inline-block", marginBottom: 14 },
  logoTitle:  { fontSize: 56, color: "#2a1a04", margin: "0 0 8px", fontWeight: 400 },
  logoSub:    { fontSize: 13, color: "#8a7040", letterSpacing: "0.1em", margin: 0 },
  card:       { background: "#fff", border: "1px solid #e8d8b0", padding: "36px 32px", width: "100%", maxWidth: 460, boxShadow: "0 4px 24px rgba(139,90,20,.08)" },
  cardTitle:  { fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#8a7040", margin: "0 0 28px" },
  row:        { display: "flex", alignItems: "center", gap: 14, marginBottom: 18 },
  lbl:        { fontSize: 13, color: "#8a7040", width: 36, flexShrink: 0 },
  inp:        { flex: 1, border: "none", borderBottom: "1px solid #ddd0b0", background: "transparent", fontSize: 16, padding: "6px 0", outline: "none", fontFamily: "Georgia, serif", color: "#3a2a0a" },
  sel:        { flex: 1, border: "1px solid #ddd0b0", background: "#fff", fontSize: 13, padding: "7px 10px", outline: "none", fontFamily: "Georgia, serif", color: "#3a2a0a", cursor: "pointer" },
  gb:         { flex: 1, padding: "8px 0", background: "transparent", border: "1px solid #ddd0b0", color: "#8a7040", fontSize: 13, cursor: "pointer", fontFamily: "Georgia, serif" },
  gbOn:       { border: "1px solid #c4952a", color: "#c4952a", background: "rgba(196,149,42,.08)" },
  cta:        { width: "100%", marginTop: 28, padding: "14px 0", background: "linear-gradient(135deg,#c4952a,#8a6018)", border: "none", color: "#fff", fontSize: 14, letterSpacing: "0.1em", cursor: "pointer", fontFamily: "Georgia, serif" },

  // 채팅 레이아웃
  chatRoot:   { display: "flex", height: "100vh", overflow: "hidden" },
  sidebar:    { width: 260, background: "#fff", borderRight: "1px solid #e8d8b0", display: "flex", flexDirection: "column", gap: 16, padding: 20, overflowY: "auto" },
  sideTop:    { display: "flex", justifyContent: "space-between", alignItems: "center" },
  sideTitle:  { fontSize: 18, color: "#2a1a04", margin: 0, fontWeight: 400 },
  resetBtn:   { fontSize: 11, color: "#8a7040", background: "transparent", border: "1px solid #ddd0b0", padding: "4px 10px", cursor: "pointer", fontFamily: "Georgia, serif" },
  sideCard:   { background: "#faf6ee", border: "1px solid #e8d8b0", padding: "14px 16px" },
  sideCardTitle: { fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#8a7040", margin: "0 0 12px" },
  pBox:       { background: "#fff", border: "1px solid #e8d8b0", padding: "10px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 },

  // 채팅 메인
  chatMain:   { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  msgList:    { flex: 1, overflowY: "auto", padding: "24px 28px" },
  aiAvatar:   { width: 32, height: 32, background: "linear-gradient(135deg,#c4952a,#8a6018)", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", flexShrink: 0, marginRight: 10, alignSelf: "flex-start" },
  bubble:     { padding: "12px 16px", fontSize: 14, lineHeight: 1.75, borderRadius: 2 },
  bubbleAI:   { background: "#fff", border: "1px solid #e8d8b0", color: "#3a2a0a" },
  bubbleUser: { background: "linear-gradient(135deg,#c4952a,#8a6018)", color: "#fff" },
  quickWrap:  { padding: "0 28px 16px", display: "flex", flexWrap: "wrap", gap: 8 },
  quickBtn:   { fontSize: 12, color: "#8a7040", background: "#fff", border: "1px solid #ddd0b0", padding: "6px 14px", cursor: "pointer", fontFamily: "Georgia, serif" },
  inputRow:   { padding: "16px 28px", borderTop: "1px solid #e8d8b0", display: "flex", gap: 10, background: "#fff" },
  inputBox:   { flex: 1, border: "1px solid #ddd0b0", padding: "12px 16px", fontSize: 14, outline: "none", fontFamily: "Georgia, serif", color: "#3a2a0a", background: "#faf6ee" },
  sendBtn:    { padding: "12px 24px", background: "linear-gradient(135deg,#c4952a,#8a6018)", border: "none", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "Georgia, serif" },
};
