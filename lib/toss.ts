/**
 * 토스페이먼츠 빌링(정기결제) 서버 호출 모음.
 *
 * 빌링 결제는 두 단계다.
 *   1) 카드 등록창에서 받은 authKey 를 billingKey 로 교환한다 (issueBillingKey)
 *   2) 그 billingKey 로 금액을 청구한다 (chargeBilling)
 * 2번은 최초 결제와 매달 갱신이 똑같은 호출이라, 확인 라우트와 갱신 크론이 이 함수를 공유한다.
 *
 * 시크릿 키는 서버에서만 읽는다. 클라이언트 번들에 절대 들어가면 안 된다.
 */

const TOSS_BASE = "https://api.tosspayments.com/v1";

export class TossError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "TossError";
    this.code = code;
    this.status = status;
  }
}

function authHeader(): string {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    throw new TossError(
      "결제 설정 오류 (TOSS_SECRET_KEY 미설정)",
      "CONFIG_MISSING",
      500,
    );
  }
  // 토스는 시크릿 키 뒤에 콜론을 붙인 Basic 인증을 쓴다. 비밀번호 자리는 비운다.
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

async function call<T>(
  path: string,
  body: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: authHeader(),
    "Content-Type": "application/json",
  };
  // 같은 키로 두 번 보내도 한 번만 청구된다. 갱신 크론의 재시도 안전망.
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch(`${TOSS_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    throw new TossError(
      (data as { message?: string })?.message ?? "토스페이먼츠 요청 실패",
      (data as { code?: string })?.code ?? "UNKNOWN",
      res.status,
    );
  }
  return data as T;
}

export type BillingKeyResult = {
  billingKey: string;
  customerKey: string;
  cardCompany?: string;
  cardNumber?: string;
  card?: { company?: string; number?: string };
};

/** 카드 등록창이 돌려준 authKey 를 billingKey 로 교환한다. */
export function issueBillingKey(
  authKey: string,
  customerKey: string,
): Promise<BillingKeyResult> {
  return call<BillingKeyResult>("/billing/authorizations/issue", {
    authKey,
    customerKey,
  });
}

export type TossPayment = {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  approvedAt?: string;
};

/**
 * billingKey 로 실제 금액을 청구한다.
 *
 * orderId 를 멱등키로 그대로 쓴다. 같은 주문번호로 재시도해도 이중 청구되지 않는다.
 */
export function chargeBilling(params: {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
  customerEmail?: string;
}): Promise<TossPayment> {
  const { billingKey, ...body } = params;
  return call<TossPayment>(`/billing/${billingKey}`, body, params.orderId);
}
