require('./register-ts.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const {withWorkingDoc} = require('../lib/report-workspace.ts');
const original = {blocks:[{id:'a',type:'text',tpl:'기존 문구'}]};
const draft = {blocks:[{id:'a',type:'text',tpl:'관리자가 잠근 문구',locked:true}]};
const schema = {meta:{name:'검증'},vars:[],paths:[{id:'first',doc:original},{id:'second',doc:original}],fallback:{id:'fallback',doc:original}};
test('새 양식 제안은 저장 전 초안의 잠금을 전달하며 원본 앱과 다른 조건은 보존한다',()=>{
 const next=withWorkingDoc(schema,'first',draft);
 assert.deepEqual(next.paths[0].doc,draft);
 assert.equal(next.paths[1],schema.paths[1]);assert.equal(next.fallback,schema.fallback);
 assert.equal(next.vars,schema.vars);assert.equal(schema.paths[0].doc,original);
});
test('미적용 조건의 초안도 다른 경로를 건드리지 않고 전달한다',()=>{
 const next=withWorkingDoc(schema,'fallback',draft);
 assert.deepEqual(next.fallback.doc,draft);assert.equal(next.paths[0],schema.paths[0]);
 assert.equal(schema.fallback.doc,original);
});
test('아직 문서가 없는 첫 제안은 기존 계산 구성을 그대로 쓴다',()=>{
 assert.equal(withWorkingDoc(schema,'first'),schema);
});
