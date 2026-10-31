require('./register-ts.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {run}=require('app-renderer');
const {SAMPLE_WAGE_PEAK}=require('../app/admin/builder/lib/sample-wagepeak.ts');
const {wagePeakNoticeDoc,showcaseDoc}=require('../app/admin/builder/lib/sample-wagepeak-doc.ts');
const {reportExportModel}=require('../lib/report-export/model.ts');
const {renderDocumentWord}=require('../lib/report-export/docx.ts');
function fixture(){const schema=structuredClone(SAMPLE_WAGE_PEAK);schema.paths[0].doc=wagePeakNoticeDoc(schema.paths[0]);return {schema,result:run(schema,[],[],schema.paths[0].id)};}
test('출력은 확정 문서와 계산 결과를 그대로 사용하고 원본을 변경하지 않는다',()=>{
 const {schema,result}=fixture(),before=JSON.stringify({schema,result});
 const model=reportExportModel(schema,result,{issuedAt:'2026-10-31',issuer:{company:'검수 회사',dept:'인사팀'}});
 assert.equal(model.pages.length,2);assert.equal(model.issuedAt,'2026-10-31');assert.equal(model.issuer.company,'검수 회사');
 assert.equal(model.pages[0].find(b=>b.type==='kpis').rows[0].value,'4,760,000원');
 assert.ok(JSON.stringify(model).includes('58세'));assert.equal(JSON.stringify({schema,result}),before);
 assert.deepEqual(model,reportExportModel(schema,result,{issuedAt:'2026-10-31',issuer:{company:'검수 회사',dept:'인사팀'}}));
 const item=model.pages[1].find(b=>b.type==='itemized');assert.equal(item.rows.find(r=>r.label==='분기상여').muted,true);
 assert.equal(item.rows.find(r=>r.strong).value,'5,950,000원');assert.ok(Math.abs(item.rows.reduce((a,r)=>a+(r.ratio||0),0)-1)<1e-10);
});
test('문서형 경로와 유효한 결과만 출력하며 없는 참조는 거절한다',()=>{
 const {schema,result}=fixture();assert.throws(()=>reportExportModel(schema,{...result,sc:null}));
 schema.paths[0].doc.blocks.push({id:'bad',type:'facts',items:[{bind:'없는 값'}]});assert.throws(()=>reportExportModel(schema,result));
 delete schema.paths[0].doc;assert.throws(()=>reportExportModel(schema,result));
});
test('경로별 계산과 발행 정보·강조색을 독립적으로 반영한다',()=>{
 const {schema}=fixture();for(const p of [...schema.paths,schema.fallback]){
 p.doc={blocks:[{id:'facts',type:'facts',items:[{bind:'성명'}]},{id:'head',type:'headline',tpl:'{적용여부}'}]};
 const result=run(schema,[],[],p.id),model=reportExportModel(schema,result,{accent:'#123456'});
 assert.equal(model.pathLabel,p.label);assert.equal(model.pages[0][1].text,p.label);assert.equal(model.accent,'#123456');
 }
});
test('Word 파일의 실제 내용에 계산 수치·공식 문구·발행 정보가 남는다',async()=>{
 const {schema,result}=fixture();const model=reportExportModel(schema,result,{issuer:{company:'검수 회사',dept:'인사팀'}});
 const data=await renderDocumentWord(model);assert.equal(data.subarray(0,2).toString(),'PK');
 const {value}=await require('mammoth').extractRawText({buffer:data});
 for(const text of ['4,760,000원','5,950,000원','20%','58세','14일 이내','분기상여 · 제외','검수 회사'])assert.ok(value.includes(text),text);
 assert.ok(value.indexOf('이렇게 계산했습니다')<value.indexOf('통상임금 구성'));
});

test('표현 견본의 모든 문서 블록을 값 누락 없이 출력 모델로 변환한다',()=>{
 const {schema}=fixture();schema.paths[0].doc=showcaseDoc(schema.paths[0]);
 const model=reportExportModel(schema,run(schema,[],[],schema.paths[0].id));
 for(const b of model.pages.flat())if(!['element','text','headline'].includes(b.type))assert.ok(b.rows.length,b.type);
});
test('PDF 렌더러가 실제 한글·원형 차트·쪽 나눔을 포함한 파일을 생성한다',async()=>{
 const fs=require('node:fs'),ts=require('typescript');
 require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true},fileName:f}).outputText,f);
 const {renderDocumentPdf}=require('../lib/report-export/pdf.tsx');const {schema,result}=fixture();
 const data=await renderDocumentPdf(reportExportModel(schema,result));assert.equal(data.subarray(0,5).toString(),'%PDF-');assert.ok(data.length>10000);
});
