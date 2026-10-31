require('./register-ts.cjs');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.tsx'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX},fileName:filename,
  });
  module._compile(result.outputText,filename);
};
const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {run,validateDoc}=require('app-renderer');
const {SAMPLE_WAGE_PEAK:schema}=require('../app/admin/builder/lib/sample-wagepeak.ts');
const DocReport=require('../app/admin/builder/components/DocReport.tsx').default;
const path=schema.paths[0];
const render=display=>{
 const doc={blocks:[{id:'k',type:'kpis',items:[{bind:'최종월기준액'},{bind:'감액률',label:'적용 감액률',...(display?{display}:{})}]}]};
 assert.equal(validateDoc(schema,path.id,doc).ok,true);
 return renderToStaticMarkup(React.createElement(DocReport,{schema,path:{...path,doc},result:run(schema,[],[],path.id)}));
};
test('감액률 가로 막대는 실제 계산값의 비율로 그리며 원형을 제거한다',()=>{
 const html=render('bar');
 assert.match(html,/aria-valuenow="20"/);assert.match(html,/width:20%/);assert.doesNotMatch(html,/<circle/);
 assert.match(html,/4,760,000원/);assert.match(html,/20%/);
});
test('숫자만 표시는 차트를 제거하고 기존 기본 양식은 링을 유지한다',()=>{
 const value=render('value');assert.doesNotMatch(value,/<circle|role="meter"/);assert.match(value,/20%/);
 assert.match(render(),/<circle/);assert.match(render('ring'),/<circle/);
});
