import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFields, validateField } from '../src/extract';

test('Extracts labelled fields and retains the evidence', () => {
  const fields = extractFields('Наименование: ООО «Пример»\nИНН: 9 9 0 0 0 0 0 0 0 0\nКПП: 990001001');
  assert.equal(fields.name.value, 'ООО «Пример»');
  assert.equal(fields.inn.value, '9900000000');
  assert.match(fields.inn.source, /ИНН:/);
  assert.equal(fields.kpp.value, '990001001');
});
test('Missing fields remain empty', () => {
  const fields = extractFields('Наименование: ООО «Пример»');
  assert.equal(fields.inn.value, '');
  assert.equal(fields.kpp.value, '');
  assert.ok(fields.kpp.issue);
});
test('Conflicting values require a decision', () => {
  const fields = extractFields('ИНН: 9900000000\nИНН: 9900000017');
  assert.equal(fields.inn.value, '');
  assert.match(fields.inn.issue, /разные значения/);
  assert.match(fields.inn.source, /9900000017/);
});
test('Does not silently replace OCR letters with digits', () => {
  const fields = extractFields('ИНН: 99О0000009');
  assert.ok(fields.inn.issue);
  assert.notEqual(fields.inn.value, '9900000000');
});
test('Reads values on the next line, but never another label', () => {
  assert.equal(extractFields('Наименование:\nООО Пример').name.value, 'ООО Пример');
  assert.equal(extractFields('Наименование:\nИНН 9900000000').name.value, '');
});
test('Validates checksum and excludes individual tax numbers', () => {
  assert.equal(validateField('inn','9900000000'),'');
  assert.ok(validateField('inn','9900000001'));
  assert.ok(validateField('inn','123456789012'));
  assert.ok(validateField('inn','0000000000'));
});
test('Validates the limited KPP format', () => {
  assert.equal(validateField('kpp','990001001'),'');
  assert.ok(validateField('kpp','000000000'));
  assert.ok(validateField('kpp','99000100'));
});
test('HTML-shaped input remains text without evaluation', () => {
  assert.equal(extractFields('Организация: <img src=x onerror=alert(1)>').name.value, '<img src=x onerror=alert(1)>');
});
