"use client";
import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import { calcSaju, HOURS, CG, CG_HJ, JJ, JJ_HJ, OH, OH_HJ, OH_C } from "@/lib/saju";
import type { Saju } from "@/lib/saju";

interface Person { id: string; name: string; year: number; month: number; day: number; hour: number; gender: string; created_at: string; }
interface PersonForm { name: string; year: string; month: string; day: string; hour: number; gender: string; }

const emptyForm: PersonForm = { name: "", year: "", month: "", day: "", hour: 11, gender: "F" };

export default function PeoplePage() {
  const [user, setUser] = useState<any>(null);
  const [supabase, setSupabase] = useState<any>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PersonForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sb = await getSupabase();
      if (!sb) { setLoading(false); return; }
      setSupabase(sb);
      const { data: { session } } = await sb.auth.getSession();
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const { data: profile } = await sb.from("profiles").select("*").eq("id", u.id).maybeSingle();
        setMyProfile(profile);
        const { data: ppl } = await sb.from("people").select("*").eq("user_id", u.id).order("created_at", { ascending: false });
        setPeople(ppl || []);
      }
      setLoading(false);
    })();
  }, []);

  const upd = (k: keyof PersonForm, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  async function savePerson() {
    if (!supabase || !user || !form.name || !form.year || !form.month || !form.day) return;
    if (editingId) {
      await supabase.from("people").update({
        name: form.name, year: +form.year, month: +form.month, day: +form.day,
        hour: +form.hour, gender: form.gender,
      }).eq("id", editingId);
    } else {
      await supabase.from("people").insert({
        user_id: user.id, name: form.name, year: +form.year, month: +form.month,
        day: +form.day, hour: +form.hour, gender: form.gender,
      });
    }
    const { data: ppl } = await supabase.from("people").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setPeople(ppl || []);
    setForm(emptyForm); setShowForm(false); setEditingId(null);
  }

  async function deletePerson(id: string) {
    if (!supabase || !user) return;
    await supabase.from("people").delete().eq("id", id);
    setPeople(prev => prev.filter(p => p.id !== id));
  }

  function editPerson(p: Person) {
    setForm({ name: p.name, year: String(p.year), month: String(p.month), day: String(p.day), hour: p.hour, gender: p.gender });
    setEditingId(p.id); setShowForm(true);
  }

  function PersonCard({ person, isMe }: { person: any; isMe?: boolean }) {
    let saju: Saju | null = null;
    try { saju = calcSaju(person.year, person.month, person.day, person.hour ?? -1); } catch {}
    const dp = saju?.dp;
    return (
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E2E8", borderRadius: 10, padding: "20px 22px", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: isMe ? "#2E2E38" : "#EFEFF2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, fontWeight: 600, color: isMe ? "#fff" : "#2E2E38" }}>{(person.name || "?").slice(0, 1)}</span>
          </div>
          <div>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#111116", margin: 0 }}>
              {person.name || "이름 없음"} {isMe && <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: "#9898A4", marginLeft: 4 }}>나</span>}
            </p>
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "#6B6B78", margin: 0 }}>
              {person.year}년 {person.month}월 {person.day}일 · {person.gender === "F" ? "여성" : "남성"}
            </p>
          </div>
        </div>
        {dp && (
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {[saju!.yp, saju!.mp, saju!.dp, saju!.hp].filter(Boolean).map((p: any, i: number) => (
              <div key={i} style={{ flex: 1, background: "#F7F7FA", border: "1px solid #EFEFF2", borderRadius: 6, padding: "8px 4px", textAlign: "center" }}>
                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 600, color: "#111116", margin: 0 }}>{CG_HJ[p.cg]}{JJ_HJ[p.jj]}</p>
                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "#6B6B78", margin: "2px 0 0" }}>{CG[p.cg]}{JJ[p.jj]}</p>
              </div>
            ))}
          </div>
        )}
        {dp && (
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "#9898A4", margin: 0 }}>
            일간: {CG[dp.cg]}{JJ[dp.jj]} ({CG_HJ[dp.cg]}{JJ_HJ[dp.jj]}) · {OH[dp.cg < 10 ? [0,0,1,1,2,2,3,3,4,4][dp.cg] : 0]}({OH_HJ[dp.cg < 10 ? [0,0,1,1,2,2,3,3,4,4][dp.cg] : 0]})
          </p>
        )}
        {!isMe && (
          <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 4 }}>
            <button onClick={() => editPerson(person)} title="수정"
              style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", borderRadius: 6, color: "#9898A4" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F7F7FA")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            </button>
            <button onClick={() => deletePerson(person.id)} title="삭제"
              style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", borderRadius: 6, color: "#9898A4" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#FFF5F5"; e.currentTarget.style.color = "#E04040"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9898A4"; }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 20, height: 20, border: "2px solid #E2E2E8", borderTopColor: "#2E2E38", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E2E8", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => window.location.href = "/"} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "#6B6B78", display: "flex" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#111116")} onMouseLeave={e => (e.currentTarget.style.color = "#6B6B78")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <h1 style={{ fontSize: 17, fontWeight: 600, color: "#111116", margin: 0 }}>사람들</h1>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "#9898A4", letterSpacing: "0.1em" }}>{people.length + (myProfile ? 1 : 0)}명</span>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}
          style={{ padding: "8px 16px", background: "#2E2E38", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "#fff", display: "flex", alignItems: "center", gap: 6 }}
          onMouseEnter={e => (e.currentTarget.style.background = "#1A1A24")} onMouseLeave={e => (e.currentTarget.style.background = "#2E2E38")}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          추가
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
        {/* Add/Edit Form */}
        {showForm && (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E2E8", borderRadius: 10, padding: "24px", marginBottom: 20, animation: "fadeIn 0.2s ease" }}>
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 500, letterSpacing: "0.20em", textTransform: "uppercase", color: "#9898A4", marginBottom: 16 }}>
              {editingId ? "정보 수정" : "새 사람 추가"}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9898A4", display: "block", marginBottom: 4 }}>이름</label>
                <input type="text" placeholder="이름" value={form.name} onChange={e => upd("name", e.target.value)}
                  style={{ width: "100%", background: "#FAFAFA", border: "1px solid #C8C8D0", borderRadius: 4, padding: "10px 14px", fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "#111116", outline: "none" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "rgba(46,46,56,0.25)")} onBlur={e => (e.currentTarget.style.borderColor = "#C8C8D0")} />
              </div>
              {([["생년", "year", "1990"], ["생월", "month", "1"], ["생일", "day", "15"]] as const).map(([l, k, ph]) => (
                <div key={k}>
                  <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9898A4", display: "block", marginBottom: 4 }}>{l}</label>
                  <input type="number" placeholder={ph} value={(form as any)[k]} onChange={e => upd(k, e.target.value)}
                    style={{ width: "100%", background: "#FAFAFA", border: "1px solid #C8C8D0", borderRadius: 4, padding: "10px 14px", fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "#111116", outline: "none" }}
                    onFocus={e => (e.currentTarget.style.borderColor = "rgba(46,46,56,0.25)")} onBlur={e => (e.currentTarget.style.borderColor = "#C8C8D0")} />
                </div>
              ))}
              <div>
                <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9898A4", display: "block", marginBottom: 4 }}>생시</label>
                <select value={form.hour} onChange={e => upd("hour", +e.target.value)}
                  style={{ width: "100%", background: "#FAFAFA", border: "1px solid #C8C8D0", borderRadius: 4, padding: "10px 14px", fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "#111116", outline: "none" }}>
                  {HOURS.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9898A4", display: "block", marginBottom: 4 }}>성별</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {([["F", "여성"], ["M", "남성"]] as const).map(([v, l]) => (
                    <button key={v} onClick={() => upd("gender", v)} style={{
                      flex: 1, padding: "10px 0", background: form.gender === v ? "rgba(46,46,56,0.06)" : "#FAFAFA",
                      border: `1px solid ${form.gender === v ? "rgba(46,46,56,0.25)" : "#C8C8D0"}`, borderRadius: 4, cursor: "pointer",
                      fontFamily: "'Geist Mono', monospace", fontSize: 12, fontWeight: 600, color: form.gender === v ? "#2E2E38" : "#6B6B78",
                    }}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => { setShowForm(false); setEditingId(null); }}
                style={{ flex: 1, padding: "10px 0", background: "#FAFAFA", border: "1px solid #C8C8D0", borderRadius: 4, cursor: "pointer", fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 600, color: "#6B6B78" }}>
                취소
              </button>
              <button onClick={savePerson}
                style={{ flex: 1, padding: "10px 0", background: "#2E2E38", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 600, color: "#fff" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#1A1A24")} onMouseLeave={e => (e.currentTarget.style.background = "#2E2E38")}>
                {editingId ? "수정" : "추가"}
              </button>
            </div>
          </div>
        )}

        {/* My Profile */}
        {myProfile && myProfile.year && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 500, letterSpacing: "0.20em", textTransform: "uppercase", color: "#9898A4", marginBottom: 8, paddingLeft: 2 }}>내 사주</p>
            <PersonCard person={myProfile} isMe />
          </div>
        )}

        {/* Saved People */}
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 500, letterSpacing: "0.20em", textTransform: "uppercase", color: "#9898A4", marginBottom: 8, paddingLeft: 2 }}>
          저장된 사람들 {people.length > 0 && `(${people.length})`}
        </p>
        {people.length === 0 ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E2E8", borderRadius: 10, padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "#9898A4" }}>아직 추가된 사람이 없습니다</p>
            <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}
              style={{ marginTop: 12, padding: "8px 20px", background: "#2E2E38", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 600, color: "#fff" }}>
              첫 번째 사람 추가하기
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {people.map(p => <PersonCard key={p.id} person={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
