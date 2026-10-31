require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest, NextResponse } = require('next/server');
const { DEFAULT_REPORT_GUIDE } = require('app-renderer');
const { SAMPLE_WAGE_PEAK: schema } = require('../app/admin/builder/lib/sample-wagepeak.ts');
const mock = (name, exports) => { const id = require.resolve(name); require.cache[id] = {id,filename:id,loaded:true,exports}; };
let auth = { user: { id:'admin' } }, intent='data', calls=0, saves=0, generated;
mock('@/lib/api-auth', {requireAdmin:async()=>auth});
mock('@/lib/report-guide', {readReportGuide:async()=>({guide:DEFAULT_REPORT_GUIDE})});
mock('@/lib/supabase/admin', {createAdminClient:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'app'}})})})})})});
mock('@/lib/report-versions', {saveDraft:async()=>{saves++;return {storage:'server',version:{version:saves}};}});
mock('@/lib/llm-usage', {sanitizeAppId:id=>id,withUsage:async(ctx,fn)=>fn(),trackedGenerate:async model=>{calls++; return {response:{text:()=>JSON.stringify(model.classifier?{intent}:generated)}};}});
mock('@google/generative-ai', {GoogleGenerativeAI:class {getGenerativeModel(config){return {classifier:config.generationConfig.maxOutputTokens===500};}}});
const {POST}=require('../app/api/report-doc/edit/route.ts');
process.env.GEMINI_API_KEY='test-only';
const doc={blocks:[{id:'h',type:'headline',tpl:'{성명} 님의 월 기준액은 {최종월기준액}입니다.'},{id:'l',type:'text',tpl:'담당 부서에 문의해 주세요.',locked:true}]};
const request=(extra={})=>new NextRequest('http://localhost/api/report-doc/edit',{method:'POST',body:JSON.stringify({appId:'app',schema,pathId:schema.paths[0].id,doc,message:'수정 요청',...extra})});
test('비관리자는 수정 모델이나 DB에 접근하지 않는다',async()=>{
  for(const status of [401,403]) {auth={error:NextResponse.json({}, {status})};assert.equal((await POST(request())).status,status);}
  assert.equal(calls,0);auth={user:{id:'admin'}};
});
test('잠긴 블록 선택은 분류 모델 호출 전 거절한다',async()=>{
  const r=await (await POST(request({selectedBlockId:'l'}))).json();assert.equal(r.kind,'refuse');assert.equal(calls,0);
});
test('금액 변경 요청은 분류만 하고 수정 모델과 저장을 호출하지 않는다',async()=>{
  intent='data';const r=await (await POST(request())).json();assert.equal(r.kind,'refuse');assert.equal(calls,1);assert.equal(saves,0);
});
test('허용 요청도 검증을 통과한 문서만 버전으로 저장한다',async()=>{
  intent='wording';generated={doc:structuredClone(doc)};generated.doc.blocks[0].tpl='{성명} 님의 월 기준액: {최종월기준액}';
  const r=await (await POST(request())).json();assert.equal(r.kind,'edit');assert.equal(saves,1);assert.equal(r.changes[0].blockId,'h');
  generated={doc:structuredClone(doc)};generated.doc.blocks[1].tpl='규정 변경';
  const invalid=await (await POST(request())).json();assert.equal(invalid.kind,'refuse');assert.equal(saves,1);
});

const kpiDoc = {blocks:[...doc.blocks,{id:'k',type:'kpis',title:'핵심 산출 수치',items:[{bind:'최종월기준액'},{bind:'감액률',label:'적용 감액률'}]}]};
const suggestion = {label:'가로 막대 적용',description:'적용 감액률을 가로 막대로 표시합니다.',blockId:'k',block:{...kpiDoc.blocks[2],items:[{bind:'최종월기준액'},{bind:'감액률',label:'적용 감액률',display:'bar'}]}};
test('추천좀을 style로 오분류해도 상담만 하고 문서와 버전을 저장하지 않는다',async()=>{
  intent='style'; generated={reply:'가로 막대 또는 숫자만 표시할 수 있습니다. 아직 수정하지 않았습니다.',suggestions:[suggestion]};
  const before=saves;
  const r=await (await POST(request({doc:kpiDoc,message:'적용 감액률에 도넛 말고 다른거 추천좀'}))).json();
  assert.equal(r.kind,'advice');assert.equal(saves,before);assert.equal(r.doc,undefined);assert.equal(r.suggestions.length,1);
  assert.equal(r.suggestions[0].block.items[1].display,'bar');
});
test('질문 분류는 추천 키워드 없는 질문도 상담하고 저장하지 않는다',async()=>{
  intent='advice'; generated={reply:'비율을 원형으로 보여주는 표현입니다.',suggestions:[]};
  const before=saves;const r=await (await POST(request({message:'이 동그라미 의미가 뭐야'}))).json();
  assert.equal(r.kind,'advice');assert.equal(saves,before);
});
test('선택한 제안은 AI 재생성 없이 정확히 해당 카드만 반영한다',async()=>{
  const before=calls;
  const r=await (await POST(request({doc:kpiDoc,message:suggestion.label,suggestion,suggestionSourceBlock:kpiDoc.blocks[2]}))).json();
  assert.equal(r.kind,'edit');assert.equal(calls,before);assert.deepEqual(r.doc.blocks.slice(0,2),doc.blocks);
  assert.deepEqual(r.doc.blocks[2],suggestion.block);assert.deepEqual(r.changes.map(c=>c.blockId),['k']);
});
test('낡은 제안과 데이터 참조 변경 제안은 저장하지 않는다',async()=>{
  const before=saves;
  const stale=await POST(request({doc:kpiDoc,message:suggestion.label,suggestion,suggestionSourceBlock:{...kpiDoc.blocks[2],title:'옛 제목'}}));
  assert.equal(stale.status,409);
  const changed=structuredClone(suggestion);changed.block.items[1].bind='통상임금기준액';
  const r=await (await POST(request({doc:kpiDoc,message:changed.label,suggestion:changed,suggestionSourceBlock:kpiDoc.blocks[2]}))).json();
  assert.equal(r.kind,'refuse');assert.equal(saves,before);
});
test('추천을 포함해도 금액·계산 변경 요청은 차단한다',async()=>{
  intent='data';const before=saves;const r=await (await POST(request({message:'금액을 올리는 방법 추천해줘'}))).json();
  assert.equal(r.kind,'refuse');assert.equal(saves,before);
});
