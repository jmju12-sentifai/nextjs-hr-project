require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDoc, validateReportGuide, DEFAULT_REPORT_GUIDE, run } = require('app-renderer');
const { proposalContext, checkProposals } = require('../lib/report-proposals.ts');
const { SAMPLE_WAGE_PEAK: schema } = require('../app/admin/builder/lib/sample-wagepeak.ts');
const { wagePeakNoticeDoc } = require('../app/admin/builder/lib/sample-wagepeak-doc.ts');
const path = schema.paths[0];
const good = () => ({ blocks: [{ id: 'result', type: 'headline', tpl: '최종 금액은 {최종월기준액}입니다.' }] });
const rejects = (doc, code, options = {}) => assert.ok(validateDoc(schema, path.id, doc, options).errors.some(e => e.code === code));

test('승인된 견본과 계산 참조를 통과시킨다', () => {
  const doc = wagePeakNoticeDoc(path);
  assert.deepEqual(validateDoc(schema, path.id, doc, { previous: doc, guide: DEFAULT_REPORT_GUIDE }).errors, []);
  assert.ok(validateDoc(schema, path.id, good()).ok);
});
test('실제 값 대신 지어낸 이름, 다른 경로 값, AI 요약 참조를 거절한다', () => {
  rejects({ blocks: [{ id: 'x', type: 'facts', items: [{ bind: '없는금액' }] }] }, 'reference');
  const changed = structuredClone(schema);
  changed.paths[1].steps.push({ id: 'foreign', name: '타경로전용', type: 'formula', tokens: [] });
  changed.paths[0].steps.push({ id: 'llm', name: 'AI요약', type: 'llm', items: [] });
  for (const name of ['타경로전용', 'AI요약']) assert.equal(validateDoc(changed, path.id, { blocks: [{ id: 'x', type: 'text', tpl: `{${name}}` }] }).ok, false);
});
test('형태가 잘못된 JSON은 예외 없이 거절한다', () => {
  for (const doc of [null, [], {}, { blocks: [null] }, { blocks: [{ id: 'x', type: 'kpis', items: [null] }] }, { blocks: [{ id: 'x', type: '__proto__' }] }])
    assert.equal(validateDoc(schema, path.id, doc).ok, false);
});
test('숫자 하드코딩과 잠금 우회, 단위 변경을 막는다', () => {
  rejects({ blocks: [{ id: 'x', type: 'text', tpl: '감액 20%' }] }, 'literal_number');
  rejects({ blocks: [{ id: 'x', type: 'text', tpl: '감액 ２０%', locked: true }] }, 'locked', { proposal: true });
  rejects({ ...good(), units: { 최종월기준액: '만원' } }, 'unit');
  rejects({ blocks: [{ id: 'x', type: 'text', tpl: '{최종월기준액}원입니다.' }] }, 'duplicate_unit');
});
test('산식 타입, 중복 ID, 필수 표현과 금지 표현을 검증한다', () => {
  rejects({ blocks: [{ id: 'x', type: 'formula', bind: '성명' }] }, 'step_type');
  rejects({ blocks: [...good().blocks, ...good().blocks] }, 'duplicate');
  rejects(good(), 'required', { guide: { required: ['formula'], banned: [] } });
  rejects(good(), 'banned', { guide: { required: [], banned: ['최종'] } });
});
test('모든 중첩 참조 및 조건 ID를 검증한다', () => {
  const blocks = [
    { type: 'gauge', items: [{ bind: '감액률', of: '없음' }] },
    { type: 'formula', bind: '적용후월기준액', notes: { 없음: '설명' } },
    { type: 'conditions', labels: { 없음: '설명' } },
    { type: 'range', bind: '만나이', min: '없음', max: '100' },
    { type: 'bar', bind: '최종월기준액', marks: [{ bind: '없음' }] },
    { type: 'timeline', points: [{ bind: '없음' }] },
    { type: 'flow', steps: [{ bind: '없음' }] },
    { type: 'counts', items: [{ bind: '연차부여' }], total: '없음' },
  ];
  for (const block of blocks) rejects({ blocks: [{ id: 'x', ...block }] }, 'reference');
});
test('이전 잠금 블록의 삭제와 변경을 거절한다', () => {
  const previous = { blocks: [{ id: 'official', type: 'text', locked: true, tpl: '14일 이내에 문의해 주세요.' }] };
  rejects(good(), 'locked', { previous });
  rejects({ blocks: [{ ...previous.blocks[0], tpl: '다른 문구' }] }, 'locked', { previous });
  assert.equal(validateDoc(schema, path.id, previous, { previous, proposal: true }).ok, true);
});
test('AI 입력에는 개인 테스트값을 보내지 않는다', () => {
  const changed = structuredClone(schema);
  changed.vars[0].test = '개인정보_보내지말것';
  assert.equal(JSON.stringify(proposalContext(changed, path.id, DEFAULT_REPORT_GUIDE)).includes('개인정보_보내지말것'), false);
});
test('잘못된 제안은 제외하고 기존 잠긴 문구는 원본 그대로 보존한다', () => {
  const changed = structuredClone(schema);
  const official = { id: 'official', type: 'text', locked: true, tpl: '14일 이내에 문의해 주세요.' };
  changed.paths[0].doc = { blocks: [official] };
  const result = checkProposals({ proposals: [
    { id: 'screen', reason: '요약', excluded: [], doc: good() },
    { id: 'print', reason: '잘못된 숫자', excluded: [], doc: { blocks: [{ id: 'x', type: 'headline', tpl: '20원' }] } },
  ] }, changed, path.id, DEFAULT_REPORT_GUIDE);
  assert.equal(result.proposals.length, 1);
  assert.deepEqual(result.proposals[0].doc.blocks.at(-1), official);
  assert.equal(result.rejected.length, 2);
});
test('공통 가이드의 색 대비와 허용 필드를 검증한다', () => {
  assert.equal(validateReportGuide(DEFAULT_REPORT_GUIDE), true);
  assert.equal(validateReportGuide({ ...DEFAULT_REPORT_GUIDE, accent: '#ffffff' }), false);
  assert.equal(validateReportGuide({ ...DEFAULT_REPORT_GUIDE, required: ['__proto__'] }), false);
  assert.equal(validateReportGuide({ ...DEFAULT_REPORT_GUIDE, hidden: true }), false);
});
test('선택 경로로 미리보기해도 원본 계산과 기존 그리드는 변경되지 않는다', () => {
  const before = JSON.stringify(schema);
  for (const p of [...schema.paths, schema.fallback]) assert.equal(run(schema, [], [], p.id).activePathId, p.id);
  assert.equal(JSON.stringify(schema), before);
});

test('문서 머리말 참조 오류를 정확히 안내하고 정상 쪽 수는 오류로 보고하지 않는다', () => {
  const doc = { subjects: ['임금피크제 미적용 안내'], blocks: [{id:'result',type:'headline',tpl:'{적용여부}'}] };
  const checked = checkProposals({proposals:[{id:'screen',reason:'요약',excluded:[],doc}]}, schema, 'fallback', DEFAULT_REPORT_GUIDE);
  assert.equal(checked.proposals.length,0);
  assert.match(checked.rejected.find(r=>r.startsWith('요약형:')), /subjects/);
  assert.doesNotMatch(checked.rejected.find(r=>r.startsWith('요약형:')), /쪽으로 구성/);
  const unitsError = validateDoc(schema, 'fallback', {...doc,subjects:[],units:{'임금피크제 미적용':''}});
  assert.match(unitsError.errors[0].message,/units/);
});
