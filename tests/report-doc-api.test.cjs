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
let failAtCall = -1;
mock('@/lib/api-auth', { requireAdmin: async () => auth });
mock('@/lib/report-guide', { readReportGuide: async () => ({ guide: DEFAULT_REPORT_GUIDE, available: false }) });
mock('@/lib/llm-usage', {
  sanitizeAppId: () => null,
  withUsage: async (ctx, fn) => { assert.equal(ctx.operation, 'doc_propose'); assert.equal(ctx.isAdmin, true); return fn(); },
  trackedGenerate: async () => { calls++; if (generationError || calls === failAtCall) throw new Error('provider secret'); return { response: { text: () => JSON.stringify(generated) } }; },
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
test('부분 성공을 유지하고 실패한 안은 검증된 기본 양식으로 보완한다', async () => {
  generated = proposals(); generated.proposals = generated.proposals.filter(p => p.id === 'screen');
  let r = await POST(request());
  assert.equal(r.status, 200); const partial = await r.json(); assert.equal(partial.proposals.length, 3); assert.deepEqual(partial.basicIds, ['print', 'review']); assert.equal(partial.proposals.find(p => p.id === 'screen').reason, '요약');
  generated = {};
  r = await POST(request());
  assert.equal(r.status, 200); const recovered = await r.json(); assert.equal(recovered.proposals.length, 3); assert.equal(recovered.basicIds.length, 3);
});
test('연결 오류에서도 기본 양식을 제공하고 내부 정보는 노출하지 않는다', async () => {
  generationError = true;
  const r = await POST(request());
  assert.equal(r.status, 200);
  assert.equal(JSON.stringify(await r.json()).includes('secret'), false);
});

test('AI 응답이 모두 잘못된 미적용 경로도 기본 양식으로 완성한다', async () => {
  generationError = false; generated = { proposals: [
    { id: 'screen', reason: '잘못된 미적용', excluded: [], doc },
    { id: 'print', reason: '빈 문서', excluded: [], doc: { blocks: [] } },
  ] };
  const r = await POST(request({ schema, pathId: 'fallback' }));
  assert.equal(r.status, 200); const data = await r.json();
  assert.equal(data.proposals.length, 3); assert.equal(data.basicIds.length, 3);
  assert.doesNotMatch(JSON.stringify(data.proposals), /최종월기준액/);
});
test('AI 연결 설정이 없어도 검증된 기본 양식을 준비한다', async () => {
  const key = process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY;
  const before = calls; const r = await POST(request({ schema, pathId: 'fallback' }));
  process.env.GEMINI_API_KEY = key;
  assert.equal(r.status, 200); assert.equal((await r.json()).basicIds.length, 3); assert.equal(calls, before);
});

test('보정 중 연결이 끊겨도 앞에서 통과한 AI 양식은 보존한다', async () => {
  generated = proposals(); generated.proposals = generated.proposals.filter(p => p.id === 'screen');
  failAtCall = calls + 2;
  const r = await POST(request()); failAtCall = -1;
  assert.equal(r.status, 200); const data = await r.json();
  assert.equal(data.proposals.find(p => p.id === 'screen').reason, '요약');
  assert.deepEqual(data.basicIds, ['print', 'review']);
});
