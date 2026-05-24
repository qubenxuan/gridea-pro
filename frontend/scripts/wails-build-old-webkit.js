const { execFileSync } = require('child_process');

console.log('[wails build] running vite build...');
execFileSync('npx', ['vite', 'build'], {
  stdio: 'inherit',
  cwd: process.cwd(),
});

console.log('[wails build] patching Monaco regex for old WebKit...');
execFileSync(process.execPath, ['scripts/patch-safari12-monaco.js'], {
  stdio: 'inherit',
  cwd: process.cwd(),
});
