"use client";
import { useState } from "react";
import { calcAll, calcSaju, sajuToPromptContext, HOURS, CG, CG_HJ, JJ, JJ_HJ, OH, OH_HJ, OH_C, CG_OH, JJ_OH, ohCounts } from "@/lib/saju";
import type { SajuResult, DaeunItem, Saju } from "@/lib/saju";

interface Message { role: "user" | "assistant"; content: string; }
interface Form { year: string; month: string; day: string; hour: number; gender: string; }
interface PartnerForm { year: string; month: string; day: string; hour: number; gender: string; }

export default function Page() {
  const [step, setStep]           = useState<"form"|"chat">("form");
  const [form, setForm]           = useState<Form>({ year:"", month:"", day:"", hour:11, gender:"F" });
  const [result, setResult]       = useState<SajuResult | null>(null);
  const [sajuCtx, setSajuCtx]     = useState("");
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [showPartner, setShowPartner] = useState(false);
  const [partner, setPartner]     = useState<PartnerForm>({ year:"", month:"", day:"", hour:-1, gender:"M" });
  const [partnerSaju, setPartnerSaju] = useState<Saju | null>(null);

  const upd = (k: keyof Form, v: string|number) => setForm(p => ({...p,[k]:v}));
  const updP = (k: keyof PartnerForm, v: string) => setPartner(p => ({...p,[k]:v}));

  function startChat() {
    if (!form.year||!form.month||!form.day) return;
    const r = calcAll(+form.year,+form.month,+form.day,+form.hour,form.gender);
    const ctx = sajuToPromptContext(r, form.gender, +form.year, +form.month, +form.day);
    setResult(r); setSajuCtx(ctx);
    const dp = r.saju.dp;
    const cd = r.currentDaeun;
    const sy = new Date().getFullYear();
    setMessages([{
      role:"assistant",
      content:`안녕하세요! ${form.year}년 ${form.month}월 ${form.day}일생 ${form.gender==="F"?"여성":"남성"}분의 사주를 분석했습니다.\n\n일간(日干)은 **${CG[dp.cg]}${JJ[dp.jj]}(${CG_HJ[dp.cg]}${JJ_HJ[dp.jj]})**으로 이것이 당신의 핵심 기운입니다.\n\n현재 **${cd ? CG[cd.cg]+JJ[cd.jj]+" 대운" : "대운 산출 중"}** 흐름이며, **${sy}년 ${CG[r.seun.cg]}${JJ[r.seun.jj]} 세운**이 운세에 영향을 주고 있어요.\n\n무엇이든 물어보세요! 궁합이 궁금하시면 왼쪽 **궁합 보기** 버튼을 눌러주세요 💑`
    }]);
    setStep("chat");
  }

  // 궁합 분석 실행
  function analyzePartner() {
    if (!partner.year||!partner.month||!partner.day) return;
    const ps = calcSaju(+partner.year,+partner.month,+partner.day,+partner.hour);
    setPartnerSaju(ps);
    setShowPartner(false);

    // 궁합 컨텍스트 추가해서 AI에게 전달
    const myDp = result!.saju.dp;
    const pDp  = ps.dp;
    const compatCtx = `\n\n[궁합 상대방 정보]\n생년월일: ${partner.year}년 ${partner.month}월 ${partner.day}일 / 성별: ${partner.gender==="F"?"여성":"남성"}\n일주: ${CG[ps.yp.cg]}${JJ[ps.yp.jj]} ${CG[ps.mp.cg]}${JJ[ps.mp.jj]} ${CG[pDp.cg]}${JJ[pDp.jj]}\n일간: ${CG[pDp.cg]}${JJ[pDp.jj]}(${CG_HJ[pDp.cg]}${JJ_HJ[pDp.jj]})`;
    setSajuCtx(prev => prev + compatCtx);

    const msg = `${partner.year}년 ${partner.month}월 ${partner.day}일생 ${partner.gender==="F"?"여성":"남성"}(${CG[pDp.cg]}${JJ[pDp.jj]} 일간)과의 궁합을 분석해주세요. 두 사람의 일간 오행 관계, 상생/상극, 성격 궁합, 연애/결혼 궁합을 자세히 봐주세요.`;
    setInput(msg);
  }

  async function send(overrideInput?: string) {
    const txt = overrideInput ?? input;
    if (!txt.trim()||loading) return;
    const userMsg: Message = { role:"user", content:txt };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs); setInput(""); setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ messages:newMsgs, sajuContext:sajuCtx }),
      });
      if (!res.ok) throw new Error("API 오류");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let aiText = "";
      setMessages(prev => [...prev, { role:"assistant", content:"" }]);
      while (true) {
        const {done,value} = await reader.read();
        if (done) break;
        aiText += decoder.decode(value,{stream:true});
        setMessages(prev => { const u=[...prev]; u[u.length-1]={role:"assistant",content:aiText}; return u; });
      }
    } catch {
      setMessages(prev => [...prev, { role:"assistant", content:"오류가 발생했습니다. 다시 시도해주세요." }]);
    } finally { setLoading(false); }
  }

  return (
    <div style={S.root}>
      <div style={S.bg}/>
      {step==="form" && <FormView form={form} upd={upd} onSubmit={startChat}/>}
      {step==="chat" && result && (
        <ChatView
          result={result} form={form} messages={messages} input={input}
          loading={loading} setInput={setInput} onSend={send}
          onReset={()=>{setStep("form");setMessages([]);setResult(null);setPartnerSaju(null);}}
          showPartner={showPartner} setShowPartner={setShowPartner}
          partner={partner} setPartner={setPartner} updP={updP} analyzePartner={analyzePartner}
          partnerSaju={partnerSaju}
        />
      )}
    </div>
  );
}

function FormView({form,upd,onSubmit}:{form:Form;upd:any;onSubmit:()=>void}) {
  return (
    <div style={S.formWrap}>
      <div style={S.logo}>
        <p style={S.logoBadge}>四柱八字 · AI 명리</p>
        <h1 style={S.logoTitle}>命<span style={{color:"#c4952a"}}>·</span>理 AI</h1>
        <p style={S.logoSub}>사주팔자 기반 AI 명리 상담</p>
      </div>
      <div style={S.card}>
        <p style={S.cardTitle}>생년월일시를 입력해주세요</p>
        {([["생년","year","예: 1990"],["생월","month","1–12"],["생일","day","1–31"]] as const).map(([label,key,ph])=>(
          <div key={key} style={S.row}>
            <span style={S.lbl}>{label}</span>
            <input style={S.inp} type="number" placeholder={ph} value={(form as any)[key]} onChange={e=>upd(key,e.target.value)}/>
          </div>
        ))}
        <div style={S.row}>
          <span style={S.lbl}>생시</span>
          <select style={S.sel} value={form.hour} onChange={e=>upd("hour",+e.target.value)}>
            {HOURS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
        <div style={S.row}>
          <span style={S.lbl}>성별</span>
          <div style={{display:"flex",gap:8,flex:1}}>
            {([["F","여성"],["M","남성"]] as const).map(([v,l])=>(
              <button key={v} style={{...S.gb,...(form.gender===v?S.gbOn:{})}} onClick={()=>upd("gender",v)}>{l}</button>
            ))}
          </div>
        </div>
        <button style={S.cta} onClick={onSubmit}>사주 분석 시작 →</button>
      </div>
    </div>
  );
}

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part,i)=>{
    if(part.startsWith("**")&&part.endsWith("**")) return <strong key={i}>{part.slice(2,-2)}</strong>;
    if(part.startsWith("*")&&part.endsWith("*")) return <em key={i}>{part.slice(1,-1)}</em>;
    return <span key={i}>{part}</span>;
  });
}

function ChatView({result,form,messages,input,loading,setInput,onSend,onReset,showPartner,setShowPartner,partner,setPartner,updP,analyzePartner,partnerSaju}:any) {
  const {saju,daeun,currentDaeun,seun} = result as SajuResult;
  const counts = ohCounts(saju);
  const pillars = [
    {l:"시주",h:"時柱",p:saju.hp},
    {l:"일주",h:"日柱",p:saju.dp},
    {l:"월주",h:"月柱",p:saju.mp},
    {l:"년주",h:"年柱",p:saju.yp},
  ];
  const QUICK = ["성격과 적성 분석해줘","올해 운세는?","현재 대운 해석해줘","직업운 알려줘","연애운이 궁금해","재물운 분석해줘"];
  const currentYear = new Date().getFullYear();

  return (
    <div style={S.chatRoot}>
      <aside style={S.sidebar}>
        <div style={S.sideTop}>
          <h2 style={S.sideTitle}>命理 AI</h2>
          <button style={S.resetBtn} onClick={onReset}>← 다시</button>
        </div>

        {/* 사주팔자 */}
        <div style={S.sideCard}>
          <p style={S.sideCardTitle}>내 사주팔자</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
            {pillars.map(({l,h,p})=>(
              <div key={l} style={S.pBox}>
                <span style={{fontSize:8,color:"#9a8858"}}>{h}</span>
                {p ? (
                  <>
                    <span style={{fontSize:20,color:OH_C[CG_OH[p.cg]]}}>{CG[p.cg]}</span>
                    <span style={{fontSize:20,color:OH_C[JJ_OH[p.jj]]}}>{JJ[p.jj]}</span>
                    <span style={{fontSize:8,color:"#7a6535"}}>{CG_HJ[p.cg]}{JJ_HJ[p.jj]}</span>
                  </>
                ) : (
                  <>
                    <span style={{fontSize:18,color:"#ccc"}}>?</span>
                    <span style={{fontSize:18,color:"#ccc"}}>?</span>
                    <span style={{fontSize:8,color:"#ccc"}}>미상</span>
                  </>
                )}
                <span style={{fontSize:8,color:"#8a7040"}}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 오행 분포 */}
        <div style={S.sideCard}>
          <p style={S.sideCardTitle}>오행 분포</p>
          {OH.map((n,i)=>(
            <div key={n} style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
              <span style={{width:13,fontSize:11,color:OH_C[i],textAlign:"center"}}>{OH_HJ[i]}</span>
              <div style={{flex:1,height:2,background:"#e8e0d0"}}>
                <div style={{width:`${(counts[i]/Math.max(...counts,1))*100}%`,height:"100%",background:OH_C[i]}}/>
              </div>
              <span style={{fontSize:10,color:"#9a8858",width:10}}>{counts[i]}</span>
            </div>
          ))}
        </div>

        {/* 대운 타임라인 */}
        <div style={S.sideCard}>
          <p style={S.sideCardTitle}>대운 흐름</p>
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            {daeun.map((d:DaeunItem)=>(
              <div key={d.startAge} style={{...S.daeunItem,...(d.isCurrent?S.daeunCurrent:{})}}>
                <span style={{fontSize:10,color:d.isCurrent?"#c4952a":"#9a8858",minWidth:40}}>{d.startAge}~{d.endAge}세</span>
                <span style={{fontSize:13,color:d.isCurrent?"#c4952a":OH_C[CG_OH[d.cg]]}}>{CG[d.cg]}</span>
                <span style={{fontSize:13,color:d.isCurrent?"#c4952a":OH_C[JJ_OH[d.jj]]}}>{JJ[d.jj]}</span>
                {d.isCurrent&&<span style={{fontSize:9,color:"#c4952a",marginLeft:"auto"}}>현재</span>}
              </div>
            ))}
          </div>
        </div>

        {/* 세운 */}
        <div style={{...S.sideCard,textAlign:"center"}}>
          <p style={S.sideCardTitle}>{currentYear}년 세운</p>
          <div style={{display:"flex",justifyContent:"center",gap:4,alignItems:"center"}}>
            <span style={{fontSize:22,color:OH_C[CG_OH[seun.cg]]}}>{CG[seun.cg]}</span>
            <span style={{fontSize:22,color:OH_C[JJ_OH[seun.jj]]}}>{JJ[seun.jj]}</span>
            <span style={{fontSize:11,color:"#9a8858"}}>{CG_HJ[seun.cg]}{JJ_HJ[seun.jj]}</span>
          </div>
        </div>

        {/* 궁합 버튼 */}
        <button style={S.compatBtn} onClick={()=>setShowPartner(!showPartner)}>
          💑 궁합 보기
        </button>

        {/* 궁합 입력 패널 */}
        {showPartner && (
          <div style={S.sideCard}>
            <p style={S.sideCardTitle}>상대방 정보</p>
            {([["년","year","예: 1988"],["월","month","1–12"],["일","day","1–31"]] as const).map(([l,k,ph])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:11,color:"#8a7040",width:16}}>{l}</span>
                <input style={{...S.inp,fontSize:13}} type="number" placeholder={ph}
                  value={(partner as any)[k]} onChange={e=>updP(k,e.target.value)}/>
              </div>
            ))}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <span style={{fontSize:11,color:"#8a7040",width:16}}>시</span>
              <select style={{...S.sel,fontSize:11,padding:"5px 8px"}} value={partner.hour}
                onChange={e=>setPartner((p:any)=>({...p,hour:+e.target.value}))}>
                {HOURS.map((o:any)=><option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:6,marginBottom:12}}>
              {([["F","여성"],["M","남성"]] as const).map(([v,l])=>(
                <button key={v} style={{...S.gb,flex:1,fontSize:11,padding:"5px 0",...(partner.gender===v?S.gbOn:{})}}
                  onClick={()=>updP("gender",v)}>{l}</button>
              ))}
            </div>
            <button style={{...S.cta,marginTop:0,padding:"10px 0",fontSize:12}} onClick={analyzePartner}>
              궁합 분석하기 →
            </button>
          </div>
        )}

        {/* 상대방 사주 표시 */}
        {partnerSaju && (
          <div style={S.sideCard}>
            <p style={S.sideCardTitle}>상대방 사주</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4}}>
              {[{l:"일주",p:partnerSaju.dp},{l:"월주",p:partnerSaju.mp},{l:"년주",p:partnerSaju.yp}].map(({l,p})=>(
                <div key={l} style={S.pBox}>
                  <span style={{fontSize:17,color:OH_C[CG_OH[p.cg]]}}>{CG[p.cg]}</span>
                  <span style={{fontSize:17,color:OH_C[JJ_OH[p.jj]]}}>{JJ[p.jj]}</span>
                  <span style={{fontSize:8,color:"#8a7040"}}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{fontSize:10,color:"#b0a080",textAlign:"center",marginTop:"auto"}}>
          {form.year}년 {form.month}월 {form.day}일<br/>{form.gender==="F"?"여성":"남성"}
        </p>
      </aside>

      <main style={S.chatMain}>
        <div style={S.msgList}>
          {messages.map((m:Message,i:number)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",marginBottom:16}}>
              {m.role==="assistant"&&<div style={S.aiAvatar}>命</div>}
              <div style={{...S.bubble,...(m.role==="user"?S.bubbleUser:S.bubbleAI),maxWidth:"75%"}}>
                {m.content.split("\n").map((line,j)=>{
                  if(line.startsWith("### ")) return <h4 key={j} style={{fontSize:13,fontWeight:"bold",color:"#5a3e14",margin:"12px 0 4px"}}>{line.slice(4)}</h4>;
                  if(line.startsWith("## ")) return <h3 key={j} style={{fontSize:14,fontWeight:"bold",color:"#3a2a0a",margin:"14px 0 6px"}}>{line.slice(3)}</h3>;
                  if(line.startsWith("# ")) return <h2 key={j} style={{fontSize:16,fontWeight:"bold",color:"#3a2a0a",margin:"16px 0 8px"}}>{line.slice(2)}</h2>;
                  if(line.startsWith("> ")) return <blockquote key={j} style={{borderLeft:"3px solid #c4952a",paddingLeft:10,color:"#7a5a28",margin:"8px 0",fontStyle:"italic"}}>{line.slice(2)}</blockquote>;
                  if(line.startsWith("- ")) return <div key={j} style={{display:"flex",gap:8,margin:"3px 0"}}><span style={{color:"#c4952a",flexShrink:0}}>•</span><span>{renderInline(line.slice(2))}</span></div>;
                  if(line.match(/^\d+\. /)) return <div key={j} style={{display:"flex",gap:8,margin:"3px 0"}}><span style={{color:"#c4952a",flexShrink:0}}>{line.match(/^\d+/)?.[0]}.</span><span>{renderInline(line.replace(/^\d+\. /,""))}</span></div>;
                  if(line==="---"||line==="***") return <hr key={j} style={{border:"none",borderTop:"1px solid #e8d8b0",margin:"12px 0"}}/>;
                  if(line==="") return <br key={j}/>;
                  return <div key={j} style={{margin:"2px 0"}}>{renderInline(line)}</div>;
                })}
              </div>
            </div>
          ))}
          {loading&&(
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
              <div style={S.aiAvatar}>命</div>
              <div style={{...S.bubble,...S.bubbleAI,color:"#9a8858"}}>분석 중...</div>
            </div>
          )}
        </div>

        {messages.length<=1&&(
          <div style={S.quickWrap}>
            {QUICK.map(q=>(
              <button key={q} style={S.quickBtn} onClick={()=>setInput(q)}>{q}</button>
            ))}
          </div>
        )}

        <div style={S.inputRow}>
          <input style={S.inputBox} placeholder="궁금한 것을 물어보세요... (예: 1988년 3월생 남자랑 궁합 어때?)"
            value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&onSend()}/>
          <button style={{...S.sendBtn,opacity:loading||!input.trim()?0.5:1}}
            onClick={()=>onSend()} disabled={loading||!input.trim()}>전송</button>
        </div>
      </main>
    </div>
  );
}

const S:Record<string,React.CSSProperties> = {
  root:        {minHeight:"100vh",background:"#faf6ee",fontFamily:"Georgia,serif",position:"relative"},
  bg:          {position:"fixed",inset:0,background:"radial-gradient(ellipse at 20% 0%,rgba(196,149,42,.06) 0%,transparent 60%)",pointerEvents:"none"},
  formWrap:    {display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"40px 16px"},
  logo:        {textAlign:"center",marginBottom:36},
  logoBadge:   {fontSize:11,letterSpacing:"0.2em",textTransform:"uppercase",color:"#8a7040",border:"1px solid #d4b870",padding:"4px 14px",display:"inline-block",marginBottom:14},
  logoTitle:   {fontSize:56,color:"#2a1a04",margin:"0 0 8px",fontWeight:400},
  logoSub:     {fontSize:13,color:"#8a7040",letterSpacing:"0.1em",margin:0},
  card:        {background:"#fff",border:"1px solid #e8d8b0",padding:"36px 32px",width:"100%",maxWidth:460,boxShadow:"0 4px 24px rgba(139,90,20,.08)"},
  cardTitle:   {fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",color:"#8a7040",margin:"0 0 28px"},
  row:         {display:"flex",alignItems:"center",gap:14,marginBottom:18},
  lbl:         {fontSize:13,color:"#8a7040",width:36,flexShrink:0},
  inp:         {flex:1,border:"none",borderBottom:"1px solid #ddd0b0",background:"transparent",fontSize:16,padding:"6px 0",outline:"none",fontFamily:"Georgia,serif",color:"#3a2a0a"},
  sel:         {flex:1,border:"1px solid #ddd0b0",background:"#fff",fontSize:13,padding:"7px 10px",outline:"none",fontFamily:"Georgia,serif",color:"#3a2a0a",cursor:"pointer"},
  gb:          {flex:1,padding:"8px 0",background:"transparent",border:"1px solid #ddd0b0",color:"#8a7040",fontSize:13,cursor:"pointer",fontFamily:"Georgia,serif"},
  gbOn:        {border:"1px solid #c4952a",color:"#c4952a",background:"rgba(196,149,42,.08)"},
  cta:         {width:"100%",marginTop:28,padding:"14px 0",background:"linear-gradient(135deg,#c4952a,#8a6018)",border:"none",color:"#fff",fontSize:14,letterSpacing:"0.1em",cursor:"pointer",fontFamily:"Georgia,serif"},
  chatRoot:    {display:"flex",height:"100vh",overflow:"hidden"},
  sidebar:     {width:265,background:"#fff",borderRight:"1px solid #e8d8b0",display:"flex",flexDirection:"column",gap:10,padding:14,overflowY:"auto"},
  sideTop:     {display:"flex",justifyContent:"space-between",alignItems:"center"},
  sideTitle:   {fontSize:17,color:"#2a1a04",margin:0,fontWeight:400},
  resetBtn:    {fontSize:11,color:"#8a7040",background:"transparent",border:"1px solid #ddd0b0",padding:"4px 10px",cursor:"pointer",fontFamily:"Georgia,serif"},
  sideCard:    {background:"#faf6ee",border:"1px solid #e8d8b0",padding:"12px 14px"},
  sideCardTitle:{fontSize:10,letterSpacing:"0.15em",textTransform:"uppercase",color:"#8a7040",margin:"0 0 10px"},
  pBox:        {background:"#fff",border:"1px solid #e8d8b0",padding:"8px 3px",display:"flex",flexDirection:"column",alignItems:"center",gap:1},
  daeunItem:   {display:"flex",alignItems:"center",gap:6,padding:"4px 8px",borderRadius:2},
  daeunCurrent:{background:"rgba(196,149,42,.08)",border:"1px solid rgba(196,149,42,.3)"},
  compatBtn:   {width:"100%",padding:"10px 0",background:"linear-gradient(135deg,#8a6018,#c4952a)",border:"none",color:"#fff",fontSize:13,cursor:"pointer",fontFamily:"Georgia,serif",letterSpacing:"0.05em"},
  chatMain:    {flex:1,display:"flex",flexDirection:"column",overflow:"hidden"},
  msgList:     {flex:1,overflowY:"auto",padding:"24px 28px"},
  aiAvatar:    {width:32,height:32,background:"linear-gradient(135deg,#c4952a,#8a6018)",color:"#fff",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"50%",flexShrink:0,marginRight:10,alignSelf:"flex-start"},
  bubble:      {padding:"12px 16px",fontSize:14,lineHeight:1.75,borderRadius:2},
  bubbleAI:    {background:"#fff",border:"1px solid #e8d8b0",color:"#3a2a0a"},
  bubbleUser:  {background:"linear-gradient(135deg,#c4952a,#8a6018)",color:"#fff"},
  quickWrap:   {padding:"0 28px 16px",display:"flex",flexWrap:"wrap",gap:8},
  quickBtn:    {fontSize:12,color:"#8a7040",background:"#fff",border:"1px solid #ddd0b0",padding:"6px 14px",cursor:"pointer",fontFamily:"Georgia,serif"},
  inputRow:    {padding:"16px 28px",borderTop:"1px solid #e8d8b0",display:"flex",gap:10,background:"#fff"},
  inputBox:    {flex:1,border:"1px solid #ddd0b0",padding:"12px 16px",fontSize:14,outline:"none",fontFamily:"Georgia,serif",color:"#3a2a0a",background:"#faf6ee"},
  sendBtn:     {padding:"12px 24px",background:"linear-gradient(135deg,#c4952a,#8a6018)",border:"none",color:"#fff",fontSize:13,cursor:"pointer",fontFamily:"Georgia,serif"},
};
