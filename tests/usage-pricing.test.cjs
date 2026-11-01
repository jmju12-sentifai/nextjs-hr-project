require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { usageCostUsd, usageFx, DEFAULT_USAGE_FX } = require('../lib/usage-pricing.ts');
const row = (model, prompt = 1e6, output = 1e6, cached = 0) => ({ model, prompt_tokens: prompt, output_tokens: output, cached_tokens: cached });

test('서로 다른 모델의 같은 토큰 수에 각 공식 단가를 적용한다', () => {
  assert.equal(usageCostUsd(row('gemini-2.5-flash')), 2.8);
  assert.equal(usageCostUsd(row('gemini-3.5-flash')), 10.5);
  assert.equal(usageCostUsd(row('models/gemini-2.5-flash')), 2.8);
  assert.equal(usageCostUsd(row('gemini-2.5-flash')) + usageCostUsd(row('gemini-3.5-flash')), 13.3);
});
test('캐시 입력을 일반 입력에 중복 과금하지 않는다', () => {
  assert.equal(usageCostUsd(row('gemini-2.5-flash', 1e6, 0, 5e5)), 0.165);
  assert.equal(usageCostUsd(row('gemini-3.5-flash', 1e6, 0, 2e6)), 0.15);
});
test('미등록 모델의 사용 비용은 미확인, 사용량 없는 실패는 0으로 구분한다', () => {
  assert.equal(usageCostUsd(row('unknown')), null);
  assert.equal(usageCostUsd(row('constructor')), null);
  assert.equal(usageCostUsd(row('unknown', 0, 0)), 0);
});
test('비어 있거나 손상된 저장 환율은 기본값으로 복원한다', () => {
  for (const value of [undefined, null, 0, -100, NaN, Infinity, '']) assert.equal(usageFx(value), DEFAULT_USAGE_FX);
  assert.equal(usageFx(1450), 1450);
});
