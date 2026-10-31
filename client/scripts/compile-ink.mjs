import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Compiler } from "inkjs/full";

const client = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(client, "../content/ink");
let languages;
try {
  languages = await readdir(source, { withFileTypes: true });
} catch (error) {
  if (error.code === "ENOENT") process.exit(0);
  throw error;
}

for (const language of languages.filter((entry) => entry.isDirectory())) {
  const directory = join(source, language.name);
  for (const file of await readdir(directory, { withFileTypes: true })) {
    if (!file.isFile() || !file.name.endsWith(".ink")) continue;
    const input = join(directory, file.name);
    try {
      const compiler = new Compiler(await readFile(input, "utf8"));
      const story = compiler.Compile();
      if (compiler.errors.length) throw new Error(compiler.errors.join("\n"));
      const output = join(client, "public/ink", language.name, `${file.name.slice(0, -4)}.json`);
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, story.ToJson(), "utf8");
    } catch (error) {
      console.error(`${input}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
