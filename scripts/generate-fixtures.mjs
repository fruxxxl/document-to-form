import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const dir = fileURLToPath(new URL("../public/examples/", import.meta.url));
await mkdir(dir, { recursive: true });
const base = "990000000";
const check =
  ([2, 4, 10, 3, 5, 9, 4, 6, 8].reduce(
    (s, w, i) => s + w * Number(base[i]),
    0,
  ) %
    11) %
  10;
const inn = base + check;
function svg(lines) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1050"><rect width="1600" height="1050" fill="white"/><g fill="#111" font-family="Arial, sans-serif"><text x="100" y="140" font-size="48" font-weight="bold">КАРТОЧКА ОРГАНИЗАЦИИ</text><text x="100" y="220" font-size="30">Вымышленный документ для проверки OCR</text>${lines.map((line, i) => `<text x="100" y="${360 + i * 120}" font-size="42">${line}</text>`).join("")}</g></svg>`;
}
const clean = svg([
  "Наименование: ООО «Пример»",
  `ИНН: ${inn}`,
  "КПП: 990001001",
]);
await sharp(Buffer.from(clean)).png().toFile(`${dir}/clean.png`);
await sharp(Buffer.from(clean))
  .rotate(2, { background: "#dddddd" })
  .blur(0.5)
  .png()
  .toFile(`${dir}/tilted.png`);
await sharp(
  Buffer.from(
    svg(["Наименование: ООО «Пример»", `ИНН: ${base}${(check + 1) % 10}`]),
  ),
)
  .png()
  .toFile(`${dir}/incomplete.png`);
await writeFile(
  `${dir}/expected.json`,
  JSON.stringify(
    {
      clean: { name: "ООО «Пример»", inn, kpp: "990001001" },
      tilted: { name: "ООО «Пример»", inn, kpp: "990001001" },
      incomplete: {
        name: "ООО «Пример»",
        inn: base + ((check + 1) % 10),
        kpp: "",
      },
    },
    null,
    2,
  ) + "\n",
);
console.log("Three synthetic documents generated.");
