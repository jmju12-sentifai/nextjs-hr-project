require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest, NextResponse } = require('next/server');
const { DEFAULT_REPORT_GUIDE } = require('app-renderer');
const { SAMPLE_WAGE_PEAK: schema } = require('../app/admin/builder/lib/sample-wagepeak.ts');
const mock = (name, exports) => { const id = require.resolve(name); require.cache[id] = { id, filename: id, loaded: true, exports }; };
let auth = { user: { id: 'admin', email: 'admin@example.invalid' } };
let generated;
let calls = 0;
let generationError = false;
mock('@/lib/api-auth', { requireAdmin: async () => auth });
mock('@/lib/report-guide', { readReportGuide: async () => ({ guide: DEFAULT_REPORT_GUIDE, available: false }) });
mock('@/lib/llm-usage', {
  sanitizeAppId: () => null,
  withUsage: async (ctx, fn) => { assert.equal(ctx.operation, 'doc_propose'); assert.equal(ctx.isAdmin, true); return fn(); },
  trackedGenerate: async () => { calls++; if (generationError) throw new Error('provider secret'); return { response: { text: () => JSON.stringify(generated) } }; },
});
mock('@google/generative-ai', { GoogleGenerativeAI: class { getGenerativeModel() { return {}; } } });
const { POST } = require('../app/api/report-doc/propose/route.ts');
process.env.GEMINI_API_KEY = 'test-only';
const request = (body = { schema, pathId: schema.paths[0].id }) => new NextRequest('http://localhost/api/report-doc/propose', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const doc = { blocks: [{ id: 'h', type: 'headline', tpl: '{성명} 님의 최종 월 기준액은 {최종월기준액}입니다.' }] };
function proposals() { return { proposals: [
  { id: 'print', reason: '전달', excluded: [], doc: { blocks: [...doc.blocks, { id: 'p', type: 'pagebreak' }, { id: 'f', type: 'facts', items: [{ bind: '성명' }] }] } },
  { id: 'screen', reason: '요약', excluded: [], doc },
  { id: 'review', reason: '검토', excluded: [], doc: { blocks: [...doc.blocks, { id: 'c', type: 'conditions' }] } },
] }; }

test('미로그인과 비관리자는 AI를 호출하기 전에 차단한다', async () => {
  for (const status of [401, 403]) {
    auth = { error: NextResponse.json({ error: '접근 불가' }, { status }) };
    assert.equal((await POST(request())).status, status);
  }
  assert.equal(calls, 0);
  auth = { user: { id: 'admin' } };
});
test('잘못된 요청과 너무 큰 요청은 AI를 호출하지 않는다', async () => {
  for (const body of ['{', {}, { schema, pathId: '없는경로' }, { schema, pathId: schema.paths[0].id, purpose: 'unknown' }]) assert.equal((await POST(request(body))).status, 400);
  assert.equal((await POST(request(' '.repeat(250001)))).status, 413);
  assert.equal(calls, 0);
});
test('관리자에게 검증된 세 안과 기본 가이드를 제공한다', async () => {
  generated = proposals();
  const r = await POST(request());
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.proposals.length, 3);
  assert.equal(data.available, false);
  assert.equal(calls, 1);
});
test('부분 성공은 검증된 안만 반환하고 완전 실패는 안내한다', async () => {
  generated = proposals(); generated.proposals = generated.proposals.filter(p => p.id === 'screen');
  let r = await POST(request());
  assert.equal(r.status, 200); assert.equal((await r.json()).proposals.length, 1);
  generated = {};
  r = await POST(request());
  assert.equal(r.status, 422);
});
test('연결 오류의 내부 정보는 클라이언트에 노출하지 않는다', async () => {
  generationError = true;
  const r = await POST(request());
  assert.equal(r.status, 502);
  assert.equal(JSON.stringify(await r.json()).includes('secret'), false);
});
