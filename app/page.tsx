"use client";
import { useState, useEffect, useRef } from "react";
import { getSupabase } from "@/lib/supabase";
import { calcAll, calcSaju, sajuToPromptContext, HOURS, CG, CG_HJ, JJ, JJ_HJ, OH, OH_HJ, OH_C, CG_OH, JJ_OH, ohCounts } from "@/lib/saju";
import type { SajuResult, DaeunItem, Saju } from "@/lib/saju";

interface Message { role: "user" | "assistant"; content: string; }
interface Form { name: string; year: string; month: string; day: string; hour: number; gender: string; }
interface PartnerForm { name: string; year: string; month: string; day: string; hour: number; gender: string; }

// ── 인라인 마크다운 렌더 ──────────────────────────────────────────────────────
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} style={{ fontWeight: 600, color: "#111116" }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    return <span key={i}>{part}</span>;
  });
}

function renderContent(content: string, isUser: boolean) {
  return content.split("\n").map((line, j) => {
    if (line.startsWith("### ")) return <p key={j} style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#9898A8", margin: "16px 0 6px" }}>{line.slice(4)}</p>;
    if (line.startsWith("## ")) return <p key={j} style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 600, color: "#2E2E38", margin: "16px 0 8px" }}>{line.slice(3)}</p>;
    if (line.startsWith("# ")) return <p key={j} style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14, fontWeight: 600, color: "#111116", margin: "16px 0 8px" }}>{line.slice(2)}</p>;
    if (line.startsWith("> ")) return <div key={j} style={{ borderLeft: "2px solid rgba(46,46,56,0.25)", paddingLeft: 12, color: "#3A3A44", margin: "8px 0", fontStyle: "italic" }}>{line.slice(2)}</div>;
    if (line.startsWith("- ")) return <div key={j} style={{ display: "flex", gap: 8, margin: "4px 0" }}><span style={{ color: "#9898A8", flexShrink: 0, fontFamily: "'Geist Mono', monospace", fontSize: 11 }}>—</span><span style={{ color: "#3A3A44" }}>{renderInline(line.slice(2))}</span></div>;
    if (line.match(/^\d+\. /)) return <div key={j} style={{ display: "flex", gap: 8, margin: "4px 0" }}><span style={{ color: "#9898A8", flexShrink: 0, fontFamily: "'Geist Mono', monospace", fontSize: 11, minWidth: 16 }}>{line.match(/^\d+/)?.[0]}.</span><span style={{ color: "#3A3A44" }}>{renderInline(line.replace(/^\d+\. /, ""))}</span></div>;
    if (line === "---" || line === "***") return <hr key={j} style={{ border: "none", borderTop: "1px solid #E2E2E8", margin: "12px 0" }} />;
    if (line === "") return <div key={j} style={{ height: 8 }} />;
    return <div key={j} style={{ color: isUser ? "#2E2E38" : "#3A3A44", lineHeight: 1.7 }}>{renderInline(line)}</div>;
  });
}

// ── 오행 색상 (Hum 팔레트로 조정) ───────────────────────────────────────────
const OH_HUM = ["#1A9E5C","#C47A10","#6B6B78","#1D5FA8","#505060"];

export default function Page() {
  const [user, setUser]           = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [step, setStep]           = useState<"login" | "form" | "chat">("login");
  const [form, setForm]           = useState<Form>({ name: "", year: "", month: "", day: "", hour: 11, gender: "F" });
  const [result, setResult]       = useState<SajuResult | null>(null);
  const [sajuCtx, setSajuCtx]     = useState("");
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [showPartner, setShowPartner] = useState(false);
  const [partner, setPartner]     = useState<PartnerForm>({ name: "", year: "", month: "", day: "", hour: -1, gender: "M" });
  const [partnerSaju, setPartnerSaju] = useState<Saju | null>(null);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [sideSecondary, setSideSecondary] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<any>(null);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showPeopleModal, setShowPeopleModal] = useState(false);
  const [people, setPeople] = useState<any[]>([]);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [personForm, setPersonForm] = useState<PartnerForm>({ name: "", year: "", month: "", day: "", hour: -1, gender: "M" });
  const [activePersonId, setActivePersonId] = useState<string | null>(null);
  const [gunghapPending, setGunghapPending] = useState<string | null>(null); // pending 궁합 message
  const [showGunghapPicker, setShowGunghapPicker] = useState(false);
  const [gunghapAddMode, setGunghapAddMode] = useState(false); // adding new person inline for 궁합
  const [gunghapForm, setGunghapForm] = useState<PartnerForm>({ name: "", year: "", month: "", day: "", hour: -1, gender: "M" });
  const [gunghapPartner, setGunghapPartner] = useState<any>(null); // active 궁합 partner for badge + context
  const [gunghapCtx, setGunghapCtx] = useState<string>(""); // combined saju context when 궁합 active
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"account">("account");
  const abortRef = useRef<AbortController | null>(null);
  const composingRef = useRef(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // ── Close profile menu on click outside ──
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    if (showProfileMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showProfileMenu]);

  // ── Load chat history list ──
  async function loadChatHistory(userId: string, sb: any) {
    const { data } = await sb.from("chat_sessions")
      .select("id, messages, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setChatHistory(data);
    return data || [];
  }

  // ── Load saved profile and jump to chat if exists ──
  async function loadProfile(userId: string, sb?: any) {
    const s = sb || supabase;
    if (!s) { console.log("[saju] loadProfile: no supabase client"); setStep("form"); return; }
    console.log("[saju] loadProfile: querying profiles for", userId);
    const { data: profile, error } = await s.from("profiles").select("*").eq("id", userId).maybeSingle();
    console.log("[saju] loadProfile result:", { profile, error: error?.message });
    if (error) { console.log("[saju] profile query error, showing form"); setStep("form"); return; }
    if (!profile) { console.log("[saju] no profile found, showing form"); setStep("form"); return; }
    if (profile.year && profile.month && profile.day) {
      const f: Form = {
        name: profile.name || "",
        year: String(profile.year),
        month: String(profile.month),
        day: String(profile.day),
        hour: profile.hour ?? 11,
        gender: profile.gender || "F",
      };
      setForm(f);
      const r = calcAll(profile.year, profile.month, profile.day, profile.hour ?? 11, f.gender);
      const ctx = sajuToPromptContext(r, f.gender, profile.year, profile.month, profile.day);
      setResult(r); setSajuCtx(ctx);
      const dp = r.saju.dp;
      const cd = r.currentDaeun;
      const sy = new Date().getFullYear();
      const greeting = `안녕하세요, ${f.name || ""}님. ${f.year}년 ${f.month}월 ${f.day}일생 ${f.gender === "F" ? "여성" : "남성"}분의 사주를 불러왔습니다.\n\n일간(日干)은 **${CG[dp.cg]}${JJ[dp.jj]}(${CG_HJ[dp.cg]}${JJ_HJ[dp.jj]})**으로 이것이 당신의 핵심 기운입니다.\n\n현재 **${cd ? CG[cd.cg] + JJ[cd.jj] + " 대운" : "대운 산출 중"}** 흐름이며, **${sy}년 ${CG[r.seun.cg]}${JJ[r.seun.jj]} 세운**이 운세에 영향을 주고 있어요.\n\n무엇이든 물어보세요.`;
      setStep("chat");

      // Try to load the most recent chat session, or create a new one
      const { data: existingSession } = await s.from("chat_sessions")
        .select("id, messages")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Load chat history list
      const history = await loadChatHistory(userId, s);

      if (history.length > 0 && history[0].messages?.length > 0) {
        console.log("[saju] loaded existing chat session:", history[0].id);
        setMessages(history[0].messages);
        setSessionId(history[0].id);
      } else {
        console.log("[saju] creating new chat session");
        setMessages([{ role: "assistant", content: greeting }]);
        const { data: newSession }: any = await s.from("chat_sessions").insert({
          user_id: userId,
          messages: [{ role: "assistant", content: greeting }],
          saju_context: ctx,
          created_at: new Date().toISOString(),
        }).select("id").single();
        if (newSession) {
          setSessionId(newSession.id);
          setChatHistory([{ id: newSession.id, messages: [{ role: "assistant", content: greeting }], created_at: new Date().toISOString() }]);
        }
      }
    } else {
      setStep("form");
    }
  }

  useEffect(() => {
    let subscription: any = null;
    (async () => {
      let sb: any = null;
      try {
        sb = await getSupabase();
        console.log("[saju] getSupabase:", sb ? "ok" : "null");
      } catch (e) {
        console.log("[saju] getSupabase error:", e);
      }
      if (!sb) { setAuthLoading(false); setStep("form"); return; }
      setSupabase(sb);

      let u: any = null;
      try {
        const { data } = await sb.auth.getSession();
        u = data?.session?.user ?? null;
        console.log("[saju] session:", u ? u.email : "no session");
      } catch (e) {
        console.log("[saju] getSession error:", e);
      }
      setUser(u);

      if (u) {
        try {
          await loadProfile(u.id, sb);
          // Load people list
          const { data: ppl } = await sb.from("people").select("*").eq("user_id", u.id).order("created_at", { ascending: false });
          setPeople(ppl || []);
          console.log("[saju] loadProfile done, step will be chat or form");
        } catch (e) {
          console.log("[saju] loadProfile error:", e);
          setStep("form");
        }
      } else {
        console.log("[saju] no user, showing login");
        setStep("login");
      }
      setAuthLoading(false);

      try {
        const { data: { subscription: sub } } = sb.auth.onAuthStateChange(async (event: any, session: any) => {
          console.log("[saju] auth state changed:", event);
          const authUser = session?.user ?? null;
          setUser(authUser);
          if (event === "SIGNED_IN" && authUser) {
            try { await loadProfile(authUser.id, sb); } catch { setStep("form"); }
          } else if (event === "SIGNED_OUT" || !authUser) {
            setStep("login");
          }
        });
        subscription = sub;
      } catch (e) {
        console.log("[saju] onAuthStateChange error:", e);
      }
    })();
    return () => { if (subscription) subscription.unsubscribe(); };
  }, []);

  async function signInWithGoogle() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setStep("login"); setResult(null); setMessages([]);
    setUser(null);
  }

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
    const greeting = `안녕하세요. ${form.year}년 ${form.month}월 ${form.day}일생 ${form.gender === "F" ? "여성" : "남성"}분의 사주를 분석했습니다.\n\n일간(日干)은 **${CG[dp.cg]}${JJ[dp.jj]}(${CG_HJ[dp.cg]}${JJ_HJ[dp.jj]})**으로 이것이 당신의 핵심 기운입니다.\n\n현재 **${cd ? CG[cd.cg] + JJ[cd.jj] + " 대운" : "대운 산출 중"}** 흐름이며, **${sy}년 ${CG[r.seun.cg]}${JJ[r.seun.jj]} 세운**이 운세에 영향을 주고 있어요.\n\n무엇이든 물어보세요.`;
    setMessages([{ role: "assistant", content: greeting }]);
    setStep("chat");

    // ── Save profile & create chat session in Supabase ──
    if (user && supabase) {
      supabase.from("profiles").upsert({
        id: user.id,
        name: form.name,
        year: +form.year,
        month: +form.month,
        day: +form.day,
        hour: +form.hour,
        gender: form.gender,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" }).then(({ error: e }: any) => {
        if (e) console.log("[saju] profile save error:", e.message);
        else console.log("[saju] profile saved");
      });

      supabase.from("chat_sessions").insert({
        user_id: user.id,
        messages: [{ role: "assistant", content: greeting }],
        saju_context: ctx,
        created_at: new Date().toISOString(),
      }).select("id").single().then(({ data }: any) => {
        if (data) setSessionId(data.id);
      });
    }
  }

  async function addPersonFromPartner() {
    if (!partner.name || !partner.year || !partner.month || !partner.day) return;
    if (!supabase || !user) return;
    const ps = calcSaju(+partner.year, +partner.month, +partner.day, +partner.hour);
    setPartnerSaju(ps);
    setShowPartner(false);
    // Save to people table
    const { error } = await supabase.from("people").insert({
      user_id: user.id, name: partner.name, year: +partner.year, month: +partner.month,
      day: +partner.day, hour: +partner.hour, gender: partner.gender,
    });
    if (error) { console.error("Insert people error:", error); alert("저장 실패: " + error.message); }
    await loadPeople();
    setPartner({ name: "", year: "", month: "", day: "", hour: -1, gender: "M" });
  }

  async function loadPeople() {
    if (!supabase || !user) return;
    const { data } = await supabase.from("people").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setPeople(data || []);
  }

  async function savePerson() {
    console.log("[saju] savePerson called", { editingPersonId, personForm });
    if (!supabase || !user || !personForm.name || !personForm.year || !personForm.month || !personForm.day) {
      console.log("[saju] savePerson early return — missing fields", { supabase: !!supabase, user: !!user, name: personForm.name, year: personForm.year, month: personForm.month, day: personForm.day });
      return;
    }
    const payload = {
      name: personForm.name, year: +personForm.year, month: +personForm.month,
      day: +personForm.day, hour: +personForm.hour, gender: personForm.gender,
    };
    const isEdit = editingPersonId && editingPersonId !== "new";
    console.log("[saju] savePerson", isEdit ? "UPDATE" : "INSERT", payload);
    if (isEdit) {
      supabase.from("people").update(payload).eq("id", editingPersonId).then((res: any) => {
        console.log("[saju] update result:", res);
        if (res.error) alert("수정 실패: " + res.error.message);
        loadPeople();
        setPersonForm({ name: "", year: "", month: "", day: "", hour: -1, gender: "M" });
        setEditingPersonId(null);
      }).catch((e: any) => console.error("[saju] update catch:", e));
    } else {
      supabase.from("people").insert({ ...payload, user_id: user.id }).then((res: any) => {
        console.log("[saju] insert result:", res);
        if (res.error) alert("저장 실패: " + res.error.message);
        loadPeople();
        setPersonForm({ name: "", year: "", month: "", day: "", hour: -1, gender: "M" });
        setEditingPersonId(null);
      }).catch((e: any) => console.error("[saju] insert catch:", e));
    }
  }

  async function deletePerson(id: string) {
    if (!supabase || !user) return;
    await supabase.from("people").delete().eq("id", id);
    setPeople(prev => prev.filter(p => p.id !== id));
  }

  async function setAsDefault(person: any) {
    if (!supabase || !user) return;
    // Update profiles table so it persists across refreshes
    await supabase.from("profiles").upsert({
      id: user.id, name: person.name, year: person.year, month: person.month,
      day: person.day, hour: person.hour, gender: person.gender, updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    setForm({ name: person.name, year: String(person.year), month: String(person.month), day: String(person.day), hour: person.hour, gender: person.gender });
    const r = calcAll(person.year, person.month, person.day, person.hour ?? 11, person.gender);
    const ctx = sajuToPromptContext(r, person.gender, person.year, person.month, person.day);
    setResult(r); setSajuCtx(ctx);
    setActivePersonId(person.id);
    // Keep modal open
  }

  function editPerson(p: any) {
    setPersonForm({ name: p.name, year: String(p.year), month: String(p.month), day: String(p.day), hour: p.hour, gender: p.gender });
    setEditingPersonId(p.id);
  }

  async function startNewChat() {
    if (!result || !sajuCtx) return;
    const dp = result.saju.dp;
    const greeting = `안녕하세요, ${form.name || ""}님. 새로운 대화를 시작합니다.\n\n일간(日干)은 **${CG[dp.cg]}${JJ[dp.jj]}(${CG_HJ[dp.cg]}${JJ_HJ[dp.jj]})**입니다.\n\n무엇이든 물어보세요.`;
    const newMsgs: Message[] = [{ role: "assistant", content: greeting }];
    setMessages(newMsgs);
    if (supabase && user) {
      const { data: newSession }: any = await supabase.from("chat_sessions").insert({
        user_id: user.id, messages: newMsgs, saju_context: sajuCtx, created_at: new Date().toISOString(),
      }).select("id").single();
      if (newSession) {
        setSessionId(newSession.id);
        await loadChatHistory(user.id, supabase);
      }
    }
  }

  async function deleteSession(id: string) {
    if (!supabase || !user) return;
    await supabase.from("chat_sessions").delete().eq("id", id);
    setMenuOpenId(null);
    const updated = await loadChatHistory(user.id, supabase);
    if (id === sessionId) {
      if (updated.length > 0) {
        setSessionId(updated[0].id);
        setMessages(updated[0].messages || []);
      } else {
        await startNewChat();
      }
    }
  }

  function stopGeneration() {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
  }

  const GUNGHAP_KEYWORDS = ["궁합", "잘 맞", "잘맞", "상성", "케미", "커플", "연인", "배우자", "짝", "파트너", "남친", "여친", "남자친구", "여자친구", "남편", "아내", "와의 관계", "과의 관계"];

  function isGunghapQuery(text: string) {
    return GUNGHAP_KEYWORDS.some(k => text.includes(k));
  }

  function buildPartnerContext(person: any): string {
    try {
      const r = calcAll(person.year, person.month, person.day, person.hour ?? 11, person.gender);
      return sajuToPromptContext(r, person.gender, person.year, person.month, person.day).replace("사주 정보", `상대방(${person.name}) 사주 정보`);
    } catch { return ""; }
  }

  async function sendWithGunghap(person: any) {
    const txt = gunghapPending;
    if (!txt) return;
    setShowGunghapPicker(false);
    setGunghapPending(null);
    setGunghapAddMode(false);
    const partnerCtx = buildPartnerContext(person);
    const combinedCtx = sajuCtx + "\n\n" + partnerCtx + "\n\n[궁합 분석 요청] 위 두 사람의 사주를 비교하여 궁합을 분석해주세요.";
    // Persist partner context for follow-up messages
    setGunghapPartner(person);
    setGunghapCtx(combinedCtx);
    // Send with combined context
    const userMsg: Message = { role: "user", content: txt };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs); setInput(""); setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs, sajuContext: combinedCtx }),
        signal: controller.signal,
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
      if (sessionId && user && supabase) {
        const finalMessages = [...newMsgs, { role: "assistant" as const, content: aiText }];
        await supabase.from("chat_sessions").update({ messages: finalMessages, updated_at: new Date().toISOString() }).eq("id", sessionId);
        loadChatHistory(user.id, supabase);
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setMessages(prev => [...prev, { role: "assistant", content: "오류가 발생했습니다. 다시 시도해주세요." }]);
      }
    } finally { setLoading(false); abortRef.current = null; }
  }

  async function saveGunghapPersonAndSend() {
    const f = gunghapForm;
    if (!f.name || !f.year || !f.month || !f.day || !supabase || !user) return;
    const res = await supabase.from("people").insert({
      user_id: user.id, name: f.name, year: +f.year, month: +f.month,
      day: +f.day, hour: +f.hour, gender: f.gender,
    });
    if (res.error) { alert("저장 실패: " + res.error.message); return; }
    await loadPeople();
    const person = { name: f.name, year: +f.year, month: +f.month, day: +f.day, hour: +f.hour, gender: f.gender };
    setGunghapForm({ name: "", year: "", month: "", day: "", hour: -1, gender: "M" });
    sendWithGunghap(person);
  }

  async function send(override?: string) {
    const txt = override ?? input;
    if (!txt.trim() || loading) return;
    // Check for 궁합 keywords — skip if already in 궁합 mode
    if (!gunghapPartner && isGunghapQuery(txt)) {
      setGunghapPending(txt);
      setInput("");
      setShowGunghapPicker(true);
      setGunghapAddMode(false);
      loadPeople();
      return;
    }
    const userMsg: Message = { role: "user", content: txt };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs); setInput(""); setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs, sajuContext: gunghapPartner ? gunghapCtx : sajuCtx, today: new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" }) }),
        signal: controller.signal,
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
      // ── Save updated messages to Supabase chat_sessions ──
      if (sessionId && user && supabase) {
        const finalMessages = [...newMsgs, { role: "assistant" as const, content: aiText }];
        await supabase.from("chat_sessions").update({
          messages: finalMessages,
          updated_at: new Date().toISOString(),
        }).eq("id", sessionId);
        loadChatHistory(user.id, supabase);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        // Stopped by user — save what we have so far
        if (sessionId && user && supabase) {
          const partialMessages = [...newMsgs, { role: "assistant" as const, content: messages[messages.length - 1]?.content || "" }];
          await supabase.from("chat_sessions").update({
            messages: partialMessages, updated_at: new Date().toISOString(),
          }).eq("id", sessionId);
          loadChatHistory(user.id, supabase);
        }
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "오류가 발생했습니다. 다시 시도해주세요." }]);
      }
    } finally { setLoading(false); abortRef.current = null; }
  }

  if (authLoading) return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 20, height: 20, border: "2px solid #E2E2E8", borderTopColor: "#2E2E38", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
    </div>
  );

  if (step === "login") return <LoginPage onGoogleLogin={signInWithGoogle} />;
  if (step === "form") return <FormPage form={form} upd={upd} onSubmit={startChat} />;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#FAFAFA", overflow: "hidden" }}>

      {/* ── 사이드바 ─────────────────────────────────────── */}
      <aside style={{
        width: sideCollapsed ? 52 : 260,
        minWidth: sideCollapsed ? 52 : 260,
        background: "#FFFFFF",
        borderRight: "1px solid #E2E2E8",
        display: "flex", flexDirection: "column",
        transition: "width 0.2s cubic-bezier(0.4,0,0.2,1), min-width 0.2s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
        position: "relative",
      }}>

        {/* ── 세컨더리 패널 (오행/대운/세운) ── */}
        {!sideCollapsed && sideSecondary && result && (
          <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", zIndex: 10, display: "flex", flexDirection: "column", animation: "slideIn 0.18s ease" }}>
            <div style={{ height: 52, padding: "0 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #E2E2E8", flexShrink: 0 }}>
              <button onClick={() => setSideSecondary(false)} style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", borderRadius: 6, color: "#6B6B78" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#EFEFF2")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#2E2E38", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 600, color: "#fff" }}>{form.name ? form.name.slice(0,1) : "나"}</span>
                </div>
                <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, fontWeight: 500, color: "#111116" }}>{form.name || "내 사주"}</span>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
              <SideSection label="사주팔자">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 3 }}>
                  {[{ l: "시주", p: result.saju.hp }, { l: "일주", p: result.saju.dp }, { l: "월주", p: result.saju.mp }, { l: "년주", p: result.saju.yp }].map(({ l, p }) => (
                    <div key={l} style={{ background: "#F7F7FA", border: "1px solid #E2E2E8", borderRadius: 5, padding: "7px 2px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      {p ? (<>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 16, lineHeight: 1.2, color: OH_HUM[CG_OH[p.cg]] }}>{CG[p.cg]}</span>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 16, lineHeight: 1.2, color: OH_HUM[JJ_OH[p.jj]] }}>{JJ[p.jj]}</span>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 7, color: "#9898A4" }}>{CG_HJ[p.cg]}{JJ_HJ[p.jj]}</span>
                      </>) : (<><span style={{ fontSize: 14, color: "#C8C8D0" }}>?</span><span style={{ fontSize: 14, color: "#C8C8D0" }}>?</span></>)}
                      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 7, color: "#6B6B78", marginTop: 1 }}>{l}</span>
                    </div>
                  ))}
                </div>
              </SideSection>
              <SideSection label="오행 분포">
                {(() => {
                  const counts = ohCounts(result.saju);
                  const mx = Math.max(...counts, 1);
                  return OH.map((n, i) => (
                    <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: OH_HUM[i], width: 14, textAlign: "center" }}>{OH_HJ[i]}</span>
                      <div style={{ flex: 1, height: 2, background: "#EFEFF2", borderRadius: 1 }}>
                        <div style={{ width: `${(counts[i] / mx) * 100}%`, height: "100%", background: OH_HUM[i], borderRadius: 1 }} />
                      </div>
                      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "#9898A4", width: 12, textAlign: "right" }}>{counts[i]}</span>
                    </div>
                  ));
                })()}
              </SideSection>
              <SideSection label="대운 흐름">
                {result.daeun.map((d: DaeunItem) => (
                  <div key={d.startAge} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6, marginBottom: 2, background: d.isCurrent ? "rgba(46,46,56,0.06)" : "transparent", border: d.isCurrent ? "1px solid rgba(46,46,56,0.25)" : "1px solid transparent" }}>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: d.isCurrent ? "#2E2E38" : "#9898A4", minWidth: 44 }}>{d.startAge}–{d.endAge}세</span>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: d.isCurrent ? "#2E2E38" : OH_HUM[CG_OH[d.cg]] }}>{CG[d.cg]}</span>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: d.isCurrent ? "#2E2E38" : OH_HUM[JJ_OH[d.jj]] }}>{JJ[d.jj]}</span>
                    {d.isCurrent && <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 8, color: "#2E2E38", marginLeft: "auto" }}>NOW</span>}
                  </div>
                ))}
              </SideSection>
              <SideSection label={`${new Date().getFullYear()} 세운`}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#F7F7FA", border: "1px solid #E2E2E8", borderRadius: 6 }}>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 22, color: OH_HUM[CG_OH[result.seun.cg]] }}>{CG[result.seun.cg]}</span>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 22, color: OH_HUM[JJ_OH[result.seun.jj]] }}>{JJ[result.seun.jj]}</span>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "#9898A4" }}>{CG_HJ[result.seun.cg]}{JJ_HJ[result.seun.jj]}</span>
                </div>
              </SideSection>
            </div>
          </div>
        )}
        {/* 사이드바 헤더 */}
        <div style={{ padding: "14px 12px", borderBottom: "1px solid #E2E2E8", display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 52 }}>
          {!sideCollapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4" fill="#111116"/>
                <circle cx="12" cy="12" r="7" stroke="#111116" strokeWidth="1" strokeOpacity="0.35"/>
                <circle cx="12" cy="12" r="10.5" stroke="#111116" strokeWidth="0.5" strokeOpacity="0.2"/>
              </svg>
              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: "#111116" }}>
                Aura
              </span>
            </div>
          )}
          <button onClick={() => setSideCollapsed(!sideCollapsed)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: "6px", color: "#9898A4", display: "flex", alignItems: "center", marginLeft: sideCollapsed ? "auto" : 0 }}
            onMouseEnter={e => (e.currentTarget.style.background = "#F7F7FA")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>

        {/* ── 메인 사이드바 본문 ── */}
        {!sideCollapsed && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

            {/* 내 사주 */}
            {result && (<>
              <div style={{ padding: "8px 20px 4px", flexShrink: 0 }}>
                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, fontWeight: 500, letterSpacing: "0.20em", textTransform: "uppercase", color: "#9898A4", margin: 0 }}>내 사주</p>
              </div>
              <div style={{ padding: "0 10px", flexShrink: 0 }}>
                <div style={{ background: "#F7F7FA", border: "0.5px solid #E2E2E8", borderRadius: 8, padding: 10 }}>
                  {/* 이름 + caret */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#2E2E38", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 8, fontWeight: 600, color: "#fff" }}>{form.name ? form.name.slice(0,1) : "나"}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#111116" }}>{form.name || "내 사주"}</span>
                    </div>
                    <button onClick={() => setSideSecondary(true)} title="상세 정보" style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", borderRadius: 4, color: "#9898A4" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#E2E2E8")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                  {/* 사주 4기둥 */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 3 }}>
                    {[{ l: "시주", p: result.saju.hp }, { l: "일주", p: result.saju.dp }, { l: "월주", p: result.saju.mp }, { l: "년주", p: result.saju.yp }].map(({ l, p }) => (
                      <div key={l} style={{ background: "#FFFFFF", border: "0.5px solid #E2E2E8", borderRadius: 4, padding: "5px 2px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                        {p ? (<>
                          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14, lineHeight: 1.2, color: OH_HUM[CG_OH[p.cg]] }}>{CG[p.cg]}</span>
                          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14, lineHeight: 1.2, color: OH_HUM[JJ_OH[p.jj]] }}>{JJ[p.jj]}</span>
                        </>) : (<><span style={{ fontSize: 13, color: "#C8C8D0" }}>?</span><span style={{ fontSize: 13, color: "#C8C8D0" }}>?</span></>)}
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 7, color: "#6B6B78", marginTop: 1 }}>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 사주 정보 추가 버튼 */}
              <div style={{ padding: "8px 10px 0", flexShrink: 0 }}>
                <button onClick={() => setShowPartner(!showPartner)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "transparent", border: "0.5px dashed #C8C8D0", borderRadius: 6, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, color: "#9898A4", transition: "all 0.12s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F7F7FA"; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                  사주 정보 추가
                </button>
              </div>

            </>)}

            {/* 새 채팅 + 검색 */}
            <div style={{ padding: "6px 10px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              {[{ icon: "M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z", label: "새 채팅", action: () => startNewChat() },
                { icon: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z", label: "검색", action: () => {} }
              ].map(item => (
                <button key={item.label} onClick={item.action} style={{ width: "100%", display: "flex", alignItems: "center", height: 32, padding: "0 10px", borderRadius: 6, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 16, fontWeight: 400, color: "#3A3A44", background: "transparent", border: "none", gap: 10, transition: "background 0.12s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#F7F7FA")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6B78" strokeWidth="2"><path d={item.icon}/></svg>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {/* 구분선 */}
            <div style={{ margin: "10px 10px 0", borderTop: "0.5px solid #E2E2E8", flexShrink: 0 }} />

            {/* 채팅 히스토리 */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px 0" }}>
              <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, fontWeight: 500, letterSpacing: "0.20em", textTransform: "uppercase", color: "#9898A4", padding: "4px 10px 6px", margin: 0 }}>최근 채팅</p>
              {chatHistory.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", height: 32, padding: "0 10px", borderRadius: 6, color: "#9898A4" }}>
                  <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "#9898A4" }}>채팅 기록이 여기에 표시됩니다</span>
                </div>
              ) : (
                chatHistory.map((session: any) => {
                  const firstUserMsg = session.messages?.find((m: any) => m.role === "user");
                  const preview = firstUserMsg?.content?.slice(0, 30) || "새 대화";
                  const isActive = session.id === sessionId;
                  return (
                    <div key={session.id} style={{ position: "relative" }}
                      onMouseEnter={e => { const btn = e.currentTarget.querySelector("[data-dots]") as HTMLElement; if (btn) btn.style.opacity = "1"; }}
                      onMouseLeave={e => { const btn = e.currentTarget.querySelector("[data-dots]") as HTMLElement; if (btn && menuOpenId !== session.id) btn.style.opacity = "0"; }}>
                      <button onClick={() => { setSessionId(session.id); setMessages(session.messages || []); setMenuOpenId(null); }} style={{
                        width: "100%", display: "flex", alignItems: "center", height: 32, padding: "0 10px",
                        borderRadius: 6, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif",
                        fontSize: 16, color: isActive ? "#111116" : "#3A3A44",
                        background: isActive ? "#EFEFF2" : "transparent", border: "none",
                        gap: 8, transition: "background 0.12s", textAlign: "left",
                      }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#F7F7FA"; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9898A4" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{preview}{firstUserMsg ? "" : " ✨"}</span>
                      </button>
                      {/* 3-dot menu */}
                      <button data-dots onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === session.id ? null : session.id); }}
                        style={{ position: "absolute", right: 6, top: 6, width: 20, height: 20, background: "none", border: "none", cursor: "pointer", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", opacity: menuOpenId === session.id ? 1 : 0, transition: "opacity 0.12s", color: "#9898A4" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#EFEFF2")}
                        onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                      </button>
                      {menuOpenId === session.id && (
                        <div style={{ position: "absolute", right: 4, top: 28, background: "#fff", border: "1px solid #E2E2E8", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 50, overflow: "hidden", animation: "fadeIn 0.12s ease" }}>
                          <button onClick={e => { e.stopPropagation(); deleteSession(session.id); }}
                            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "#E04040", whiteSpace: "nowrap" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#FFF5F5")}
                            onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                            삭제
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* 풋터 */}
            <div style={{ borderTop: "1px solid #E2E2E8", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, position: "relative" }}>
              {/* 프로필 아바타 + flyout */}
              <div style={{ position: "relative" }} ref={profileMenuRef}>
                <button onClick={() => setShowProfileMenu(!showProfileMenu)}
                  style={{ width: 28, height: 28, borderRadius: "50%", background: "#EFEFF2", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#E2E2E8")} onMouseLeave={e => (e.currentTarget.style.background = "#EFEFF2")}>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 600, color: "#2E2E38" }}>{user?.email?.slice(0,1).toUpperCase() || "U"}</span>
                </button>
                {/* Flyout menu */}
                {showProfileMenu && (
                  <div style={{ position: "absolute", bottom: 36, left: 0, background: "#fff", border: "1px solid #E2E2E8", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", minWidth: 180, padding: "4px 0", zIndex: 50, animation: "fadeIn 0.1s ease" }}>
                    <button onClick={() => { setShowProfileMenu(false); setSettingsTab("account"); setShowSettingsModal(true); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "#111116" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F7F7FA")} onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      내 정보
                    </button>
                    <button onClick={() => { setShowProfileMenu(false); loadPeople(); setShowPeopleModal(true); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "#111116" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F7F7FA")} onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      등록된 사주
                    </button>
                    <div style={{ height: 1, background: "#E2E2E8", margin: "4px 0" }} />
                    <button onClick={async () => { setShowProfileMenu(false); if (supabase) { await supabase.auth.signOut(); } setUser(null); setStep("login"); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "#E04040" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#FFF5F5")} onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 1 }}>
                <div style={{ position: "relative" }} className="tooltip-wrap">
                  <button onClick={() => { loadPeople(); setShowPeopleModal(true); }}
                    style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", borderRadius: 6, color: "#9898A4" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#EFEFF2")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </button>
                  <span className="tooltip-text">등록된 사주</span>
                </div>
                <div style={{ position: "relative" }} className="tooltip-wrap">
                  <button onClick={() => { setSettingsTab("account"); setShowSettingsModal(true); }}
                    style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", borderRadius: 6, color: "#9898A4" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#EFEFF2")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </button>
                  <span className="tooltip-text">설정</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ── 메인 채팅 ─────────────────────────────────────── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#FAFAFA" }}>

        {/* 헤더 */}
        <div style={{ padding: "0 24px", height: 52, borderBottom: "1px solid #E2E2E8", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 500, letterSpacing: "0.20em", textTransform: "uppercase", color: "#9898A4" }}>
            {form.year}년 {form.month}월 {form.day}일 · {form.gender === "F" ? "여성" : "남성"}
          </span>
          {result?.currentDaeun && (
            <>
              <span style={{ color: "#C8C8D0", fontSize: 10 }}>|</span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: "0.08em", color: "#9898A8" }}>
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
                background: m.role === "user" ? "#EFEFF2" : "#FFFFFF",
                border: `1px solid ${m.role === "user" ? "#C8C8D0" : "#E2E2E8"}`,
                borderRadius: m.role === "user" ? "8px 2px 8px 8px" : "2px 8px 8px 8px",
                fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 16, lineHeight: 1.7,
              }}>
                {renderContent(m.content, m.role === "user")}
              </div>
            </div>
          ))}
          {loading && (
            <div className="fade-in" style={{ display: "flex", marginBottom: 16 }}>

              <div style={{ padding: "14px 16px", background: "#FFFFFF", border: "1px solid #E2E2E8", borderRadius: "2px 8px 8px 8px", display: "flex", gap: 5, alignItems: "center" }}>
                {[0, 1, 2].map(i => <span key={i} className="typing-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: "#9898A4", display: "block", animationDelay: `${i * 0.2}s` }} />)}
              </div>
            </div>
          )}
        </div>

        {/* 빠른 질문 */}
        {messages.length <= 1 && (
          <div style={{ padding: "16px 28px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["성격과 적성 분석해줘", "올해 운세는?", "현재 대운 해석해줘", "직업운 알려줘", "연애운이 궁금해", "재물운 분석해줘"].map(q => (
              <button key={q} onClick={() => setInput(q)} style={{
                padding: "8px 16px", background: "transparent",
                border: "1px solid #C8C8D0", borderRadius: "9999px",
                fontFamily: "'Geist Mono', monospace", fontSize: 16, fontWeight: 500,
                letterSpacing: "0.02em", color: "#6B6B78", cursor: "pointer",
                transition: "all 0.12s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(46,46,56,0.25)"; e.currentTarget.style.color = "#3A3A44"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#C8C8D0"; e.currentTarget.style.color = "#6B6B78"; }}>
                {q}
              </button>
            ))}
          </div>
        )}

        {/* 궁합 상대 선택 */}
        {showGunghapPicker && (
          <div className="fade-in" style={{ padding: "12px 28px 0", flexShrink: 0 }}>
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E2E8", borderRadius: 10, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#9898A4", margin: 0 }}>궁합 상대 선택</p>
                <button onClick={() => { setShowGunghapPicker(false); setGunghapPending(null); setGunghapAddMode(false); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#9898A4", padding: 2 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "#6B6B78", margin: "0 0 12px" }}>궁합을 보고싶은 프로필을 선택해주세요</p>

              {!gunghapAddMode ? (
                <>
                  {people.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                      {people.map((p: any) => {
                        let saju: Saju | null = null;
                        try { saju = calcSaju(p.year, p.month, p.day, p.hour ?? -1); } catch {}
                        const dp = saju?.dp;
                        return (
                          <button key={p.id} onClick={() => sendWithGunghap(p)}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#F7F7FA", border: "1px solid #E2E2E8", borderRadius: 8, cursor: "pointer", textAlign: "left", transition: "all 0.12s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "#9898A4"; e.currentTarget.style.background = "#EFEFF2"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E2E8"; e.currentTarget.style.background = "#F7F7FA"; }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EFEFF2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 600, color: "#2E2E38" }}>{(p.name || "?").slice(0,1)}</span>
                            </div>
                            <div>
                              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "#111116", margin: 0 }}>{p.name}</p>
                              <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "#6B6B78", margin: 0 }}>
                                {p.year}년 {p.month}월 {p.day}일 · {dp ? `${CG[dp.cg]}${JJ[dp.jj]}` : ""} · {p.gender === "F" ? "여" : "남"}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <button onClick={() => setGunghapAddMode(true)}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", background: "transparent", border: "1px dashed #C8C8D0", borderRadius: 8, cursor: "pointer", fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 500, color: "#6B6B78", transition: "all 0.12s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#9898A4"; e.currentTarget.style.color = "#2E2E38"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#C8C8D0"; e.currentTarget.style.color = "#6B6B78"; }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    새 프로필 추가
                  </button>
                </>
              ) : (
                <div>
                  <input style={{ width: "100%", background: "#F7F7FA", border: "1px solid #C8C8D0", borderRadius: 4, padding: "8px 12px", fontFamily: "'Geist Mono', monospace", fontSize: 12, color: "#111116", outline: "none", marginBottom: 6 }}
                    type="text" placeholder="이름" value={gunghapForm.name} onChange={e => setGunghapForm(p => ({ ...p, name: e.target.value }))} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
                    {([["년", "year", "1990"], ["월", "month", "3"], ["일", "day", "15"]] as const).map(([l, k, ph]) => (
                      <input key={k} style={{ background: "#F7F7FA", border: "1px solid #C8C8D0", borderRadius: 4, padding: "8px 10px", fontFamily: "'Geist Mono', monospace", fontSize: 12, color: "#111116", outline: "none" }}
                        type="number" placeholder={`${l} ${ph}`} value={(gunghapForm as any)[k]} onChange={e => setGunghapForm(p => ({ ...p, [k]: e.target.value }))} />
                    ))}
                  </div>
                  <select style={{ width: "100%", background: "#F7F7FA", border: "1px solid #C8C8D0", borderRadius: 4, padding: "8px 10px", fontFamily: "'Geist Mono', monospace", fontSize: 12, color: "#111116", outline: "none", marginBottom: 6 }}
                    value={gunghapForm.hour} onChange={e => setGunghapForm(p => ({ ...p, hour: +e.target.value }))}>
                    {HOURS.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    {([["F", "여성"], ["M", "남성"]] as const).map(([v, l]) => (
                      <button key={v} onClick={() => setGunghapForm(p => ({ ...p, gender: v }))} style={{ flex: 1, padding: "6px 0", background: gunghapForm.gender === v ? "rgba(46,46,56,0.06)" : "#fff", border: `1px solid ${gunghapForm.gender === v ? "rgba(46,46,56,0.25)" : "#C8C8D0"}`, borderRadius: 4, cursor: "pointer", fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 600, color: gunghapForm.gender === v ? "#2E2E38" : "#6B6B78" }}>{l}</button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setGunghapAddMode(false)}
                      style={{ flex: 1, padding: 8, background: "#FAFAFA", border: "1px solid #C8C8D0", borderRadius: 4, cursor: "pointer", fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 600, color: "#6B6B78" }}>뒤로</button>
                    <button onClick={saveGunghapPersonAndSend}
                      style={{ flex: 1, padding: 8, background: "#2E2E38", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 600, color: "#fff" }}>저장 & 궁합 분석</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 입력창 */}
        <div style={{ padding: "16px 28px 20px", flexShrink: 0 }}>
          {/* 궁합 badge */}
          {gunghapPartner && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F7F7FA", border: "1px solid #E2E2E8", borderRadius: 20, padding: "4px 10px 4px 12px" }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 500, color: "#6B6B78" }}>
                  {form.name || "나"} ✕ {gunghapPartner.name}
                </span>
                <button onClick={() => { setGunghapPartner(null); setGunghapCtx(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#9898A4", padding: 0, display: "flex", alignItems: "center" }}
                  title="궁합 모드 해제">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: "#9898A4" }}>궁합 분석 중</span>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "#FFFFFF", border: "1px solid #C8C8D0", borderRadius: "8px", padding: "10px 12px", transition: "border-color 0.15s" }}
            onFocus={() => { }} >
            <textarea style={{
              flex: 1, background: "transparent", border: "none", outline: "none", resize: "none",
              fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 16, color: "#111116",
              lineHeight: 1.5, maxHeight: 120, overflow: "auto",
            }} rows={1} placeholder={gunghapPartner ? `${form.name || "나"} & ${gunghapPartner.name} 궁합에 대해 물어보세요` : "무엇이 궁금하세요?"}
              value={input} onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => { composingRef.current = false; }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !composingRef.current && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
            <button onClick={() => loading ? stopGeneration() : send()} disabled={!loading && !input.trim()} style={{
              width: 32, height: 32, flexShrink: 0,
              background: loading ? "#2E2E38" : (!input.trim() ? "#EFEFF2" : "linear-gradient(135deg, #F2F2F5, #C8C8D0, #9898A8)"),
              border: "none", borderRadius: "6px",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: !loading && !input.trim() ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}>
              {loading
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFFFFF" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={!input.trim() ? "#9898A4" : "#FFFFFF"} strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              }
            </button>
          </div>
        </div>
      </main>

      {/* ── 사주 정보 추가 모달 ── */}
      {showPartner && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setShowPartner(false)}>
          <div style={{ background: "#FFFFFF", borderRadius: 12, padding: "28px 24px", width: "100%", maxWidth: 400, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", animation: "fadeIn 0.15s ease" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 500, letterSpacing: "0.20em", textTransform: "uppercase", color: "#9898A4", margin: 0 }}>사주 정보 추가</p>
              <button onClick={() => setShowPartner(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9898A4", padding: 4 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9898A4", display: "block", marginBottom: 4 }}>이름</label>
              <input style={{ width: "100%", background: "#FAFAFA", border: "1px solid #C8C8D0", borderRadius: 4, padding: "10px 14px", fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "#111116", outline: "none" }}
                type="text" placeholder="이름" value={partner.name} onChange={e => updP("name", e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(46,46,56,0.25)")} onBlur={e => (e.currentTarget.style.borderColor = "#C8C8D0")} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              {([["생년", "year", "1990"], ["생월", "month", "3"], ["생일", "day", "15"]] as const).map(([l, k, ph]) => (
                <div key={k}>
                  <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9898A4", display: "block", marginBottom: 4 }}>{l}</label>
                  <input style={{ width: "100%", background: "#FAFAFA", border: "1px solid #C8C8D0", borderRadius: 4, padding: "10px 14px", fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "#111116", outline: "none" }}
                    type="number" placeholder={ph} value={(partner as any)[k]} onChange={e => updP(k, e.target.value)}
                    onFocus={e => (e.currentTarget.style.borderColor = "rgba(46,46,56,0.25)")} onBlur={e => (e.currentTarget.style.borderColor = "#C8C8D0")} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9898A4", display: "block", marginBottom: 4 }}>생시</label>
              <select style={{ width: "100%", background: "#FAFAFA", border: "1px solid #C8C8D0", borderRadius: 4, padding: "10px 14px", fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "#111116", outline: "none" }}
                value={partner.hour} onChange={e => updP("hour", +e.target.value)}>
                {HOURS.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9898A4", display: "block", marginBottom: 4 }}>성별</label>
              <div style={{ display: "flex", gap: 8 }}>
                {([["F", "여성"], ["M", "남성"]] as const).map(([v, l]) => (
                  <button key={v} onClick={() => updP("gender", v)} style={{ flex: 1, padding: "10px 0", background: partner.gender === v ? "rgba(46,46,56,0.06)" : "#FAFAFA", border: `1px solid ${partner.gender === v ? "rgba(46,46,56,0.25)" : "#C8C8D0"}`, borderRadius: 4, cursor: "pointer", fontFamily: "'Geist Mono', monospace", fontSize: 12, fontWeight: 600, color: partner.gender === v ? "#2E2E38" : "#6B6B78" }}>{l}</button>
                ))}
              </div>
            </div>
            <button onClick={addPersonFromPartner} style={{ width: "100%", padding: "12px 0", background: "#2E2E38", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Geist Mono', monospace", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: "#fff" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#1A1A24")} onMouseLeave={e => (e.currentTarget.style.background = "#2E2E38")}>
              사주 정보 추가
            </button>
          </div>
        </div>
      )}

      {/* ── 사람들 모달 ── */}
      {showPeopleModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => { setShowPeopleModal(false); setEditingPersonId(null); }}>
          <div style={{ background: "#FFFFFF", borderRadius: 12, width: "100%", maxWidth: 520, maxHeight: "80vh", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", animation: "fadeIn 0.15s ease", display: "flex", flexDirection: "column" }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #E2E2E8", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 16, fontWeight: 600, color: "#111116", margin: 0 }}>사주정보</p>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "#9898A4" }}>{people.length}명</span>
              </div>
              <button onClick={() => { setShowPeopleModal(false); setEditingPersonId(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9898A4", padding: 4 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {/* My profile */}
              {form.year && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.20em", textTransform: "uppercase", color: "#9898A4", marginBottom: 8 }}>대표 사주</p>
                  <div style={{ background: "#F7F7FA", border: "1px solid #E2E2E8", borderRadius: 8, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#2E2E38", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 600, color: "#fff" }}>{(form.name || "나").slice(0,1)}</span>
                      </div>
                      <div>
                        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#111116", margin: 0 }}>{form.name || "내 사주"}</p>
                        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "#6B6B78", margin: 0 }}>{form.year}년 {form.month}월 {form.day}일 · {form.gender === "F" ? "여성" : "남성"}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      {activePersonId && (() => { const ap = people.find((p: any) => p.id === activePersonId); return ap ? (<>
                        <button onClick={() => editPerson(ap)} title="수정"
                          style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", borderRadius: 4, color: "#9898A4" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#EFEFF2")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                        </button>
                        <button onClick={async () => { await deletePerson(ap.id); setActivePersonId(null); if (user) await loadProfile(user.id); }} title="삭제"
                          style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", borderRadius: 4, color: "#9898A4" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#FFF5F5"; e.currentTarget.style.color = "#E04040"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9898A4"; }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                        </button>
                      </>) : null; })()}
                      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: "#9898A4", background: "#EFEFF2", padding: "3px 8px", borderRadius: 4, marginLeft: 4 }}>기본</span>
                    </div>
                  </div>
                </div>
              )}
              {/* Add/edit form */}
              {editingPersonId !== null && (
                <div style={{ background: "#F7F7FA", border: "1px solid #E2E2E8", borderRadius: 8, padding: 16, marginBottom: 16 }}>
                  <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.20em", textTransform: "uppercase", color: "#9898A4", marginBottom: 12 }}>
                    {editingPersonId && editingPersonId !== "new" ? "정보 수정" : "새 사람 추가"}
                  </p>
                  <input style={{ width: "100%", background: "#FFFFFF", border: "1px solid #C8C8D0", borderRadius: 4, padding: "8px 12px", fontFamily: "'Geist Mono', monospace", fontSize: 12, color: "#111116", outline: "none", marginBottom: 8 }}
                    type="text" placeholder="이름" value={personForm.name} onChange={e => setPersonForm(p => ({ ...p, name: e.target.value }))} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
                    {([["년", "year", "1990"], ["월", "month", "3"], ["일", "day", "15"]] as const).map(([l, k, ph]) => (
                      <input key={k} style={{ background: "#FFFFFF", border: "1px solid #C8C8D0", borderRadius: 4, padding: "8px 10px", fontFamily: "'Geist Mono', monospace", fontSize: 12, color: "#111116", outline: "none" }}
                        type="number" placeholder={`${l} ${ph}`} value={(personForm as any)[k]} onChange={e => setPersonForm(p => ({ ...p, [k]: e.target.value }))} />
                    ))}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <select style={{ width: "100%", background: "#FFFFFF", border: "1px solid #C8C8D0", borderRadius: 4, padding: "8px 10px", fontFamily: "'Geist Mono', monospace", fontSize: 12, color: "#111116", outline: "none" }}
                      value={personForm.hour} onChange={e => setPersonForm(p => ({ ...p, hour: +e.target.value }))}>
                      {HOURS.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    {([["F", "여성"], ["M", "남성"]] as const).map(([v, l]) => (
                      <button key={v} onClick={() => setPersonForm(p => ({ ...p, gender: v }))} style={{ flex: 1, padding: "6px 0", background: personForm.gender === v ? "rgba(46,46,56,0.06)" : "#fff", border: `1px solid ${personForm.gender === v ? "rgba(46,46,56,0.25)" : "#C8C8D0"}`, borderRadius: 4, cursor: "pointer", fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 600, color: personForm.gender === v ? "#2E2E38" : "#6B6B78" }}>{l}</button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { setEditingPersonId(null); setPersonForm({ name: "", year: "", month: "", day: "", hour: -1, gender: "M" }); }}
                      style={{ flex: 1, padding: 8, background: "#FAFAFA", border: "1px solid #C8C8D0", borderRadius: 4, cursor: "pointer", fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 600, color: "#6B6B78" }}>취소</button>
                    <button onClick={savePerson}
                      style={{ flex: 1, padding: 8, background: "#2E2E38", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 600, color: "#fff" }}>저장</button>
                  </div>
                </div>
              )}
              {/* People list */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.20em", textTransform: "uppercase", color: "#9898A4", margin: 0 }}>등록된 사주 정보</p>
                {editingPersonId === null && (
                  <button onClick={() => { setPersonForm({ name: "", year: "", month: "", day: "", hour: -1, gender: "M" }); setEditingPersonId("new"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "#2E2E38", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    추가
                  </button>
                )}
              </div>
              {(() => { const filtered = people.filter((p: any) => p.id !== activePersonId); return filtered.length === 0 ? (
                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "#9898A4", textAlign: "center", padding: "20px 0" }}>아직 추가된 사람이 없습니다</p>
              ) : (
                filtered.map((p: any) => {
                  let saju: Saju | null = null;
                  try { saju = calcSaju(p.year, p.month, p.day, p.hour ?? -1); } catch {}
                  const dp = saju?.dp;
                  return (
                    <div key={p.id} style={{ background: "#FFFFFF", border: "1px solid #E2E2E8", borderRadius: 8, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EFEFF2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 600, color: "#2E2E38" }}>{(p.name || "?").slice(0,1)}</span>
                        </div>
                        <div>
                          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "#111116", margin: 0 }}>{p.name}</p>
                          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "#6B6B78", margin: 0 }}>
                            {p.year}년 {p.month}월 {p.day}일 · {dp ? `${CG[dp.cg]}${JJ[dp.jj]}` : ""} · {p.gender === "F" ? "여" : "남"}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 2 }}>
                        <button onClick={() => setAsDefault(p)} title="대표사주로 설정"
                          style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", borderRadius: 4, color: "#9898A4" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#F7F7FA"; e.currentTarget.style.color = "#2E2E38"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9898A4"; }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        </button>
                        <button onClick={() => editPerson(p)} title="수정"
                          style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", borderRadius: 4, color: "#9898A4" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#F7F7FA")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                        </button>
                        <button onClick={() => deletePerson(p.id)} title="삭제"
                          style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", borderRadius: 4, color: "#9898A4" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#FFF5F5"; e.currentTarget.style.color = "#E04040"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9898A4"; }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              ); })()}
            </div>
          </div>
        </div>
      )}

      {/* ── 설정(내 정보) 모달 ── */}
      {showSettingsModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setShowSettingsModal(false)}>
          <div style={{ background: "#FFFFFF", borderRadius: 12, width: "100%", maxWidth: 620, maxHeight: "80vh", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", animation: "fadeIn 0.15s ease", display: "flex", overflow: "hidden" }}
            onClick={e => e.stopPropagation()}>
            {/* 왼쪽 사이드 탭 */}
            <div style={{ width: 160, background: "#FAFAFA", borderRight: "1px solid #E2E2E8", padding: "20px 0", flexShrink: 0 }}>
              <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 600, letterSpacing: "0.20em", textTransform: "uppercase", color: "#9898A4", padding: "0 16px", marginBottom: 12 }}>설정</p>
              {([["account", "내 정보", "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"]] as const).map(([key, label, icon]) => (
                <button key={key} onClick={() => setSettingsTab(key as any)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: settingsTab === key ? "#FFFFFF" : "transparent", border: "none", borderRight: settingsTab === key ? "2px solid #111116" : "2px solid transparent", cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: settingsTab === key ? 600 : 400, color: settingsTab === key ? "#111116" : "#6B6B78" }}
                  onMouseEnter={e => { if (settingsTab !== key) e.currentTarget.style.background = "#F0F0F3"; }}
                  onMouseLeave={e => { if (settingsTab !== key) e.currentTarget.style.background = "transparent"; }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={icon}/></svg>
                  {label}
                </button>
              ))}
            </div>
            {/* 오른쪽 콘텐츠 */}
            <div style={{ flex: 1, padding: "20px 28px", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 16, fontWeight: 600, color: "#111116", margin: 0 }}>내 정보</p>
                <button onClick={() => setShowSettingsModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9898A4", padding: 4 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* 프로필 정보 */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid #E2E2E8" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#EFEFF2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 16, fontWeight: 600, color: "#2E2E38" }}>{user?.email?.slice(0,1).toUpperCase() || "U"}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#111116", margin: 0 }}>{form.name || "사용자"}</p>
                  <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: "#6B6B78", margin: "2px 0 0" }}>{user?.email || ""}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { setShowSettingsModal(false); setStep("form"); }}
                    style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFFFF", border: "1px solid #E2E2E8", borderRadius: 6, cursor: "pointer", color: "#6B6B78" }}
                    title="정보 수정"
                    onMouseEnter={e => (e.currentTarget.style.background = "#F7F7FA")} onMouseLeave={e => (e.currentTarget.style.background = "#FFFFFF")}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                  </button>
                  <button onClick={async () => { setShowSettingsModal(false); if (supabase) await supabase.auth.signOut(); setUser(null); setStep("login"); }}
                    style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFFFF", border: "1px solid #E2E2E8", borderRadius: 6, cursor: "pointer", color: "#E04040" }}
                    title="로그아웃"
                    onMouseEnter={e => (e.currentTarget.style.background = "#FFF5F5")} onMouseLeave={e => (e.currentTarget.style.background = "#FFFFFF")}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  </button>
                </div>
              </div>

              {/* 사주 정보 */}
              {form.year && (
                <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid #E2E2E8" }}>
                  <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 600, letterSpacing: "0.20em", textTransform: "uppercase", color: "#9898A4", marginBottom: 10 }}>사주 정보</p>
                  <div style={{ background: "#F7F7FA", border: "1px solid #E2E2E8", borderRadius: 8, padding: "14px 16px" }}>
                    <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "#111116", margin: "0 0 4px" }}>
                      {form.year}년 {form.month}월 {form.day}일 · {form.gender === "F" ? "여성" : "남성"}
                    </p>
                    {result?.saju?.dp && (
                      <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "#6B6B78", margin: 0 }}>
                        일간: {CG[result.saju.dp.cg]}{JJ[result.saju.dp.jj]}({CG_HJ[result.saju.dp.cg]}{JJ_HJ[result.saju.dp.jj]}) · {result.currentDaeun ? `${CG[result.currentDaeun.cg]}${JJ[result.currentDaeun.jj]} 대운` : ""}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 요금제 */}
              <div>
                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 600, letterSpacing: "0.20em", textTransform: "uppercase", color: "#9898A4", marginBottom: 10 }}>요금제</p>
                <div style={{ background: "#F7F7FA", border: "1px solid #E2E2E8", borderRadius: 8, padding: "16px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#111116", margin: "0 0 2px" }}>Free</p>
                    <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "#6B6B78", margin: 0 }}>기본 사주 상담</p>
                  </div>
                  <button style={{ padding: "7px 16px", background: "#2E2E38", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "#fff", display: "flex", alignItems: "center", gap: 6 }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#1A1A24")} onMouseLeave={e => (e.currentTarget.style.background = "#2E2E38")}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                    UPGRADE
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 사이드바 섹션 컴포넌트 ────────────────────────────────────────────────────
function SideSection({ label, children, right }: { label: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ padding: "0 12px", marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "12px 0 8px", paddingLeft: 2 }}>
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.20em", textTransform: "uppercase", color: "#9898A4", margin: 0 }}>{label}</p>
        {right}
      </div>
      {children}
    </div>
  );
}

// ── 입력 폼 (라이트 테마) ────────────────────────────────────────────────────
function FormPage({ form, upd, onSubmit }: { form: Form; upd: any; onSubmit: () => void }) {
  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>

        {/* 로고 */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: "50%", background: "#EFEFF2", marginBottom: 16 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4" fill="#111116"/>
              <circle cx="12" cy="12" r="7" stroke="#111116" strokeWidth="1" strokeOpacity="0.35"/>
              <circle cx="12" cy="12" r="10.5" stroke="#111116" strokeWidth="0.5" strokeOpacity="0.2"/>
            </svg>
          </div>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.28em", textTransform: "uppercase", color: "#9898A4", marginBottom: 16 }}>사주팔자 · AI 운명 상담</p>
          <h1 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", color: "#111116", margin: "0 0 8px" }}>Aura</h1>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, color: "#6B6B78" }}>사주팔자 기반 AI 운명 상담</p>
        </div>

        {/* 카드 */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E2E8", borderRadius: "10px", padding: "32px 28px", boxShadow: "0 4px 12px rgba(17,17,22,0.08)" }}>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.20em", textTransform: "uppercase", color: "#9898A4", marginBottom: 24 }}>생년월일시 입력</p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9898A4", display: "block", marginBottom: 6 }}>이름</label>
            <input style={{ width: "100%", background: "#FFFFFF", border: "1px solid #C8C8D0", borderRadius: "4px", padding: "10px 14px", fontFamily: "'Geist Mono', monospace", fontSize: 14, color: "#111116", outline: "none", letterSpacing: "0.02em" }}
              type="text" placeholder="예: 홍길동" value={form.name} onChange={e => upd("name", e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(46,46,56,0.25)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(46,46,56,0.06)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#C8C8D0"; e.currentTarget.style.boxShadow = "none"; }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9898A4", display: "block", marginBottom: 6 }}>생년</label>
            <input style={{ width: "100%", background: "#FFFFFF", border: "1px solid #C8C8D0", borderRadius: "4px", padding: "10px 14px", fontFamily: "'Geist Mono', monospace", fontSize: 14, color: "#111116", outline: "none", letterSpacing: "0.02em" }}
              type="number" placeholder="예: 1990" value={form.year} onChange={e => upd("year", e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(46,46,56,0.25)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(46,46,56,0.06)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#C8C8D0"; e.currentTarget.style.boxShadow = "none"; }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9898A4", display: "block", marginBottom: 6 }}>생월</label>
            <input style={{ width: "100%", background: "#FFFFFF", border: "1px solid #C8C8D0", borderRadius: "4px", padding: "10px 14px", fontFamily: "'Geist Mono', monospace", fontSize: 14, color: "#111116", outline: "none", letterSpacing: "0.02em" }}
              type="number" placeholder="1-12" value={form.month} onChange={e => upd("month", e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(46,46,56,0.25)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(46,46,56,0.06)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#C8C8D0"; e.currentTarget.style.boxShadow = "none"; }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9898A4", display: "block", marginBottom: 6 }}>생일</label>
            <input style={{ width: "100%", background: "#FFFFFF", border: "1px solid #C8C8D0", borderRadius: "4px", padding: "10px 14px", fontFamily: "'Geist Mono', monospace", fontSize: 14, color: "#111116", outline: "none", letterSpacing: "0.02em" }}
              type="number" placeholder="1-31" value={form.day} onChange={e => upd("day", e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(46,46,56,0.25)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(46,46,56,0.06)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#C8C8D0"; e.currentTarget.style.boxShadow = "none"; }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9898A4", display: "block", marginBottom: 6 }}>생시</label>
            <select style={{
              width: "100%", background: "#FFFFFF", border: "1px solid #C8C8D0",
              borderRadius: "4px", padding: "10px 14px",
              fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "#111116",
              outline: "none", cursor: "pointer",
            }} value={form.hour} onChange={e => upd("hour", +e.target.value)}>
              {HOURS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9898A4", display: "block", marginBottom: 6 }}>성별</label>
            <div style={{ display: "flex", gap: 8 }}>
              {([["F", "여성"], ["M", "남성"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => upd("gender", v)} style={{
                  flex: 1, padding: "10px 0",
                  background: form.gender === v ? "rgba(46,46,56,0.06)" : "#FFFFFF",
                  border: `1px solid ${form.gender === v ? "rgba(46,46,56,0.25)" : "#C8C8D0"}`,
                  borderRadius: "4px",
                  fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 600,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  color: form.gender === v ? "#2E2E38" : "#3A3A44",
                  cursor: "pointer", transition: "all 0.12s",
                }}>{l}</button>
              ))}
            </div>
          </div>

          <button onClick={onSubmit} style={{
            width: "100%", padding: "12px 0",
            background: "#2E2E38",
            border: "none", borderRadius: "4px",
            fontFamily: "'Geist Mono', monospace", fontSize: 12, fontWeight: 600,
            letterSpacing: "0.10em", textTransform: "uppercase", color: "#FFFFFF",
            cursor: "pointer", transition: "background 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = "#1A1A24")}
            onMouseLeave={e => (e.currentTarget.style.background = "#2E2E38")}>
            사주 분석 시작
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 로그인 페이지 ─────────────────────────────────────────
function LoginPage({ onGoogleLogin }: { onGoogleLogin: () => void }) {
  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px", fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: "50%", background: "#EFEFF2", marginBottom: 16 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4" fill="#111116"/>
              <circle cx="12" cy="12" r="7" stroke="#111116" strokeWidth="1" strokeOpacity="0.35"/>
              <circle cx="12" cy="12" r="10.5" stroke="#111116" strokeWidth="0.5" strokeOpacity="0.2"/>
            </svg>
          </div>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.28em", textTransform: "uppercase", color: "#9898A4", marginBottom: 14 }}>사주팔자 · AI 운명 상담</p>
          <h1 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", color: "#111116", margin: "0 0 8px" }}>Aura</h1>
          <p style={{ fontSize: 14, color: "#6B6B78" }}>사주팔자 기반 AI 운명 상담</p>
        </div>
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E2E8", borderRadius: 12, padding: "32px 28px", boxShadow: "0 4px 12px rgba(17,17,22,0.08)" }}>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.20em", textTransform: "uppercase", color: "#9898A4", marginBottom: 24 }}>로그인 / 회원가입</p>
          <button onClick={onGoogleLogin} style={{
            width: "100%", padding: "12px 0", background: "#FFFFFF",
            border: "1px solid #C8C8D0", borderRadius: 6, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            fontFamily: "'Geist Mono', monospace", fontSize: 12, fontWeight: 600,
            letterSpacing: "0.06em", color: "#2E2E38", transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(46,46,56,0.4)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(46,46,56,0.06)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#C8C8D0"; e.currentTarget.style.boxShadow = "none"; }}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google로 계속하기
          </button>
          <p style={{ fontSize: 11, color: "#9898A4", textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
            계속하면 <span style={{ color: "#2E2E38", textDecoration: "underline", cursor: "pointer" }}>이용약관</span> 및{" "}
            <span style={{ color: "#2E2E38", textDecoration: "underline", cursor: "pointer" }}>개인정보처리방침</span>에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
