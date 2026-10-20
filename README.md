# 💣 지뢰찾기 (findbomb)

경영정보학과 2024026013 김연수

Vite + 바닐라 JS로 만든 지뢰찾기 웹 게임입니다. 모든 게임 결과(승리·패배)는 Supabase에 저장되고, 사용자는 게임 리뷰를 남길 수 있습니다. 로그인 없이 닉네임만 입력하면 바로 플레이할 수 있습니다.

## 기능

- 초급(9×9, 지뢰 10) / 중급(16×16, 지뢰 40) / 고급(16×30, 지뢰 99)
- 첫 클릭은 항상 안전, 빈 칸 자동 확장, 숫자 칸 클릭으로 주변 한 번에 열기
- 우클릭 깃발 / 모바일은 길게 누르기 또는 🚩 깃발 모드
- 게임 종료 시 점수를 Supabase `scores` 테이블에 자동 저장
- 난이도별 랭킹(점수 내림차순, 상위 20명)
- 별점(1~5) + 내용 리뷰 작성 및 목록 조회 (`reviews` 테이블)

점수 = (연 칸 수 × 10 + 승리 시 `max(0, 1000 − 초 × 5)`) × 난이도 배율(초급 1 · 중급 3 · 고급 6)

## 1. Supabase 설정

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만듭니다.
2. 대시보드 → **SQL Editor** → `supabase/schema.sql` 내용을 붙여넣고 **Run**.
   - `scores`, `reviews` 테이블과 RLS 정책(누구나 조회·추가 가능, 수정·삭제 불가)이 만들어집니다.
3. **Project Settings → API**(또는 API Keys)에서 아래 두 값을 복사합니다.
   - Project URL
   - `anon` public 키(또는 Publishable key)

> anon/publishable 키는 브라우저에 공개돼도 되는 키입니다. `service_role`(secret) 키는 절대 넣지 마세요.

## 2. 로컬 실행

```bash
cp .env.example .env.local   # 복사 후 URL과 키를 채워 넣기
npm install
npm run dev                  # http://localhost:5173
```

## 3. Vercel 배포

**방법 A — GitHub 연동 (추천)**

1. 이 폴더를 GitHub 저장소에 push 합니다.
2. [vercel.com](https://vercel.com) → **Add New → Project** → 저장소 Import.
3. Framework Preset은 **Vite**로 자동 인식됩니다 (Build: `npm run build`, Output: `dist`).
4. **Environment Variables**에 다음 두 개를 추가하고 Deploy.
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

**방법 B — CLI**

```bash
npx vercel                 # 처음 한 번 프로젝트 연결
npx vercel env add VITE_SUPABASE_URL
npx vercel env add VITE_SUPABASE_ANON_KEY
npx vercel --prod
```

> 환경 변수는 빌드할 때 코드에 들어가므로, 값을 바꾼 뒤에는 다시 배포해야 반영됩니다.

## 폴더 구조

```
index.html          화면 마크업 (시작 / 게임 / 랭킹 / 리뷰)
src/main.js         화면 전환, 입력 처리, 랭킹·리뷰 UI
src/game.js         지뢰찾기 게임 로직, 점수 계산
src/supabase.js     Supabase 클라이언트와 DB 함수
src/style.css       스타일
supabase/schema.sql DB 테이블·보안 정책
```
