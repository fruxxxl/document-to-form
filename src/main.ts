import { createWorker, PSM, type Worker } from "tesseract.js";
import {
  extractFields,
  fieldKeys,
  validateField,
  type FieldKey,
} from "./extract";
import "./style.css";

const $ = <T extends HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const names: Record<FieldKey, string> = {
  name: "Название организации",
  inn: "ИНН",
  kpp: "КПП",
};
const input = $<HTMLInputElement>("#file");
const recognize = $<HTMLButtonElement>("#recognize");
const cancel = $<HTMLButtonElement>("#cancel");
const reset = $<HTMLButtonElement>("#reset");
const status = $("#status");
const progress = $<HTMLProgressElement>("#progress");
const transfer = $<HTMLButtonElement>("#transfer");
let imageFile: Blob | null = null;
let imageUrl = "";
let job = 0;
let worker: Worker | null = null;
let busy = false;
let exported: Record<FieldKey, string> | null = null;

function clearResults() {
  $("#review-form").hidden = true;
  $("#fields").replaceChildren();
  $("#raw-wrap").hidden = true;
  $("#raw").textContent = "";
  $("#result").hidden = true;
  $("#export-status").textContent = "";
  exported = null;
  transfer.disabled = true;
}

function setBusy(value: boolean) {
  busy = value;
  recognize.disabled = value || !imageFile;
  input.disabled = value;
  document
    .querySelectorAll<HTMLButtonElement>("[data-example]")
    .forEach((button) => (button.disabled = value));
  cancel.hidden = !value;
  reset.hidden = value || !imageFile;
  progress.hidden = !value;
}

async function selectImage(file: Blob, name: string) {
  const selection = ++job;
  clearResults();
  imageFile = null;
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = "";
  $("#preview-wrap").hidden = true;
  setBusy(false);
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    status.textContent =
      "Выберите изображение PNG, JPG или WebP. PDF и HEIC пока не поддерживаются.";
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    status.textContent =
      "Файл больше 10 МБ. Уменьшите изображение и попробуйте снова.";
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    const probe = new Image();
    probe.src = url;
    await probe.decode();
    if (selection !== job) {
      URL.revokeObjectURL(url);
      return;
    }
    if (
      probe.width * probe.height > 24_000_000 ||
      Math.max(probe.width, probe.height) > 8000
    ) {
      URL.revokeObjectURL(url);
      status.textContent =
        "Изображение слишком большое. Уменьшите его до 24 мегапикселей и 8000 пикселей по стороне.";
      return;
    }
    imageUrl = url;
    imageFile = file;
    $<HTMLImageElement>("#preview").src = url;
    $("#filename").textContent = name;
    $("#preview-wrap").hidden = false;
    status.textContent = "Документ готов. Нажмите «Прочитать документ».";
    setBusy(false);
  } catch {
    URL.revokeObjectURL(url);
    if (selection === job)
      status.textContent =
        "Не удалось открыть изображение. Проверьте файл или выберите пример.";
  }
}

input.addEventListener("change", () => {
  if (input.files?.[0]) void selectImage(input.files[0], input.files[0].name);
});

for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-example]",
)) {
  button.addEventListener("click", async () => {
    const selection = ++job;
    status.textContent = "Открываем пример…";
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}examples/${button.dataset.example}.png`,
      );
      if (!response.ok) throw new Error("Example unavailable");
      const blob = await response.blob();
      if (selection === job) {
        input.value = "";
        await selectImage(blob, `${button.textContent} · вымышленные данные`);
      }
    } catch {
      if (selection === job)
        status.textContent =
          "Пример не загрузился. Попробуйте ещё раз или выберите свой файл.";
    }
  });
}

recognize.addEventListener("click", async () => {
  if (!imageFile || busy) return;
  const current = ++job;
  const file = imageFile;
  clearResults();
  setBusy(true);
  progress.value = 0;
  status.textContent =
    "Загружаем распознавание. Первый запуск может занять несколько минут.";
  let localWorker: Worker | null = null;
  try {
    const base = new URL(`${import.meta.env.BASE_URL}ocr/`, location.origin)
      .href;
    localWorker = await createWorker(["rus", "eng"], 1, {
      workerPath: `${base}worker.min.js`,
      corePath: base,
      langPath: base.replace(/\/$/, ""),
      logger: (message) => {
        if (current !== job) return;
        if (message.status === "recognizing text") {
          progress.value = message.progress;
          status.textContent = `Читаем документ: ${Math.round(message.progress * 100)}%.`;
        }
      },
      errorHandler: () => {
        /* Rejection is handled below with a user-visible message. */
      },
    });
    if (current !== job) return;
    worker = localWorker;
    await localWorker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      user_defined_dpi: "300",
    });
    const { data } = await localWorker.recognize(file);
    if (current !== job) return;
    $("#raw").textContent = data.text.trim() || "Текст не найден.";
    $("#raw-wrap").hidden = false;
    renderFields(data.text);
    status.textContent = data.text.trim()
      ? "Документ прочитан. Сверьте каждое поле с изображением и отметьте проверенные."
      : "Не удалось прочитать текст. Можно заполнить поля вручную или попробовать более чёткое изображение.";
  } catch {
    if (current === job)
      status.textContent =
        "Распознавание не завершилось. Проверьте соединение для загрузки моделей и попробуйте ещё раз. Файл остался только в браузере.";
  } finally {
    if (localWorker) await localWorker.terminate();
    if (current === job) {
      worker = null;
      setBusy(false);
    }
  }
});

cancel.addEventListener("click", () => {
  ++job;
  if (worker) void worker.terminate();
  worker = null;
  setBusy(false);
  status.textContent =
    "Распознавание отменено. Можно повторить. Уже начатая загрузка моделей может завершиться в фоне.";
});

reset.addEventListener("click", () => {
  ++job;
  clearResults();
  imageFile = null;
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = "";
  input.value = "";
  $<HTMLImageElement>("#preview").removeAttribute("src");
  $("#preview-wrap").hidden = true;
  setBusy(false);
  status.textContent = "Выберите файл или один из примеров.";
  input.focus();
});

function renderFields(text: string) {
  const extracted = extractFields(text);
  const container = $("#fields");
  for (const key of fieldKeys) {
    const field = document.createElement("div");
    field.className = "field";
    const label = document.createElement("label");
    label.htmlFor = `field-${key}`;
    label.textContent = names[key];
    const value = document.createElement("input");
    value.id = `field-${key}`;
    value.name = key;
    value.value = extracted[key].value;
    value.autocomplete = "off";
    value.maxLength = key === "name" ? 200 : 30;
    if (key !== "name") value.inputMode = "numeric";
    value.setAttribute("aria-describedby", `source-${key} issue-${key}`);
    const source = document.createElement("p");
    source.id = `source-${key}`;
    source.className = "source";
    source.textContent = extracted[key].source
      ? `Прочитано в документе: ${extracted[key].source}`
      : "Фрагмент не найден. Сверьтесь с изображением слева.";
    const issue = document.createElement("p");
    issue.id = `issue-${key}`;
    issue.className = "issue";
    issue.textContent = extracted[key].issue;
    const checkLabel = document.createElement("label");
    checkLabel.className = "confirm";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.id = `confirmed-${key}`;
    check.disabled = Boolean(validateField(key, value.value));
    value.setAttribute(
      "aria-invalid",
      String(Boolean(validateField(key, value.value))),
    );
    checkLabel.append(check, document.createTextNode("Сверил с документом"));
    value.addEventListener("input", () => {
      check.checked = false;
      issue.textContent = validateField(key, value.value);
      check.disabled = Boolean(issue.textContent);
      value.setAttribute("aria-invalid", String(Boolean(issue.textContent)));
      updateTransfer();
    });
    check.addEventListener("change", updateTransfer);
    field.append(label, value, source, issue, checkLabel);
    container.append(field);
  }
  $("#review-form").hidden = false;
}

function updateTransfer() {
  $("#result").hidden = true;
  exported = null;
  transfer.disabled = !fieldKeys.every(
    (key) =>
      $<HTMLInputElement>(`#confirmed-${key}`).checked &&
      !validateField(key, $<HTMLInputElement>(`#field-${key}`).value),
  );
}

$("#review-form").addEventListener("submit", (event) => {
  event.preventDefault();
  updateTransfer();
  if (transfer.disabled) return;
  exported = Object.fromEntries(
    fieldKeys.map((key) => [
      key,
      $<HTMLInputElement>(`#field-${key}`).value.trim(),
    ]),
  ) as Record<FieldKey, string>;
  for (const key of fieldKeys)
    $<HTMLInputElement>(`#result-${key}`).value = exported[key];
  $("#result").hidden = false;
  $("#export-status").textContent = "";
  $("#result-title").focus({ preventScroll: true });
  $("#result").scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "start",
  });
});

$("#copy").addEventListener("click", async () => {
  if (!exported) return;
  try {
    await navigator.clipboard.writeText(
      fieldKeys.map((key) => `${names[key]}: ${exported![key]}`).join("\n"),
    );
    $("#export-status").textContent = "Данные скопированы.";
  } catch {
    $("#export-status").textContent =
      "Браузер не разрешил копирование. Выделите значения вручную или скачайте JSON.";
  }
});

$("#download").addEventListener("click", () => {
  if (!exported) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(exported, null, 2)], {
      type: "application/json;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "organization.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $("#export-status").textContent = "JSON подготовлен для скачивания.";
});
