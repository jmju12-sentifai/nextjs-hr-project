require('./register-ts.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {NextRequest,NextResponse}=require('next/server');
const {DEFAULT_REPORT_GUIDE}=require('app-renderer');
const {SAMPLE_WAGE_PEAK:schema}=require('../app/admin/builder/lib/sample-wagepeak.ts');
const mock=(name,exports)=>{const id=require.resolve(name);require.cache[id]={id,filename:id,loaded:true,exports};};
let auth={user:{id:'admin'}}, calls=0, error=null, current=structuredClone(schema);
mock('@/lib/api-auth',{requireAdmin:async()=>auth});
mock('@/lib/report-guide',{readReportGuide:async()=>({guide:DEFAULT_REPORT_GUIDE})});
mock('@/lib/llm-usage',{sanitizeAppId:id=>id});
mock('@/lib/supabase/admin',{createAdminClient:()=>({
  from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{app_schema:current}})})})}),
  rpc:async(name,args)=>{calls++;assert.equal(name,'confirm_report_doc');assert.equal(args.p_actor,'admin');return {error,data:error?null:{version:{status:'confirmed'},schema:current}};}
})});
const {POST}=require('../app/api/report-doc/confirm/route.ts');
const doc={blocks:[{id:'h',type:'headline',tpl:'{성명} 님의 월 기준액은 {최종월기준액}입니다.'}]};
const request=(extra={})=>new NextRequest('http://localhost/api/report-doc/confirm',{method:'POST',body:JSON.stringify({appId:'app',pathId:schema.paths[0].id,schema,savedSchema:schema,doc,...extra})});
test('관리자만 확정할 수 있다',async()=>{auth={error:NextResponse.json({},{status:403})};assert.equal((await POST(request())).status,403);assert.equal(calls,0);auth={user:{id:'admin'}};});
test('다른 작업이 저장한 앱과 저장 전 계산 변경은 덮어쓰지 않는다',async()=>{
  const changed=structuredClone(schema);changed.meta.appName='수정된 앱';
  assert.equal((await POST(request({savedSchema:changed}))).status,409);
  assert.equal((await POST(request({schema:changed}))).status,409);assert.equal(calls,0);
});
test('JSONB 속성 순서 차이는 충돌이 아니며 확정과 버전은 단일 RPC로 저장한다',async()=>{
  current=Object.fromEntries(Object.entries(schema).reverse());
  const r=await POST(request());assert.equal(r.status,200);assert.equal((await r.json()).version.status,'confirmed');assert.equal(calls,1);
});
test('동시 저장 충돌과 SQL 미적용을 성공으로 표시하지 않는다',async()=>{
  error={code:'P0001',message:'SCHEMA_CONFLICT'};assert.equal((await POST(request())).status,409);
  error={code:'PGRST202',message:'missing function'};assert.equal((await POST(request())).status,503);
});
