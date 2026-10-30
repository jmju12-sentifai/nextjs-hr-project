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
