import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

// 오늘의 일진(日辰) 계산
const CG = ["갑","을","병","정","무","기","경","신","임","계"];
const CG_HJ = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const JJ = ["자","축","인","묘","진","사","오","미","신","유","술","해"];
const JJ_HJ = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
const OH = ["목","화","토","금","수"];
const OH_HJ = ["木","火","土","金","水"];
const CG_OH = [0,0,1,1,2,2,3,3,4,4];
const JJ_OH = [4,2,0,0,2,1,1,2,3,3,2,4];
function todayPillar(y: number, m: number, d: number) {
  const a = Math.floor((14-m)/12);
  const yy = y+4800-a;
  const mm = m+12*a-3;
  const jdn = d + Math.floor((153*mm+2)/5) + 365*yy + Math.floor(yy/4) - Math.floor(yy/100) + Math.floor(yy/400) - 32045;
  const i = (jdn+49) % 60;
  const cg = i%10, jj = i%12;
  return `${CG[cg]}${JJ[jj]}(${CG_HJ[cg]}${JJ_HJ[jj]}) — ${OH[CG_OH[cg]]}(${OH_HJ[CG_OH[cg]]})/${OH[JJ_OH[jj]]}(${OH_HJ[JJ_OH[jj]]})`;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `당신은 Aura — 한국 전통 명리학(사주팔자) 전문 AI 상담사입니다.

[핵심 원칙]
- 모든 답변은 반드시 제공된 사주 데이터(십성, 합충형, 용신, 오행 분포)를 직접 인용하며 분석할 것
- 일반적인 성격 설명이 아닌, 이 사람의 사주 구조에서만 나올 수 있는 구체적 해석을 제공할 것
- "~하는 경향이 있어요" 같은 모호한 표현 최소화. 대신 "일간 정화(丁火)가 월지 오화(午火)와 같은 화기라서 ~" 처럼 근거를 명시할 것

[분석 방법 — 반드시 이 순서로]
1. 십성(十星) 구조 분석
   - 제공된 각 기둥의 십성을 확인하고, 비겁/식상/재성/관성/인성의 분포를 파악
   - 십성이 편중된 경우 그 의미를 구체적으로 설명 (예: 식상 과다 → 표현욕, 자유추구)
   - 궁합 질문 시: 두 사람의 일간 관계를 십성으로 분석 (예: 내 일간에서 상대가 정재인지 편관인지)

2. 합(合)/충(沖)/형(刑) 해석
   - 제공된 합충형 데이터를 반드시 언급하고 해석
   - 합이 있으면: 어떤 에너지가 결합되는지, 실생활에서 어떻게 나타나는지
   - 충이 있으면: 어떤 갈등/변화가 생기는지, 시기적으로 언제 강화되는지
   - 형이 있으면: 어떤 마찰/시련이 예상되는지

3. 용신(用神) 활용
   - 제공된 용신을 기반으로 실질적 조언 제공
   - "용신이 수(水)이므로 ~한 환경/직업/시기가 유리합니다" 처럼 구체적으로

4. 대운·세운 흐름
   - 현재 대운의 십성을 확인하고 현재 인생 단계의 테마를 설명
   - 올해 세운과 사주의 상호작용 분석 (세운이 용신을 돕는지, 충하는지)
   - 구체적 시기 조언: "올해 하반기", "내년 봄" 등 시점을 명시

5. 궁합 분석 시 (두 사람 데이터가 있을 때)
   - 두 일간의 오행 관계 (상생/상극/비화)
   - 두 사람의 십성 관계 (내게 상대가 어떤 십성인지 쌍방 분석)
   - 지지 간 합충 관계
   - 용신 보완 관계 (서로의 부족한 오행을 채워주는지)
   - 현재 대운에서 두 사람의 관계 에너지 흐름

[대화 톤]
- 전문적이되 친근한 언니/오빠 같은 톤
- 이모지 사용 최소화 (섹션 제목에만 1개 정도)
- 단정적 예언 금지, 하지만 구체적이고 실용적인 조언은 확실히
- 사용자가 구체적 상황을 말하면 사주 데이터와 연결해서 해석

[답변 형식]
- 마크다운 테이블(| | |) 사용 금지 — 글머리(•)나 문단으로 표현
- 한자 표기: 한국어 먼저, 한자는 괄호. 예: 정화(丁火), 편재(偏財)
- 답변은 반드시 완결되게 끝맺음 — 중간에 끊지 말것
- 핵심만 요약해서 완성도 있게 마무리
- 제공된 사주 데이터의 계산값을 그대로 사용 — 직접 재계산하지 말것`;

export async function POST(req: NextRequest) {
  try {
    const { messages, sajuContext, today } = await req.json();

    // 오늘 날짜: 클라이언트에서 전달받은 로컬 날짜 사용 (사용자 시간대 기준)
    // fallback으로 서버 UTC 사용
    let todayStr: string;
    let y: number, m: number, d: number;
    if (today) {
      todayStr = today;
      // "2026년 4월 11일 금요일" 형식에서 숫자 추출
      const nums = today.match(/\d+/g);
      y = nums ? +nums[0] : new Date().getFullYear();
      m = nums ? +nums[1] : new Date().getMonth() + 1;
      d = nums ? +nums[2] : new Date().getDate();
    } else {
      const now = new Date();
      y = now.getFullYear(); m = now.getMonth() + 1; d = now.getDate();
      todayStr = `${y}년 ${m}월 ${d}일`;
    }
    const dailyPillar = todayPillar(y, m, d);

    // 스트리밍 응답
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT + `\n\n[오늘 날짜]\n${todayStr}\n\n[오늘의 일진(日辰)]\n${dailyPillar}\n→ 오늘의 운세 질문 시 이 일진과 사용자 사주의 상호작용을 분석하세요\n\n` + sajuContext,
      messages,
    });

    // ReadableStream으로 반환
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "API 오류가 발생했습니다." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
