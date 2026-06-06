export const metadata = { title: "고객센터" };

const FAQS: { q: string; a: string }[] = [
  {
    q: "앱 세트에는 어떤 것이 포함되나요?",
    a: "인사(HR) 업무에 활용할 수 있는 애플리케이션·도구 및 관련 콘텐츠가 패키지로 제공됩니다. 구성과 이용 방법은 상품 안내 페이지 또는 결제 후 안내를 참고해 주세요.",
  },
  {
    q: "결제는 어떻게 하나요?",
    a: "신용·체크카드 및 계좌이체 등으로 결제하실 수 있으며, 결제 완료 후 앱 세트를 이용하실 수 있습니다. 결제 관련 문제가 있을 경우 위 고객센터로 문의해 주세요.",
  },
  {
    q: "환불은 어떻게 진행되나요?",
    a: "결제일로부터 7일 이내, 앱 세트를 다운로드·실행하거나 이용을 개시하지 않은 경우 전액 환불이 가능합니다. 일부 이용한 경우 이용하지 않은 부분에 한하여 환불됩니다. 자세한 내용은 환불정책 페이지를 참고해 주세요.",
  },
  {
    q: "세금계산서 발행이 가능한가요?",
    a: "네, 사업자 회원의 경우 결제 완료 후 위 이메일로 사업자 정보와 함께 요청해 주시면 세금계산서를 발행해 드립니다.",
  },
  {
    q: "기업·기관 단위 도입이나 다량 라이선스 문의는 어떻게 하나요?",
    a: "기업·기관 단위의 앱 세트 도입, 다량 라이선스 및 견적 문의는 위 이메일로 연락 주시면 담당자가 안내드립니다.",
  },
  {
    q: "이용 중 오류가 발생하거나 사용 방법이 궁금하면 어떻게 하나요?",
    a: "앱 이용 중 오류나 사용 문의는 위 고객센터 전화 또는 이메일로 접수해 주시면 확인 후 안내드립니다.",
  },
];

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <a
        href="/"
        className="mb-6 inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        ← 홈으로
      </a>

      <header className="mb-10">
        <h1 className="mb-3 text-3xl font-bold text-gray-900">고객센터</h1>
        <p className="text-sm leading-relaxed text-gray-600">
          궁금하신 점이 있다면 언제든지 문의해 주세요. 영업일 기준 1~2일
          이내에 답변드립니다.
        </p>
      </header>

      {/* 연락처 카드 */}
      <section className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-blue-600 ring-1 ring-blue-100">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-gray-900">전화</h2>
          </div>
          <p className="text-base font-bold text-gray-900">010-9041-9930</p>
          <p className="mt-1 text-xs text-gray-500">
            평일 10:00 ~ 18:00 (점심 12:30 ~ 13:30)
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-blue-600 ring-1 ring-blue-100">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-gray-900">이메일</h2>
          </div>
          <p className="break-all text-base font-bold text-gray-900">
            besthrcoach@naver.com
          </p>
          <p className="mt-1 text-xs text-gray-500">
            365일 24시간 접수 · 영업일 답변
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-12">
        <h2 className="mb-5 text-xl font-bold text-gray-900">자주 묻는 질문</h2>
        <ul className="space-y-3">
          {FAQS.map((item) => (
            <li
              key={item.q}
              className="rounded-xl border border-gray-200 bg-white p-5"
            >
              <p className="mb-2 flex items-start gap-2 text-sm font-bold text-gray-900">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-600 text-[11px] font-bold text-white">
                  Q
                </span>
                {item.q}
              </p>
              <p className="flex items-start gap-2 text-sm leading-relaxed text-gray-600">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gray-100 text-[11px] font-bold text-gray-600">
                  A
                </span>
                {item.a}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* 제휴·협업 */}
      <section className="mb-12">
        <h2 className="mb-3 text-xl font-bold text-gray-900">제휴·협업 문의</h2>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <p className="mb-3 text-sm text-gray-700">
            앱 세트 도입, 콘텐츠 제휴, 기관 협업 등의 문의는 아래 이메일로
            보내주세요.
          </p>
          <p className="mb-3 text-base font-bold text-gray-900">
            제휴 문의: besthrcoach@naver.com
          </p>
          <p className="text-xs text-gray-500">
            메일 제목에{" "}
            <span className="font-bold text-gray-900">[제휴]</span> 또는{" "}
            <span className="font-bold text-gray-900">[도입문의]</span>를
            표기해 주시면 더 빠르게 회신드립니다.
          </p>
        </div>
      </section>

    </main>
  );
}
