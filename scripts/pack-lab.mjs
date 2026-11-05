import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.argv[2] || path.join(root, 'dist', 'offline'));
await mkdir(output, { recursive: true });
const names = { lab: 'Play Alembic Matter Lab.html', valley: 'Play Alembic Turning Valley.html', water: 'Play Alembic Waterworks.html' };
const read = file => readFile(file, 'utf8');
function replaceOnce(source, before, after) {
  if (source.indexOf(before) < 0 || source.indexOf(before) !== source.lastIndexOf(before)) throw new Error(`Cannot package: expected one ${before}`);
  return source.replace(before, () => after);
}
async function bundle(source, contents) {
  const result = await build({ stdin: { contents, resolveDir: source, loader: 'js' }, bundle: true, write: false, minify: true, target: 'es2022', format: 'iife' });
  return result.outputFiles[0].text;
}
async function page(folder, name, transform = value => value) {
  const source = path.join(root, 'public', folder);
  const script = await transform(await read(path.join(source, 'app.js')), source);
  let html = await read(path.join(source, 'index.html'));
  html = html.replace(/<link rel="stylesheet" href="\.\/style\.css"\s*\/?>/, () => `<style>${styles.get(folder)}</style>`);
  html = replaceOnce(html, '<script type="module" src="./app.js"></script>', `<script>${(await bundle(source, script)).replace(/<\/script/gi, '<\\/script')}</script>`);
  if (folder === 'v2/lab') html = html.replace('href="../index.html"', 'href="https://cosmonautjones.github.io/falling-sand/v2/" target="_blank" rel="noopener"').replace('>Classic vessel</a>', '>Classic vessel (online)</a>');
  html = html.replace(/href="(?:\.\.\/){1,2}(?:v2\/)?(?:index\.html)?"/g, `href="./${names.lab}"`)
    .replace(/href="\.\.\/(?:v2\/)?lab\/index\.html"/g, `href="./${names.lab}"`)
    .replace(/href="\.\.\/catch\/(?:index\.html)?"/g, `href="./${names.water}"`)
    .replace(/href="\.\.\/\.\.\/v3\/(?:index\.html)?"/g, `href="./${names.valley}"`);
  await writeFile(path.join(output, name), html);
  console.log(name);
}
const styles = new Map();
for (const folder of ['v2/lab', 'v3', 'v2/catch']) styles.set(folder, await read(path.join(root, 'public', folder, 'style.css')));
await page('v2/lab', names.lab);
await page('v3', names.valley);
await page('v2/catch', names.water, async (app, source) => {
  const worker = await bundle(source, replaceOnce(await read(path.join(source, 'worker.js')), "new URL(self.location.href).searchParams.get('level')", 'waterworksLevel'));
  return replaceOnce(app, "const url=new URL('./worker.js',import.meta.url);url.searchParams.set('level',level.id);", `const url=URL.createObjectURL(new Blob(['const waterworksLevel='+JSON.stringify(level.id)+';\\n',${JSON.stringify(worker)}],{type:'text/javascript'}));const revoke=()=>URL.revokeObjectURL(url);`)
    .replace('worker=new Worker(url,{type:\'module\'});', "worker=new Worker(url);worker.addEventListener('message',revoke,{once:true});worker.addEventListener('error',revoke,{once:true});");
});
