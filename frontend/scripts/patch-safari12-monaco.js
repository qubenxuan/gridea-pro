const fs = require('fs');
const path = require('path');

const assetsDir = path.resolve(process.cwd(), 'dist', 'assets');

if (!fs.existsSync(assetsDir)) {
  console.log('[old-webkit patch] dist/assets not found, skip');
  process.exit(0);
}

const lookbehindPairs = [
  [
    String.raw`(?<=['"\s])(#)([A-Fa-f0-9]{3})\b`,
    String.raw`(?:['"\s])(#)([A-Fa-f0-9]{3})\b`,
  ],
  [
    String.raw`(?<=['"\s])(#)([A-Fa-f0-9]{4})\b`,
    String.raw`(?:['"\s])(#)([A-Fa-f0-9]{4})\b`,
  ],
  [
    String.raw`(?<=['"\s])(#)([A-Fa-f0-9]{6})\b`,
    String.raw`(?:['"\s])(#)([A-Fa-f0-9]{6})\b`,
  ],
  [
    String.raw`(?<=['"\s])(#)([A-Fa-f0-9]{8})\b`,
    String.raw`(?:['"\s])(#)([A-Fa-f0-9]{8})\b`,
  ],
];

function patchRangeHelper(code) {
  let patched = 0;

  // 匹配你当前构建产物里的压缩结构：
  // function Yt(t,e){const n=e.index,r=e[0].length;if(n===void 0)return;const i=t.positionAt(n);return{...}}
  code = code.replace(
    /function ([A-Za-z_$][\w$]*)\((\w),(\w)\)\{const (\w)=\3\.index,(\w)=\3\[0\]\.length;if\(\4===void 0\)return;const (\w)=\2\.positionAt\(\4\);return\{startLineNumber:\6\.lineNumber,startColumn:\6\.column,endLineNumber:\6\.lineNumber,endColumn:\6\.column\+\5\}\}/g,
    (match, fn, model, matchVar, indexVar, lenVar, posVar) => {
      patched++;

      return `function ${fn}(${model},${matchVar}){let ${indexVar}=${matchVar}.index,${lenVar}=${matchVar}[0].length;if(${indexVar}===void 0)return;if(typeof ${matchVar}[0]==="string"&&${matchVar}[0].charAt(1)==="#"&&(${matchVar}[0].charCodeAt(0)===34||${matchVar}[0].charCodeAt(0)===39||/\\s/.test(${matchVar}[0].charAt(0)))){${indexVar}+=1;${lenVar}-=1}const ${posVar}=${model}.positionAt(${indexVar});return{startLineNumber:${posVar}.lineNumber,startColumn:${posVar}.column,endLineNumber:${posVar}.lineNumber,endColumn:${posVar}.column+${lenVar}}}`;
    }
  );

  // 备用匹配另一种常见压缩结构：
  // function Yt(t,e){if(e.index===void 0)return;const n=t.positionAt(e.index),r=e[0].length;return{...}}
  code = code.replace(
    /function ([A-Za-z_$][\w$]*)\((\w),(\w)\)\{if\(\3\.index===void 0\)return;const (\w)=\2\.positionAt\(\3\.index\),(\w)=\3\[0\]\.length;return\{startLineNumber:\4\.lineNumber,startColumn:\4\.column,endLineNumber:\4\.lineNumber,endColumn:\4\.column\+\5\}\}/g,
    (match, fn, model, matchVar, posVar, lenVar) => {
      patched++;
      const indexVar = '__oldWebkitColorIndex';

      return `function ${fn}(${model},${matchVar}){if(${matchVar}.index===void 0)return;let ${indexVar}=${matchVar}.index,${lenVar}=${matchVar}[0].length;if(typeof ${matchVar}[0]==="string"&&${matchVar}[0].charAt(1)==="#"&&(${matchVar}[0].charCodeAt(0)===34||${matchVar}[0].charCodeAt(0)===39||/\\s/.test(${matchVar}[0].charAt(0)))){${indexVar}+=1;${lenVar}-=1}const ${posVar}=${model}.positionAt(${indexVar});return{startLineNumber:${posVar}.lineNumber,startColumn:${posVar}.column,endLineNumber:${posVar}.lineNumber,endColumn:${posVar}.column+${lenVar}}}`;
    }
  );

  return { code, patched };
}

let changedFiles = 0;
let totalLookbehindRewrites = 0;
let totalRangePatches = 0;

for (const file of fs.readdirSync(assetsDir)) {
  if (!file.endsWith('.js')) {
    continue;
  }

  const filePath = path.join(assetsDir, file);
  let code = fs.readFileSync(filePath, 'utf8');
  const original = code;

  let fileLookbehindRewrites = 0;

  for (const [from, to] of lookbehindPairs) {
    const before = code;
    code = code.split(from).join(to);

    if (code !== before) {
      fileLookbehindRewrites++;
    }
  }

  let fileRangePatches = 0;

  if (fileLookbehindRewrites > 0) {
    const result = patchRangeHelper(code);
    code = result.code;
    fileRangePatches = result.patched;

    if (fileRangePatches === 0) {
      console.error(`[old-webkit patch] ${file} contains rewritten color regex, but range helper was not patched.`);
      console.error('[old-webkit patch] Stop build to avoid broken Monaco color ranges.');
      process.exit(1);
    }
  }

  if (code !== original) {
    fs.writeFileSync(filePath, code);
    changedFiles++;
    totalLookbehindRewrites += fileLookbehindRewrites;
    totalRangePatches += fileRangePatches;

    console.log(`[old-webkit patch] patched ${file}`);
    console.log(`[old-webkit patch]   lookbehind rewrites: ${fileLookbehindRewrites}`);
    console.log(`[old-webkit patch]   range helper patches: ${fileRangePatches}`);
  }
}

console.log(`[old-webkit patch] changed files: ${changedFiles}`);
console.log(`[old-webkit patch] total lookbehind rewrites: ${totalLookbehindRewrites}`);
console.log(`[old-webkit patch] total range helper patches: ${totalRangePatches}`);
