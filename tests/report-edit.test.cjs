require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stableJson, DEFAULT_REPORT_GUIDE } = require('app-renderer');
const { SAMPLE_WAGE_PEAK: schema } = require('../app/admin/builder/lib/sample-wagepeak.ts');
const { applyEditResult, diffDocs } = require('../lib/report-edit.ts');
const pathId = schema.paths[0].id;
const doc = { title: '월 급여 안내', blocks: [
  { id: 'h', type: 'headline', tpl: '{성명} 님의 최종 월 기준액은 {최종월기준액}입니다.' },
  { id: 'f', type: 'facts', items: [{ bind: '성명' }] },
  { id: 't', type: 'text', tpl: '문의는 담당 부서에 연락해 주세요.', locked: true },
] };
const edit = (candidate, selected) => applyEditResult(schema, pathId, doc, candidate, DEFAULT_REPORT_GUIDE, selected);
test('JSONB 속성 순서와 선택적 undefined 필드를 같게 비교한다', () => {
  assert.equal(stableJson({b:[{x:1}],a:2}), stableJson({a:2,b:[{x:1}],c:undefined}));
  assert.deepEqual(JSON.parse(stableJson(doc)), doc);
});
test('선택 블록 외 모델 변경을 원복하고 실제 변경만 기록한다', () => {
  const next = structuredClone(doc); next.title = '무시할 제목'; next.blocks[0].tpl = '{성명} 님의 월 기준액: {최종월기준액}'; next.blocks[1].items = [{bind:'없는값'}];
  const result = edit(next, 'h');
  assert.equal(result.ok, true); assert.equal(result.doc.title, doc.title);
  assert.deepEqual(result.doc.blocks.slice(1), doc.blocks.slice(1));
  assert.deepEqual(result.changes.map(c => c.blockId), ['h']);
});
test('선택 블록 삭제, 잠긴 문구 변경, 금액 하드코딩, 단위 변경은 거절한다', () => {
  let next = structuredClone(doc); next.blocks.shift(); assert.equal(edit(next, 'h').ok, false);
  next = structuredClone(doc); next.blocks[2].tpl = '새 규정'; assert.equal(edit(next).ok, false);
  next = structuredClone(doc); next.blocks[0].tpl = '월 기준액은 600만원입니다.'; assert.equal(edit(next).ok, false);
  next = structuredClone(doc); next.units = {만나이:'세'}; assert.equal(edit(next).ok, false);
});
test('앞 블록 삭제를 나머지 블록 이동으로 오인하지 않는다', () => {
  const next = { ...doc, blocks: doc.blocks.slice(1) };
  assert.deepEqual(diffDocs(doc,next).map(c => [c.op,c.blockId]), [['remove','h']]);
  assert.equal(diffDocs(doc,{...doc, blocks:[doc.blocks[1],doc.blocks[0],doc.blocks[2]]}).filter(c => c.op === 'move').length,2);
});
