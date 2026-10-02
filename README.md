# 아미쿠스 교육부 체크인 앱 (Amicus Check-In)

[![Architecture diagram](https://gitdiagram.com/diagram-badge.svg)](https://gitdiagram.com/amicusnextc-ui/amicus-checkin-?utm_source=readme&utm_medium=badge)

아미쿠스장로교회 교육부(유아·유치·유년·초등·중고등)의 주일 출석 체크인/체크아웃,
학생 명단 관리, 주일 마무리 보고를 처리하는 웹 앱입니다.

- 라이브: https://amicus-checkin.vercel.app
- 호스팅: Vercel (main 브랜치 push 시 자동 배포, 약 80초)
- 데이터 저장소: Notion 데이터베이스
- 빌드 단계 없음 — 정적 HTML + `/api/*.js` 서버리스 함수

---

## 구조 한눈에 보기

```
[키오스크/태블릿 페이지]            [스태프 페이지]
 index.html      체크인 (전 부서)     staff.html          간사 — 출석/명단/주일 마무리
 youth.html      중고등부 전용 체크인   director.html       디렉터 — 전 부서 대시보드
 staff-checkout.html  체크아웃        admin.html          관리 도구
 register.html   신규 등록           test.html           라벨 프린터 테스트
 parent-info.html 학부모 정보 입력
 liability.html  Liability 서명

              │  모두 fetch → /api/*
              ▼
        [Vercel Serverless API]
              │
              ▼
        [Notion DB  학생 / 출석 / 요청 / 결석]
              │
              ▼
        [GitHub Actions 크론]  →  Resend 이메일
```

## 페이지

| 파일 | 용도 | 접근 |
|---|---|---|
| `index.html` | 주일 체크인 키오스크 (전 부서), 이름표 라벨 인쇄 | 공개 |
| `youth.html` | 중고등부 전용 체크인 | 공개 |
| `staff-checkout.html` | 체크아웃 — 보호자 확인 후 하원 처리 | 공개 |
| `register.html` | 신규 학생/방문자 등록 | 공개 |
| `parent-info.html` | 학부모가 자녀 정보 입력 (HMAC 토큰 링크) | 토큰 |
| `liability.html` | Liability 동의 서명 | 토큰 |
| `staff.html` | 간사용 — 출석 현황, 명단, 사진, 주일 마무리 | 로그인 |
| `director.html` | 디렉터용 — 전 부서 통계, 전체 명단, 방문자 | 로그인 |
| `admin.html` | 관리 도구 | 로그인 |
| `test.html` | Brother QL-810W 라벨 출력 테스트 | — |

## API (`/api`)

| 엔드포인트 | 하는 일 |
|---|---|
| `checkin.js` | 출석 기록 생성 |
| `checkout.js` | 하원 처리 (체크아웃 시각 기록) |
| `attendance.js` | 출석 기록 조회·수정 (다목적) |
| `attendance-today.js` | 오늘 출석 현황 |
| `check-status.js` | 특정 학생 체크인 상태 조회 |
| `roster.js` | 학생 명단 (`?includeVisitors=1` 로 방문자 포함) |
| `search-student.js` | 이름/전화번호 검색 |
| `update-student.js` | 학생 정보 생성·수정, Liability·학교 정보 저장 |
| `visitor-checkin.js` | 방문자 체크인 |
| `staff-auth.js` | 간사/디렉터 로그인 → API 토큰 발급 |
| `staff-list.js` | 간사 목록 |
| `weekly-summary.js` | 주일 마무리 요약 저장·조회 |

## 페이지 → API 호출 매핑

각 HTML이 실제로 fetch 하는 엔드포인트입니다.

| 페이지 | 호출하는 엔드포인트 |
|---|---|
| `index.html` | `search-student`, `check-status`, `checkin`, `checkout`, `roster`, `attendance-today`, `update-student`, `visitor-checkin` |
| `youth.html` | `roster`, `checkin`, `attendance-today`, `visitor-checkin` |
| `staff-checkout.html` | `roster`, `checkout`, `attendance-today` |
| `register.html` | `update-student` |
| `parent-info.html` | `roster`, `update-student` |
| `liability.html` | `roster`, `search-student`, `update-student` |
| `staff.html` | `staff-auth`, `roster`, `attendance`, `attendance-today`, `checkin`, `checkout`, `update-student`, `weekly-summary` |
| `director.html` | `staff-auth`, `staff-list`, `roster`, `attendance`, `attendance-today`, `update-student`, `weekly-summary` |
| `admin.html` | `attendance-today`, `checkin`, `checkout` |
| `test.html` | 없음 (라벨 인쇄만) |

모든 API 함수는 Notion API를 직접 호출합니다 (`@notionhq/client`).

## 자동화 (GitHub Actions)

| 워크플로 | 일정 (PT) | 하는 일 |
|---|---|---|
| `auto-close-checkout.yml` | 일 오후 6시 | 미체크아웃 기록 자동 마감 |
| `auto-save-summary.yml` | 일 오후 5시 30분 | 주일 출석 요약 자동 저장 |
| `sunday-wrapup-reminder.yml` | 월 오전 9시 | 주일 마무리 리마인더 + 위원장 확인 요청 메일 |
| `weekly-reconciliation.yml` | 월 오전 3시 | 출석 데이터 정합성 점검 |
| `weekly-liability-reminder.yml` | 토 오전 9시 | Liability 미제출자 리마인더 |
| `health-check.yml` | 매일 / 일요일 | 앱·API 상태 점검 |
| `yearly-grade-advancement.yml` | 8/15 | 학년 자동 진급 + 부서 전환 |

크론이 쓰는 경로:
`auto-close-checkout` → `/api/update-student` ·
`auto-save-summary` / `weekly-reconciliation` → `/api/weekly-summary` ·
`health-check` → `/api/roster`, `/api/weekly-summary` ·
`sunday-wrapup-reminder` → `/api/weekly-summary` + Notion·Resend 직접 호출 ·
`weekly-liability-reminder`, `yearly-grade-advancement` → Notion·Resend 직접 호출 (API 경유 없음)

부서 경계: 유아부 만 2~4세(Pre-K) · 유치부 K · 유년부 1~2학년 · 초등부 ~5학년 · **중고등부 6학년부터**

## 인증

- 서버: 공유 시크릿 방식. 요청 헤더 `Authorization: Bearer` 또는 `X-API-Key`.
  환경변수 `API_SECRET` 설정 + `API_AUTH_ENFORCE=1` 이면 하드 모드(미인증 401).
- 스태프 페이지: 로그인 → `staff-auth` 가 토큰 발급 → `sessionStorage` 보관 →
  fetch 래퍼가 `/api/*` 요청에 자동 첨부.
- 키오스크 페이지: 로그인이 없으므로 키를 소스에 포함.
  **래퍼 IIFE는 반드시 `<head>` 안, 데이터 로딩 코드보다 먼저** 설치되어야 함
  (뒤에 두면 첫 로드가 401 → 화면이 빈 채로 뜸).
- 학부모 링크(`parent-info`, `liability`): HMAC 서명 토큰.

## 환경변수 (Vercel / Actions Secrets에서 설정 — 값은 레포에 두지 않음)

`NOTION_TOKEN` · `NOTION_DB_*` · `API_SECRET` · `API_AUTH_ENFORCE` ·
`ADMIN_PASSWORD` · `REGISTER_TOKEN_SECRET` · `PARENT_INFO_TOKEN_ENFORCE` · `RESEND_API_KEY`

> ⚠️ **이 레포는 공개 저장소입니다.** 비밀번호·토큰·학생 개인정보는 절대 커밋하지 마세요.

## 개발

```bash
git pull --rebase            # 다른 세션이 커밋했을 수 있음 — 작업 전/푸시 직전 필수
# 수정
node --check api/<file>.js   # JS 구문 확인 (빌드 단계가 없으므로 이게 유일한 사전 검증)
git commit -m "Task #NNN: <summary>"
git push origin main         # = 즉시 프로덕션 배포
```

주일(일요일) 오전~오후 4시 30분 사이에는 운영 중이므로 push 금지.
