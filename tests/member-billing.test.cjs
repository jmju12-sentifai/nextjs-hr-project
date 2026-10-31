require("./register-ts.cjs");
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  addMonths,
  endOfKoreanDate,
  grantPreview,
  receiptUrl,
} = require("../lib/members/types.ts");
const {
  processAttempt,
  BillingPending,
  attemptId,
} = require("../lib/members/billing.ts");
const { TossError } = require("../lib/toss.ts");
function fixture(overrides = {}) {
  const a = {
    id: "attempt",
    user_id: "u-1",
    kind: "first",
    plan: "pro",
    amount: 30000,
    months: 1,
    order_id: "hr_attempt",
    state: "processing",
    lease_token: "lease",
    billing_data: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
  const calls = [];
  const payment = {
    status: "DONE",
    orderId: a.order_id,
    totalAmount: a.amount,
    paymentKey: "mock-payment",
  };
  const chain = {
    update(v) {
      calls.push(["save-card", v]);
      return this;
    },
    select() {
      return this;
    },
    eq() {
      return this;
    },
    async single() {
      return { data: { id: a.id, expires_at: "2027-01-31" }, error: null };
    },
  };
  const deps = {
    admin: () => ({
      from: () => chain,
      rpc: async (name, data) => {
        calls.push([name, data]);
        return { data: { nextBillingAt: "2027-01-31" }, error: null };
      },
    }),
    issue: async () => {
      calls.push(["issue"]);
      return { billingKey: "mock-card", customerKey: a.user_id };
    },
    charge: async (p) => {
      calls.push(["charge", p]);
      return payment;
    },
    lookup: async () => {
      calls.push(["lookup"]);
      return null;
    },
  };
  return { a, calls, deps, payment, chain };
}
test("월말·윤년과 한국 시간 종료일을 정확히 계산한다", () => {
  assert.equal(
    addMonths("2027-01-31T12:00:00+09:00", 1),
    "2027-02-28T03:00:00.000Z",
  );
  assert.equal(
    addMonths("2028-01-31T23:00:00+09:00", 1),
    "2028-02-29T14:00:00.000Z",
  );
  assert.equal(endOfKoreanDate("2027-03-15"), "2027-03-15T14:59:59.000Z");
  assert.throws(() => endOfKoreanDate("2027-02-30"));
  const m = {
    subscription_status: "active",
    expires_at: "2027-01-31T12:00:00+09:00",
    auto_renew: true,
  };
  assert.equal(
    grantPreview(m, "1", "", "2026-10-31").endsAt,
    "2027-02-28T03:00:00.000Z",
  );
  assert.equal(
    grantPreview(m, "unlimited", "", "2026-10-31").stopsRenewal,
    true,
  );
  assert.throws(() => grantPreview(m, "bad", "", "2026-10-31"));
  assert.equal(receiptUrl("javascript:alert(1)"), null);
  assert.equal(receiptUrl("https://tosspayments.com.attacker.example/"), null);
  assert.ok(receiptUrl("https://dashboard.tosspayments.com/receipt"));
});
test("카드 키를 저장한 뒤 청구하고 원자적 완료 함수에 저장한다", async () => {
  const f = fixture();
  await processAttempt(f.a, "auth", "qa@example.com", f.deps);
  assert.deepEqual(
    f.calls.map((x) => x[0]),
    ["issue", "save-card", "charge", "finish_billing_attempt"],
  );
  assert.equal(f.calls[2][1].orderId, "hr_attempt");
  assert.equal(f.calls[3][1].p_payment.paymentKey, "mock-payment");
});
test("카드 저장 실패는 청구하지 않는다", async () => {
  const f = fixture();
  f.chain.single = async () => ({ error: { message: "db unavailable" } });
  await assert.rejects(
    () => processAttempt(f.a, "auth", undefined, f.deps),
    TossError,
  );
  assert.equal(f.calls.filter((c) => c[0] === "charge").length, 0);
  assert.equal(f.calls.at(-1)[1].p_definite, true);
});
test("승인 후 DB 저장 실패는 확정 실패로 기록하지 않는다", async () => {
  const f = fixture();
  f.deps.admin = () => ({
    from: () => f.chain,
    rpc: async (name, args) => {
      f.calls.push([name, args]);
      return { error: { message: "unavailable" } };
    },
  });
  await assert.rejects(
    () => processAttempt(f.a, "auth", undefined, f.deps),
    BillingPending,
  );
  assert.equal(f.calls.at(-1)[1].p_definite, false);
});
test("통신 단절 후 주문 조회로 승인을 복구하고 다시 청구하지 않는다", async () => {
  const f = fixture({
    billing_data: { billingKey: "mock", customerKey: "u" },
    created_at: new Date(Date.now() - 120000).toISOString(),
  });
  f.deps.lookup = async () => f.payment;
  await processAttempt(f.a, undefined, undefined, f.deps);
  assert.equal(f.calls.filter((c) => c[0] === "charge").length, 0);
  assert.equal(f.calls.at(-1)[1].p_payment.status, "DONE");
});
test("청구 오류가 발생해도 이미 승인된 주문이면 성공으로 복구한다", async () => {
  const f = fixture();
  f.deps.charge = async () => {
    throw new TossError("already processed", "ALREADY_PROCESSED", 400);
  };
  f.deps.lookup = async () => f.payment;
  await processAttempt(f.a, "auth", undefined, f.deps);
  assert.equal(f.calls.at(-1)[1].p_payment.status, "DONE");
});
test("승인 없음이 확인된 카드 거절은 실패 이력으로 남긴다", async () => {
  const f = fixture();
  f.deps.charge = async () => {
    throw new TossError("카드 승인 거절", "DECLINED", 400);
  };
  await assert.rejects(
    () => processAttempt(f.a, "auth", undefined, f.deps),
    TossError,
  );
  assert.equal(f.calls.at(-1)[1].p_definite, true);
});
test("승인 조회마저 실패하면 재결제 대신 미확정 상태를 유지한다", async () => {
  const f = fixture();
  f.deps.charge = async () => {
    throw new TossError("error", "DECLINED", 400);
  };
  f.deps.lookup = async () => {
    throw new Error("timeout");
  };
  await assert.rejects(
    () => processAttempt(f.a, "auth", undefined, f.deps),
    BillingPending,
  );
  assert.equal(f.calls.at(-1)[1].p_definite, false);
});
test("응답 금액 불일치와 오래된 미확정 주문은 유료 권한을 주지 않는다", async () => {
  const f = fixture();
  f.payment.totalAmount = 1;
  await assert.rejects(
    () => processAttempt(f.a, "auth", undefined, f.deps),
    BillingPending,
  );
  assert.equal(f.calls.at(-1)[1].p_definite, false);
  const old = fixture({
    billing_data: { billingKey: "mock" },
    created_at: new Date(Date.now() - 16 * 86400000).toISOString(),
  });
  await assert.rejects(
    () => processAttempt(old.a, undefined, undefined, old.deps),
    BillingPending,
  );
  assert.equal(old.calls.filter((c) => c[0] === "charge").length, 0);
});
test("완료 요청 재전송은 카드 등록·청구를 반복하지 않는다", async () => {
  const f = fixture({ state: "done", subscription_id: "s" });
  const result = await processAttempt(f.a, undefined, undefined, f.deps);
  assert.equal(result.amount, 30000);
  assert.equal(f.calls.length, 0);
  assert.equal(attemptId("same"), attemptId("same"));
  assert.notEqual(attemptId("same"), attemptId("different"));
});

test('카드 등록 전에 끊긴 작업은 새 청구 없이 해제해 재등록할 수 있다', async () => {
  const server = require('../lib/supabase/admin.ts');
  const toss = require('../lib/toss.ts');
  const {reconcilePending} = require('../lib/members/billing.ts');
  const original = server.createAdminClient, lookup = toss.paymentByOrder;
  const calls=[];
  const row={id:'interrupted',plan:'pro',kind:'first',subscription_id:null,created_at:new Date().toISOString(),lease_until:null,billing_data:null};
  const query={select(){return this;},eq(){return this;},in(){return this;},async maybeSingle(){return {data:row,error:null};}};
  server.createAdminClient=()=>({from:()=>query,rpc:async(name,args)=>{calls.push([name,args]);return {data:{...row,state:'processing',lease_token:'new-lease'},error:null};}});
  toss.paymentByOrder=async()=>{throw new Error('uncharged registration must not query or charge');};
  try{await reconcilePending('qa-user');assert.deepEqual(calls.map(c=>c[0]),['claim_billing_attempt','finish_billing_attempt']);assert.equal(calls[1][1].p_definite,true);assert.equal(calls[1][1].p_payment,null);}finally{server.createAdminClient=original;toss.paymentByOrder=lookup;}
});
