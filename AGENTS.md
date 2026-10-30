# AGENTS.md

HRcoach: 인사 규정 계산 앱을 만드는 앱 빌더(관리자)와, 만든 앱을 쓰는 사이트(고객사 인사담당자). Next.js 14 App Router · Supabase · Gemini · Vercel.

## 지금 진행 중인 작업

**리포트 개선(문서형 리포트·AI 양식 제안·대화형 편집·출력)과 회원·구독 관리.** 시작 전에 반드시 읽는다.

- `docs/report-upgrade/HANDOVER.md`: 범위, 확정 결정, 코드 지도, 남은 단계 설계, 주의 사항
- `../인수인계/README.md` (저장소 상위 폴더): 고객·계약·메일 경과 같은 사업 맥락, 고객에게 보내는 문서 작성 규칙

`docs/`는 `.gitignore` 대상이라 두 문서 모두 로컬 작업 폴더에만 있다. 보이지 않으면 사용자에게 요청한다.

## 명령

```bash
npm install
npx tsc --noEmit     # 타입 검사
npx next build       # 빌드 (Nanum Pen Script 폰트 경고는 원래 있던 것)
npx next dev         # 로컬 실행 (.env.local 필요)
```

## 작업 규칙

- 변경은 **커밋 → 브랜치 push → PR → main 병합**까지 끝낸다. 병합되면 Vercel이 자동 배포하고, 사용자는 배포된 사이트에서 확인한다. 로컬에만 있는 수정은 반영되지 않은 것이다.
  - 브랜치 `feat/*` · `fix/*` · `docs/*`, `gh pr create` 후 `gh pr merge --merge --delete-branch`
  - 커밋 메시지는 한국어 한 줄 요약(무엇을 왜) + 필요하면 본문. git 계정 `sentif-ai <info@sentif.ai>`
- 병합 전에 `tsc --noEmit`과 `next build`를 통과시킨다. 화면을 바꿨으면 데스크톱·모바일 폭에서 직접 렌더해 확인한다 (방법은 HANDOVER §7).
- DB 변경은 `supabase/migrations/YYYYMMDD_설명.sql`로 추가한다. 자동 적용되지 않으므로 사용자에게 Supabase SQL Editor 실행을 요청하고 PR에 적는다.
- **저장소가 공개다.** 키 값, 계약 금액, 고객 연락처를 커밋하지 않는다. 내부 문서는 `docs/`(git 제외)에 둔다. `test_심의/`는 커밋하지 않는다.
- **`lib/plans.ts`의 가격은 토스 카드사 심사 통과 전까지 바꾸지 않는다.**
- 주석은 한국어로, 코드가 "왜" 그런지를 적는다. 사용자에게 보이는 문구는 사용자 관점 용어로 쓴다.
- 사용자에게 보고할 때는 한국어로, 확인한 것과 확인하지 못한 것을 구분해서 말한다.
