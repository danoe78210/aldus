import { readFile, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const input = fileURLToPath(new URL("../docs/styles.input.css", import.meta.url));
const output = fileURLToPath(new URL("../docs/styles.css", import.meta.url));
const result = await postcss([tailwindcss()]).process(await readFile(input, "utf8"), {
  from: input,
  to: output,
});
await writeFile(`${output}.tmp`, result.css);
await rename(`${output}.tmp`, output);
