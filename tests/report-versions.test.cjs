require('./register-ts.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
let error=null;
const id=require.resolve('@/lib/supabase/admin');
require.cache[id]={id,filename:id,loaded:true,exports:{createAdminClient:()=>({rpc:async()=>({data:error?null:{version:1,status:'draft'},error})})}};
const {saveDraft}=require('../lib/report-versions.ts');
test('서버 버전 저장 결과와 저장소 미설치를 구분한다',async()=>{
  assert.equal((await saveDraft('app','path',{},'수정','admin')).storage,'server');
  error={code:'PGRST202'};const result=await saveDraft('app','path',{},'수정','admin');
  assert.equal(result.storage,'unavailable');assert.equal(result.version,null);
});
test('일반 DB 장애는 로컬 저장 성공으로 숨기지 않는다',async()=>{
  error={code:'08006'};await assert.rejects(saveDraft('app','path',{},'수정','admin'));
});
