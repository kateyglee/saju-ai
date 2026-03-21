# 命理 AI — 사주팔자 AI 상담 서비스

## 로컬 실행

```bash
npm install
cp .env.example .env.local
# .env.local 에 Anthropic API 키 입력
npm run dev
# http://localhost:3000 접속
```

## Vercel 배포 (누구나 접속 가능한 웹사이트)

1. github.com 에서 새 repository 만들기
2. 이 폴더 전체를 업로드
3. vercel.com 접속 → "Import Project" → GitHub repository 선택
4. Environment Variables 에서 `ANTHROPIC_API_KEY` 추가
5. Deploy 클릭 → 완료!

## 파일 구조

```
saju-ai/
├── app/
│   ├── api/chat/route.ts   ← Claude API 연결
│   ├── page.tsx            ← 메인 UI (폼 + 채팅)
│   └── layout.tsx
├── lib/
│   └── saju.ts             ← 사주 계산 엔진
├── .env.example            ← API 키 설정 예시
└── package.json
```
