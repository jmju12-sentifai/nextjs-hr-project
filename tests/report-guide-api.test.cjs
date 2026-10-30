require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest, NextResponse } = require('next/server');
const { DEFAULT_REPORT_GUIDE } = require('app-renderer');
const mock = (name, exports) => { const id=require.resolve(name); require.cache[id]={id,filename:id,loaded:true,exports}; };
let authorized = false;
let writes = 0;
let dbError = null;
let stored;
mock('@/lib/api-auth', { requireAdmin: async () => authorized ? { user: { id:'verified-admin' } } : { error: NextResponse.json({}, {status:403}) } });
mock('@/lib/report-guide', { readReportGuide: async () => ({guide:DEFAULT_REPORT_GUIDE,available:false}) });
mock('@/lib/supabase/admin', { createAdminClient: () => ({from: name => {assert.equal(name,'site_settings');return {upsert: async row => { writes++;stored=row;return {error:dbError}; }};}}) });
const { GET, PUT } = require('../app/api/report-guide/route.ts');
const req = guide => new NextRequest('http://localhost/api/report-guide',{method:'PUT',body:JSON.stringify(guide)});
test('일반 조회는 기본값과 저장 준비 여부를 알려준다', async()=>{
 const response=await GET();assert.equal(response.status,200);assert.equal((await response.json()).available,false);
});
test('비관리자 및 잘못된 설정은 저장하지 않는다', async()=>{
 assert.equal((await PUT(req(DEFAULT_REPORT_GUIDE))).status,403);
 authorized=true;
 assert.equal((await PUT(req({...DEFAULT_REPORT_GUIDE,accent:'#ffffff'}))).status,400);
 assert.equal(writes,0);
});
test('설정 작성자는 인증 정보에서만 가져온다', async()=>{
 assert.equal((await PUT(req(DEFAULT_REPORT_GUIDE))).status,200);
 assert.equal(stored.updated_by,'verified-admin');assert.equal(stored.key,'report_guide');
 assert.deepEqual(stored.value,DEFAULT_REPORT_GUIDE);
});
test('테이블 미적용은 저장 성공으로 표시하지 않는다', async()=>{
 dbError={code:'42P01'};
 const response=await PUT(req(DEFAULT_REPORT_GUIDE));assert.equal(response.status,503);
 assert.match((await response.json()).error,/저장 준비/);
});
