// 추가 테스트 의존성 없이 프로젝트 TypeScript와 경로 별칭을 읽는다.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) {
  if (name === 'app-renderer') name = path.join(root, 'packages/app-renderer/index.ts');
  else if (name.startsWith('@/')) name = path.join(root, name.slice(2));
  return resolve.call(this, name, ...args);
};
require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
  });
  module._compile(result.outputText, filename);
};
