# Сторонние компоненты

Версии закреплены в package-lock.json. Движок и модели копируются в статическую сборку скриптом `scripts/prepare-ocr.mjs`.

| Компонент | Назначение | Лицензия и источник |
|---|---|---|
| Tesseract.js | OCR в браузере | Apache-2.0, https://github.com/naptha/tesseract.js |
| Tesseract.js-core | WASM-движок | Apache-2.0, https://github.com/naptha/tesseract.js-core |
| @tesseract.js-data/rus, eng | Пакеты языковых данных | MIT пакетов, https://github.com/naptha/tessdata |

Tesseract OCR разработан участниками проекта Tesseract. Пакеты языковых данных содержат traineddata; сведения об исходных моделях приведены в https://github.com/tesseract-ocr/tessdata.
