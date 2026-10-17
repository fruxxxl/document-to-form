import { cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'public/ocr');
await mkdir(output, { recursive: true });
await cp(resolve(root, 'node_modules/tesseract.js/dist/worker.min.js'), resolve(output, 'worker.min.js'));
const core = resolve(root, 'node_modules/tesseract.js-core');
for (const name of await readdir(core)) {
  if (name.endsWith('.wasm') || name.endsWith('.wasm.js')) await cp(resolve(core, name), resolve(output, name));
}
for (const language of ['rus', 'eng']) {
  await cp(resolve(root, `node_modules/@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`), resolve(output, `${language}.traineddata.gz`));
}
console.log('OCR worker, WASM и языковые модели подготовлены в public/ocr.');
const licenses = resolve(root, 'public/licenses');
await mkdir(licenses, { recursive: true });
await cp(resolve(root, 'node_modules/tesseract.js/LICENSE.md'), resolve(licenses, 'tesseract-js.txt'));
await cp(resolve(root, 'node_modules/tesseract.js-core/LICENSE'), resolve(licenses, 'tesseract-core.txt'));
await cp(resolve(root, 'LICENSE'), resolve(licenses, 'document-to-form.txt'));
await cp(resolve(root, 'THIRD-PARTY.md'), resolve(licenses, 'third-party.txt'));
