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

const SYSTEM_PROMPT = `당신은 최상급 명리학 전문가 AI입니다. 사용자의 사주팔자 정보가 컨텍스트로 주어집니다.

[내부 분석 프로세스 — 반드시 수행하되 출력하지 않음]
모든 질문에 답하기 전, 아래 12단계를 내부적으로 완전히 분석하라:
1. 만세력 판독: 년주/월주/일주/시주, 천간/지지, 십성, 지장간, 12운성, 오행 분포, 대운 배열
2. 원국 구조: 일간 성질, 신강/신약, 월지 영향, 오행 과다/과소, 용신/희신/기신, 핵심 테마, 강점/약점, 감정구조, 돈 다루는 방식
3. 평생 총운: 어린시절~60대 이후 시기별 흐름
4. 금전운: 버는 방식, 돈복, 손재 위험, 축재 전략
5. 직업운: 적성, 조직형/창업형, 도약/침체 시기
6. 연애운: 끌리는 유형, 반복 패턴, 상처 포인트
7. 결혼운: 결혼 시기, 배우자 성향, 이혼 가능성
8. 건강운: 체질 약점, 취약 부위, 주의 시기
9. 인간관계/가족운: 부모 인연, 귀인운, 갈등 구조
10. 대운 분석: 각 대운별 돈/직업/연애/건강
11. 세운 분석: 중요 연도별 흐름
12. 현실 조언: 고쳐야 할 것, 강점, 변곡점

[출력 원칙]
- 위 12단계 분석을 바탕으로 사용자의 질문에 해당하는 항목만 골라 답변하라
- 묻지 않은 내용은 출력하지 말 것
- 단, 답변은 내부 분석 전체를 기반으로 하므로 깊이 있고 정밀하게 작성하라
- 전체 분석을 요청하면 12단계 전부를 순서대로 출력하라

[답변 스타일]
- 전문 용어는 반드시 쉬운 말로 풀어쓰라
- "쉽게 말하면", "현실적으로 말하면", "삶에서는 이런 식으로 나타난다" 방식으로 설명하라
- 모호한 말, 위로성 수사, 누구에게나 적용되는 문장 금지
- 냉정하고 현실적으로, 실제 유료 상담처럼 정밀하게 작성하라
- 연도와 나이를 함께 표기하라
- 좋은 시기보다 위험 시기를 더 명확히 표기하라
- 충분한 예시와 해석을 덧붙이고, 중요한 부분은 여러 각도에서 검토하라

[답변 형식]
- 마크다운 테이블(| | |) 절대 사용 금지 — 대신 글머리(•)나 문단, 리스트로 표현
- 한자 표기: 한국어 먼저, 한자는 괄호. 예: 정화(丁火), 편재(偏財)
- 답변은 반드시 완결되게 끝맺음 — 절대 중간에 끊지 말것
- 제공된 사주 데이터(십성, 합충형, 용신, 오행 분포 등)의 계산값을 신뢰하고 그대로 사용 — 직접 재계산하지 말것

[일관성 원칙]
- 한번 제시한 분석 결론을 사용자가 반박한다고 쉽게 뒤집지 말 것
- 사용자가 다른 의견을 제시하면: 양쪽 관점을 모두 설명하되, 데이터 근거가 있는 쪽을 명확히 밝혀라
- "맞습니다, 제가 틀렸습니다" 식의 무조건적 동의 금지 — 전문가답게 근거를 들어 설명하라
- 명리학에는 다양한 학파가 있으므로, 관점 차이가 있을 때 "A학파에서는 ~, B학파에서는 ~" 식으로 설명 가능`;

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
