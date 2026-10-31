require('./register-ts.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {reportAIJson,reportFailure,reportFailureResponse}=require('../lib/report-ai.ts');
test('시간 예산이 소진되면 AI 호출과 재시도를 시작하지 않는다',async()=>{
 let called=false;
 await assert.rejects(reportAIJson({stage:'edit',requestId:'test',deadline:Date.now()-1,timeoutMs:30000,model:()=>{called=true;},prompt:'',parse:r=>r}),e=>e.code==='AI_TIMEOUT'&&e.stage==='edit');
 assert.equal(called,false);
});
test('단계별 오류는 외부 오류 원문을 노출하지 않고 복구 안내를 제공한다',()=>{
 for(const [error,stage,code,status,pattern] of [
  [new Error('fetch failed private-api-key'),'edit','AI_CONNECTION',503,/연결하지 못/],
  [Object.assign(new Error('provider private'),{status:503}),'advice','AI_UNAVAILABLE',503,/일시적/],
  [new SyntaxError('private response'),'advice','AI_INVALID_RESPONSE',502,/추천 내용을/],
  [new Error('private database error'),'load','DOCUMENT_LOAD_FAILED',503,/앱 정보/],
  [new Error('private database error'),'save','DRAFT_SAVE_FAILED',503,/작업 기록/],
 ]){const failure=reportFailure(error,stage),response=reportFailureResponse(failure);assert.equal(failure.code,code);assert.equal(response.status,status);assert.match(response.message,pattern);assert.doesNotMatch(response.message,/private/);}
});
