#!/usr/bin/env bash
#
# 결제경로 캡처 도우미.
#
# 가이드(4p) 요건:
#   - 북마크바 없이 도메인이 보이도록 캡처
#   - PC 시계가 함께 보이도록 캡처  → 전체 화면을 찍는다 (macOS 메뉴바 시계 포함)
#
# 정적 페이지(하단정보·환불정책·로그인·요금)는 자동으로 열고 찍는다.
# 로그인·카드등록처럼 사람이 조작해야 하는 단계는 안내 후 대기한다.
#
# 사용법:
#     bash scripts/capture_payment_path.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/captures"
BASE="${BASE_URL:-https://hrcoach.co.kr}"

mkdir -p "$OUT"

open_url() {
  osascript >/dev/null <<OSA
tell application "Google Chrome"
  activate
  if (count of windows) = 0 then make new window
  set URL of active tab of front window to "$1"
end tell
OSA
  # 렌더링·폰트 로딩 여유
  sleep 4
}

shoot() {
  local name="$1"
  # -x : 셔터음 없음 / 전체 화면이라 메뉴바 시계와 주소창이 함께 들어간다
  screencapture -x "$OUT/$name.png"
  echo "  ✓ $name.png"
}

pause_for() {
  echo
  echo "──────────────────────────────────────────────────────────"
  echo "  $1"
  echo "──────────────────────────────────────────────────────────"
  read -r -p "  준비되면 Enter 를 누르세요... " _
}

echo "결제경로 캡처를 시작합니다. 대상: $BASE"
echo
echo "시작 전 확인해 주세요:"
echo "  1) Chrome 북마크바 숨김  (⌘⇧B)"
echo "  2) 알림·다른 창 정리 — 전체 화면이 찍힙니다"
echo "  3) 캡처 도중 화면을 조작하지 마세요"
pause_for "위 3가지가 준비되었나요?"

echo
echo "[② 하단 사업자정보]"
open_url "$BASE/"
pause_for "페이지 맨 아래로 스크롤해 사업자정보가 보이게 해주세요."
shoot "02-footer"

echo
echo "[③ 환불규정]"
open_url "$BASE/legal/refund"
shoot "03-refund-1"
pause_for "정기결제 해지·환불 조항(제3조의2)이 보이도록 스크롤해주세요."
shoot "03-refund-2"

echo
echo "[④ 로그인 / 회원가입]"
open_url "$BASE/login"
shoot "04-login-1"
open_url "$BASE/signup"
shoot "04-login-2"

echo
echo "[⑤ 상품선택 / 구매과정]"
open_url "$BASE/pricing"
shoot "05-purchase-1"
pause_for "판매 및 이용 정책 항목이 보이도록 스크롤해주세요."
shoot "05-purchase-2"

pause_for "테스트 계정으로 로그인한 뒤, 요금 페이지에서 '구독 시작하기' 를 눌러 결제 페이지로 이동해주세요."
shoot "05-purchase-3"

echo
echo "[⑥ 카드 결제경로 — 빌링 카드등록창]"
pause_for "결제 조건에 동의 체크 후 '카드 등록하고 결제하기' 를 눌러 카드 입력창을 띄워주세요."
shoot "06-billing-1"
pause_for "카드 정보를 입력한 다음 화면(본인인증 등)으로 넘어가면 알려주세요."
shoot "06-billing-2"
pause_for "결제 완료 화면이 뜨면 알려주세요."
shoot "06-billing-3"

echo
echo "완료. 캡처 위치: $OUT"
ls -1 "$OUT"
echo
echo "다음: python3 scripts/build_payment_path_ppt.py"
