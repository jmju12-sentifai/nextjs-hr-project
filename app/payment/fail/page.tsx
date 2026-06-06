type SearchParams = { message?: string; code?: string };

export default async function PaymentFailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { message, code } = searchParams;
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">결제에 실패했습니다</h1>
      <p className="mb-2 text-sm text-gray-600">
        {message ?? "결제가 정상적으로 처리되지 않았습니다."}
      </p>
      {code && <p className="mb-6 text-xs text-gray-400">코드: {code}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <a
          href="/payment"
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          다시 시도
        </a>
        <a
          href="/"
          className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          홈으로
        </a>
      </div>
    </main>
  );
}
