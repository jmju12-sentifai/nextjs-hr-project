require('./register-ts.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {DEFAULT_REPORT_GUIDE,validateDoc,docPages,run}=require('app-renderer');
const {SAMPLE_WAGE_PEAK:schema}=require('../app/admin/builder/lib/sample-wagepeak.ts');
const {basicReportProposals}=require('../lib/report-proposal-fallback.ts');
const {proposalContext}=require('../lib/report-proposals.ts');
test('미적용 조건에서도 없는 산식·조건·타 경로 값을 만들지 않고 세 양식을 제공한다',()=>{
 const before=JSON.stringify(schema);const result=basicReportProposals(schema,'fallback',DEFAULT_REPORT_GUIDE);
 assert.equal(result.proposals.length,3,result.rejected.join('\n'));
 for(const p of result.proposals){assert.ok(validateDoc(schema,'fallback',p.doc,{guide:DEFAULT_REPORT_GUIDE,proposal:true}).ok);const json=JSON.stringify(p.doc);assert.doesNotMatch(json,/최종월기준액|감액률|평가점수|연차사용|LLM분석/);assert.ok(!p.doc.blocks.some(b=>['conditions','formula','bandtable','itemized'].includes(b.type)));assert.match(p.reason,/기본/);}
 assert.equal(docPages(result.proposals.find(p=>p.id==='print').doc).length,2);
 assert.equal(docPages(result.proposals.find(p=>p.id==='screen').doc).length,1);
 assert.equal(JSON.stringify(schema),before);
});
test('적용 경로의 기본 안은 실제 산식과 산정표·구간표를 포함하고 계산을 유지한다',()=>{
 for(const path of schema.paths){const before=run(schema,[],[],path.id);const result=basicReportProposals(schema,path.id,DEFAULT_REPORT_GUIDE);
 assert.equal(result.proposals.length,3,result.rejected.join('\n'));
 for(const kind of ['print','review']){const doc=result.proposals.find(p=>p.id===kind).doc;for(const type of ['formula','itemized','bandtable','conditions'])assert.ok(doc.blocks.some(b=>b.type===type),type);}
 assert.deepEqual(run(schema,[],[],path.id),before);}
});
test('빈 계산 조건과 숫자가 포함된 앱 이름도 추측한 수치 없이 기본 양식을 만든다',()=>{
 const minimal={meta:{...schema.meta,appName:'2026 규정'},vars:[],paths:[],fallback:{id:'fallback',label:'미적용',conditions:[],steps:[],report:[]}};
 const result=basicReportProposals(minimal,'fallback',DEFAULT_REPORT_GUIDE);assert.equal(result.proposals.length,3);for(const p of result.proposals)assert.ok(validateDoc(minimal,'fallback',p.doc,{guide:DEFAULT_REPORT_GUIDE}).ok);
});
test('보호된 문구와 필수 표현·금지 표현 검사는 기본 양식에서도 우회하지 않는다',()=>{
 const s=structuredClone(schema);const locked={id:'official',type:'text',locked:true,tpl:'14일 이내에 문의해 주세요.'};s.paths[0].doc={blocks:[locked]};
 const guide={...DEFAULT_REPORT_GUIDE,required:['headline','formula']};
 const result=basicReportProposals(s,s.paths[0].id,guide);assert.equal(result.proposals.length,3,result.rejected.join('\n'));
 for(const p of result.proposals){assert.deepEqual(p.doc.blocks.find(b=>b.id==='official'),locked);assert.ok(p.doc.blocks.some(b=>b.type==='formula'));}
 assert.equal(basicReportProposals(s,'fallback',guide).proposals.length,0);
 assert.equal(basicReportProposals(s,s.paths[0].id,{...guide,banned:['문의']}).proposals.length,0);
});
test('모델에 경로 종류와 실제 지원되는 블록 출처를 명시한다',()=>{
 const ctx=proposalContext(schema,'fallback',DEFAULT_REPORT_GUIDE);assert.equal(ctx.path.isFallback,true);assert.deepEqual(ctx.blockSources,{formula:[],itemized:[],bandtable:[],conditions:[]});
 const active=proposalContext(schema,schema.paths[0].id,DEFAULT_REPORT_GUIDE);assert.equal(active.path.isFallback,false);assert.ok(active.blockSources.formula.length>0);
});
