export type FieldKey = 'name' | 'inn' | 'kpp';
export type ExtractedField = { value: string; source: string; issue: string };
export type ExtractedDocument = Record<FieldKey, ExtractedField>;
export const fieldKeys: FieldKey[] = ['name', 'inn', 'kpp'];

const labels: Record<FieldKey, RegExp> = {
  name: /(?:^|\s)(?:Наименование(?: организации)?|Организация)\s*[:：-]?\s*(.*)$/iu,
  inn: /(?:^|\s)ИНН\s*[:：-]?\s*(.*)$/iu,
  kpp: /(?:^|\s)КПП\s*[:：-]?\s*(.*)$/iu,
};

export function validateField(key: FieldKey, value: string): string {
  if (!value.trim()) return 'Заполните поле по исходному документу.';
  if (key === 'name') return value.length > 200 ? 'Название слишком длинное: проверьте, не попал ли сюда другой текст.' : '';
  if (key === 'kpp') return /^\d{9}$/.test(value) && !/^0+$/.test(value) ? '' : 'В этом примере КПП должен состоять из 9 цифр.';
  if (!/^\d{10}$/.test(value)) return 'Нужен ИНН юридического лица: 10 цифр.';
  if (/^(\d)\1+$/.test(value)) return 'Проверьте ИНН: повторяющиеся цифры не принимаются.';
  const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];
  const checksum = weights.reduce((sum, weight, index) => sum + weight * Number(value[index]), 0) % 11 % 10;
  return checksum === Number(value[9]) ? '' : 'Контрольная цифра ИНН не сходится. Сверьте с документом.';
}

export function extractFields(text: string): ExtractedDocument {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const result = {} as ExtractedDocument;
  for (const key of fieldKeys) {
    const candidates: { value: string; source: string }[] = [];
    for (let index = 0; index < lines.length; index++) {
      const match = lines[index].match(labels[key]);
      if (!match) continue;
      let raw = match[1].trim();
      let source = lines[index];
      if (!raw && lines[index + 1] && !/^(?:ИНН|КПП|Наименование|Организация)(?:\s|[:：]|$)/iu.test(lines[index + 1])) {
        raw = lines[index + 1];
        source += '\n' + raw;
      }
      const value = key === 'name'
        ? raw.split(/\s+(?:ИНН|КПП)\s*[:：]?/iu)[0].trim()
        : (raw.match(/^[\d][\d \t]*(?=$|[^\d \t])/)?.[0] ?? '').replace(/[ \t]/g, '');
      if (value) candidates.push({ value, source });
    }
    const values = [...new Set(candidates.map(candidate => candidate.value))];
    if (values.length > 1) {
      result[key] = { value: '', source: candidates.map(candidate => candidate.source).join('\n'), issue: 'В документе разные значения. Выберите нужное по исходнику.' };
    } else if (candidates.length) {
      result[key] = { ...candidates[0], issue: validateField(key, candidates[0].value) };
    } else {
      result[key] = { value: '', source: '', issue: 'Не удалось прочитать поле с подписью. Введите значение по документу.' };
    }
  }
  return result;
}
