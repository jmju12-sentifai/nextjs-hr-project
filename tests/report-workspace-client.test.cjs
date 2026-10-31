require('./register-ts.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {SAMPLE_WAGE_PEAK:schema}=require('../app/admin/builder/lib/sample-wagepeak.ts');
const {reportCalculationKey,reportSavedDoc,validWorkspace}=require('../lib/report-workspace.ts');
const {loadReportWorkspace,queueReportWorkspace,flushReportWorkspace}=require('../lib/report-workspace-client.ts');
const pathId=schema.paths[0].id;
const doc={blocks:[{id:'h',type:'headline',tpl:'{성명} 님의 월 기준액: {최종월기준액}'}]};
const workspace=()=>({format:1,calculation:reportCalculationKey(schema),savedDoc:reportSavedDoc(schema,pathId),docMode:true,proposals:[{id:'screen',name:'요약형',reason:'핵심 결과를 보여줍니다.',excluded:[],doc}],selected:0,chat:{draft:doc,messages:[{role:'assistant',content:'이어 편집하세요.'}],input:'이어서 쓸 말',selectedId:'h',changes:[],panel:'chat',previewKey:'screen'}});
const storage=new Map();global.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
let row=null,revision=0,owner='admin',fail=false,postCount=0;
global.fetch=async(url,options)=>{
 if(options?.method==='POST'){
  postCount++; const input=JSON.parse(options.body);
  if(fail)return new Response(JSON.stringify({error:'저장 실패'}),{status:503});
  assert.equal(input.revision,revision);row=structuredClone(input.workspace);revision++;
  return new Response(JSON.stringify({revision}));
 }
 return new Response(JSON.stringify({workspace:row,revision,userId:owner,savedDoc:reportSavedDoc(schema,pathId)}));
};
test('양식 후보·선택·대화·입력을 저장하고 새 화면에서 복원한다',async()=>{
 await loadReportWorkspace('app',pathId,schema);
 const w=workspace();queueReportWorkspace('app',pathId,w);await flushReportWorkspace('app',pathId);
 assert.equal(postCount,1);assert.deepEqual((await loadReportWorkspace('app',pathId,schema)).workspace,w);
});
test('빠른 연속 변경은 최종 내용을 순서대로 저장한다',async()=>{
 const first=workspace();first.chat.input='첫 입력';queueReportWorkspace('app',pathId,first);
 const final=workspace();final.chat.input='마지막 입력';queueReportWorkspace('app',pathId,final);
 await flushReportWorkspace('app',pathId);assert.equal(row.chat.input,'마지막 입력');
});
test('서버 오류를 성공으로 숨기지 않고 미전송 기록을 남겨 재시도한다',async()=>{
 fail=true;const w=workspace();w.chat.input='실패해도 남길 입력';queueReportWorkspace('app',pathId,w);
 await assert.rejects(flushReportWorkspace('app',pathId));
 assert.equal(JSON.parse(storage.get(`hrcoach:report-workspace:app:${pathId}`)).pending,true);
 fail=false;await flushReportWorkspace('app',pathId);assert.equal(row.chat.input,w.chat.input);
});
test('다른 로그인 사용자의 로컬 미전송 기록은 복원하지 않는다',async()=>{
 row=null;revision=0;owner='another-admin';
 storage.set(`hrcoach:report-workspace:other:${pathId}`,JSON.stringify({userId:'admin',revision:0,pending:true,workspace:workspace()}));
 assert.equal((await loadReportWorkspace('other',pathId,schema)).workspace,null);
});
test('문서 선택은 계산 식별자를 바꾸지 않고 참조가 깨진 작업은 거절한다',()=>{
 assert.equal(reportCalculationKey({...schema,paths:schema.paths.map(p=>({...p,doc}))}),reportCalculationKey(schema));
 assert.equal(validWorkspace(workspace(),schema,pathId),true);
 const invalid=workspace();invalid.proposals[0].doc={blocks:[{id:'bad',type:'facts',items:[{bind:'없는값'}]}]};
 assert.equal(validWorkspace(invalid,schema,pathId),false);
});
