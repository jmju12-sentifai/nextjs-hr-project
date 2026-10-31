import {
  MEMBER_STATES,
  MemberState,
  PaymentRecord,
  formatMemberDate,
  receiptUrl,
} from "@/lib/members/types";
export const button =
  "inline-flex shrink-0 whitespace-nowrap items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
export const primary =
  button + " !border-blue-700 !bg-blue-700 !text-white hover:!bg-blue-800";
export const input =
  "min-w-0 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600";
export const panel = "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6";
export function Badge({ state }: { state: MemberState }) {
  const color = {
    paid: "bg-blue-50 text-blue-800",
    free: "bg-emerald-50 text-emerald-800",
    canceling: "bg-amber-50 text-amber-900",
    failed: "bg-red-50 text-red-800",
    none: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${color[state]}`}
    >
      {MEMBER_STATES[state]}
    </span>
  );
}
export function Pagination({
  page,
  total,
  size = 10,
  onChange,
}: {
  page: number;
  total: number;
  size?: number;
  onChange: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="mt-4 flex items-center justify-end gap-3 text-sm text-slate-600">
      <span>
        총 {total.toLocaleString()}건 · {page}/{pages}
      </span>
      <button
        className={button}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        이전
      </button>
      <button
        className={button}
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        다음
      </button>
    </div>
  );
}
export function PaymentHistory({ payments }: { payments: PaymentRecord[] }) {
  return payments.length ? (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b text-slate-500">
          <tr>
            {["결제일", "구분", "금액", "상태", "주문번호", "영수증"].map(
              (t) => (
                <th key={t} className="whitespace-nowrap py-3 pr-4 font-medium">
                  {t}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-b border-slate-100">
              <td className="whitespace-nowrap py-4 pr-4">
                {formatMemberDate(p.created_at)}
              </td>
              <td className="whitespace-nowrap pr-4">
                {{ first: "첫 결제", renew: "정기결제", legacy: "기존 결제" }[
                  p.kind
                ] || p.kind}
              </td>
              <td className="whitespace-nowrap pr-4 font-semibold">
                {p.amount.toLocaleString()}원
              </td>
              <td className="min-w-24 pr-4">
                <span
                  className={
                    p.status === "done" ? "text-emerald-700" : "text-red-700"
                  }
                >
                  {p.status === "done" ? "승인" : "실패"}
                </span>
                {p.error && (
                  <p className="mt-1 max-w-60 text-xs text-slate-500">
                    {p.error}
                  </p>
                )}
              </td>
              <td className="max-w-64 break-all pr-4 text-xs text-slate-500">
                {p.order_id}
              </td>
              <td>
                {receiptUrl(p.receipt_url) ? (
                  <a
                    className="whitespace-nowrap text-blue-700 underline"
                    href={receiptUrl(p.receipt_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    보기 ↗
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="py-6 text-sm text-slate-500">결제 이력이 없습니다.</p>
  );
}
