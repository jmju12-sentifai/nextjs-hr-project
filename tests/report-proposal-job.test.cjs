require('./register-ts.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {NextRequest,NextResponse}=require('next/server');
const {SAMPLE_WAGE_PEAK:schema}=require('../app/admin/builder/lib/sample-wagepeak.ts');
const {DEFAULT_REPORT_GUIDE}=require('app-renderer');
const {reportCalculationKey,reportSavedDoc}=require('../lib/report-workspace.ts');
const {receiveProposalJob}=require('../lib/report-proposal-job.ts');
const mock=(name,exports)=>{const id=require.resolve(name);require.cache[id]={id,filename:id,loaded:true,exports};};
let auth={user:{id:'admin-a'}},generationCalls=0,finish;
const rows=[];const background=[];
mock('@/lib/api-auth',{requireAdmin:async()=>auth});
mock('@/lib/llm-usage',{sanitizeAppId:id=>typeof id==='string'&&id.length>0?id:null});
mock('@vercel/functions',{waitUntil:p=>background.push(p)});
mock('@/lib/report-proposal-generator',{ProposalError:class extends Error{},generateReportProposals:()=>{generationCalls++;return new Promise(resolve=>{finish=resolve;});}});
mock('@/lib/supabase/admin',{createAdminClient:()=>({from:table=>{
 let filters={},values,mode='read';
 const execute=async()=>{
  if(table==='apps')return {data:{app_schema:schema}};
  const matches=rows.filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v));
  if(mode==='read')return {data:matches[0]||null};
  if(mode==='insert'){
   if(rows.some(r=>r.app_id===values.app_id&&r.user_id===values.user_id&&r.path_id===values.path_id))return {error:{code:'23505'}};
   const row=structuredClone(values);rows.push(row);return {data:structuredClone(row)};
  }
  matches.forEach(r=>Object.assign(r,structuredClone(values)));return {data:matches[0]?structuredClone(matches[0]):null};
 };
 const q={select:()=>q,eq:(k,v)=>{filters[k]=v;return q;},update:v=>{mode='update';values=v;return q;},insert:v=>{mode='insert';values=v;return q;},maybeSingle:execute,then:(a,b)=>execute().then(a,b)};
 return q;
}})});
const {GET,POST,DELETE}=require('../app/api/report-doc/proposal-job/route.ts');
const pathId=schema.paths[0].id;
const request=(path=pathId)=>new NextRequest('http://localhost/api/report-doc/proposal-job',{method:'POST',body:JSON.stringify({appId:'app',pathId:path,schema,userId:'forged'})});
const get=(path=pathId)=>GET(new NextRequest(`http://localhost/api/report-doc/proposal-job?appId=app&pathId=${path}`));
const cancel=id=>DELETE(new NextRequest(`http://localhost/api/report-doc/proposal-job?id=${id}`,{method:'DELETE'}));
const doc={blocks:[{id:'h',type:'headline',tpl:'{성명} 님의 최종 월 기준액은 {최종월기준액}입니다.'}]};
const result={proposals:[{id:'screen',name:'요약형',reason:'핵심 내용',excluded:[],doc}],guide:DEFAULT_REPORT_GUIDE};
test('관리자 인증 전에 생성·조회·취소를 허용하지 않는다',async()=>{
 auth={error:NextResponse.json({}, {status:403})};
 assert.equal((await POST(request())).status,403);assert.equal((await get()).status,403);assert.equal((await cancel('job')).status,403);
 assert.equal(generationCalls,0);auth={user:{id:'admin-a'}};
});
test('생성 완료를 기다리지 않고 접수하며 연결 종료 후에도 결과를 보관한다',async()=>{
 const req=request();const r=await POST(req);assert.equal(r.status,202);
 const initial=(await r.json()).job;assert.equal(initial.status,'running');assert.equal(generationCalls,1);
 assert.equal((await (await get()).json()).job.id,initial.id);
 assert.equal((await POST(request())).status,202);assert.equal(generationCalls,1);
 // 시작 요청/화면과 무관하게 서버 작업을 완료한 뒤 새 조회로 복원한다.
 finish(result);await background.at(-1);
 const restored=(await (await get()).json()).job;assert.equal(restored.status,'completed');assert.deepEqual(restored.result,result);
 assert.equal(rows[0].user_id,'admin-a');assert.equal(schema.paths[0].doc,undefined);
});
test('다른 관리자와 조건에는 작업과 결과가 노출되지 않는다',async()=>{
 auth={user:{id:'admin-b'}};assert.equal((await (await get()).json()).job,null);
 await cancel(rows[0].id);assert.equal(rows[0].status,'completed');
 auth={user:{id:'admin-a'}};assert.equal((await (await get(schema.paths[1].id)).json()).job,null);
});
test('취소 후 재시작하면 이전 실행의 늦은 결과가 새 작업을 덮어쓰지 않는다',async()=>{
 const old=(await (await POST(request())).json()).job;const oldFinish=finish;const oldBackground=background.at(-1);
 await cancel(old.id);assert.equal(rows[0].status,'cancelled');
 const fresh=(await (await POST(request())).json()).job;assert.notEqual(fresh.id,old.id);
 oldFinish(result);await oldBackground;assert.equal(rows[0].id,fresh.id);assert.equal(rows[0].status,'running');
 finish(result);await background.at(-1);assert.equal(rows[0].status,'completed');
});
test('실행이 강제 종료되면 만료 상태를 복원하고 재시작할 수 있다',async()=>{
 await POST(request());const abandonedFinish=finish;const abandonedBackground=background.at(-1);
 rows[0].started_at=new Date(Date.now()-140000).toISOString();
 const timedOut=(await (await get()).json()).job;assert.equal(timedOut.status,'failed');assert.match(timedOut.error,/초과/);
 const fresh=(await (await POST(request())).json()).job;assert.equal(fresh.status,'running');
 abandonedFinish(result);await abandonedBackground;assert.equal(rows[0].status,'running');
 finish(result);await background.at(-1);
});
test('다른 계산의 생성 요청은 실행하지 않는다',async()=>{
 const before=generationCalls;const changed=structuredClone(schema);changed.meta.title='다른 계산';
 const r=await POST(new NextRequest('http://localhost/api/report-doc/proposal-job',{method:'POST',body:JSON.stringify({schema:changed,appId:'app',pathId})}));
 assert.equal(r.status,422);assert.equal(generationCalls,before);
});
test('받은 결과는 한 번만 복원하고 저장 또는 편집 후 다시 나타나지 않는다',()=>{
 const w={format:1,calculation:reportCalculationKey(schema),savedDoc:reportSavedDoc(schema,pathId),docMode:true,proposals:[],selected:0};
 const job={id:'result',status:'completed',calculation:w.calculation,saved_doc:w.savedDoc,result};
 const restored=receiveProposalJob(w,job,schema,pathId);assert.equal(restored.proposals.length,1);
 const edited={...restored,proposals:[],chat:{input:'이어서 작업'}};
 assert.equal(receiveProposalJob(edited,job,schema,pathId),edited);
 assert.equal(receiveProposalJob({...w,savedDoc:'new'},job,schema,pathId).proposals.length,0);
 assert.equal(receiveProposalJob({...w,calculation:'new'},job,schema,pathId).proposals.length,0);
});
