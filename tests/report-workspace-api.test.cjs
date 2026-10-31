require('./register-ts.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {NextRequest,NextResponse}=require('next/server');
const {SAMPLE_WAGE_PEAK:schema}=require('../app/admin/builder/lib/sample-wagepeak.ts');
const {reportCalculationKey,reportSavedDoc}=require('../lib/report-workspace.ts');
const mock=(name,exports)=>{const id=require.resolve(name);require.cache[id]={id,filename:id,loaded:true,exports};};
let auth={user:{id:'admin-a'}},calls=0;const rows=new Map();
mock('@/lib/api-auth',{requireAdmin:async()=>auth});
mock('@/lib/llm-usage',{sanitizeAppId:id=>id});
mock('@/lib/supabase/admin',{createAdminClient:()=>({from:table=>{
 calls++;let filters={},values,mode='get';
 const query={select:()=>query,eq:(k,v)=>{filters[k]=v;return query;},insert:v=>{values=v;mode='insert';return query;},update:v=>{values=v;mode='update';return query;},maybeSingle:async()=>{
  if(table==='apps')return {data:{app_schema:schema}};
  const key=mode==='insert'?`${values.user_id}:${values.path_id}`:`${filters.user_id}:${filters.path_id}`;
  const row=rows.get(key);
  if(mode==='get')return {data:row||null};
  if(mode==='insert'&&row)return {error:{code:'23505'}};
  if(mode==='update'&&row?.revision!==filters.revision)return {data:null};
  rows.set(key,{...row,...values});return {data:{revision:values.revision}};
 }};return query;
}})});
const {GET,POST}=require('../app/api/report-doc/workspace/route.ts');
const pathId=schema.paths[0].id;
const workspace={format:1,calculation:reportCalculationKey(schema),savedDoc:reportSavedDoc(schema,pathId),docMode:true,proposals:[],selected:0};
const get=()=>GET(new NextRequest(`http://localhost/api/report-doc/workspace?appId=app&pathId=${pathId}`));
const post=(revision,w=workspace)=>POST(new NextRequest('http://localhost/api/report-doc/workspace',{method:'POST',body:JSON.stringify({appId:'app',pathId,revision,workspace:w,userId:'forged-user'})}));
test('비관리자는 작업 기록을 읽거나 쓸 수 없다',async()=>{
 auth={error:NextResponse.json({}, {status:403})};assert.equal((await get()).status,403);assert.equal((await post(0)).status,403);assert.equal(calls,0);
 auth={user:{id:'admin-a'}};
});
test('작업 기록은 로그인 관리자별로 격리하고 앱 양식을 변경하지 않는다',async()=>{
 const before=JSON.stringify(schema);assert.equal((await post(0)).status,200);
 assert.deepEqual((await (await get()).json()).workspace,workspace);assert.ok(rows.has(`admin-a:${pathId}`));assert.equal(rows.has(`forged-user:${pathId}`),false);
 auth={user:{id:'admin-b'}};assert.equal((await (await get()).json()).workspace,null);assert.equal(JSON.stringify(schema),before);
 auth={user:{id:'admin-a'}};
});
test('오래된 탭과 저장된 양식이 다른 요청은 최신 작업을 덮어쓰지 않는다',async()=>{
 assert.equal((await post(0,{...workspace,docMode:false})).status,409);assert.equal((await post(1,{...workspace,savedDoc:'changed'})).status,409);
 assert.equal((await post(1,{...workspace,docMode:false})).status,200);assert.equal((await post(1)).status,409);
});
test('새로고침과 겹친 동일 내용 재전송은 충돌로 오인하지 않는다',async()=>{
 assert.equal((await post(1,{...workspace,docMode:false})).status,200);
});
