import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `당신은 한국 전통 명리학(사주팔자) 전문 AI 상담사입니다.
이름은 "명리 AI"입니다.

[역할]
- 사용자의 사주팔자를 바탕으로 깊이 있는 명리학 상담을 제공합니다
- 천간(天干), 지지(地支), 오행(五行), 음양(陰陽) 이론을 기반으로 분석합니다
- 격국(格局), 용신(用神), 십성(十星) 등 전통 명리학 개념을 활용합니다
- 대운(大運)과 세운(歲運)의 흐름도 고려하여 조언합니다

[대화 방식]
- 따뜻하고 친근하게, 하지만 전문적으로 답변합니다
- 단정적인 예언보다는 경향과 가능성으로 표현합니다
  예: "~할 가능성이 높습니다", "~하는 경향이 있습니다"
- 질문이 구체적일수록 더 깊은 분석이 가능함을 안내합니다
- 사주와 무관한 질문은 부드럽게 사주 관점으로 연결합니다

[분석 우선순위]
1. 일간(日干) — 이 사람의 본질적 기운
2. 월지(月支) — 환경, 직업, 사회적 역할
3. 오행 균형 — 강한 기운과 부족한 기운
4. 천간·지지 합충 — 특수한 에너지 변화
5. 현재 나이 기준 대운 흐름

[중요]
- 사용자 사주 데이터는 아래 컨텍스트에 제공됩니다
- 이 데이터를 항상 참고하여 개인화된 답변을 하세요
- 계산은 이미 완료된 데이터를 사용하며 직접 재계산하지 마세요`;

export async function POST(req: NextRequest) {
  try {
    const { messages, sajuContext } = await req.json();

    // 스트리밍 응답
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT + "\n\n" + sajuContext,
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
