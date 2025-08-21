import { json2ts } from "json-ts";

const content = await Bun.file("./src/actiondump/actiondump.json").text();
let generated = json2ts(content, {
  rootName: "ActionDump",
  prefix: "",
});

generated = generated.replace(/^interface/gm, "export interface");
generated += `
import { join } from "path";
import { readFileSync } from "fs";
const parentDir = require.main === module ? __dirname : import.meta.dir;
const rawDump = JSON.parse(readFileSync(join(parentDir, "actiondump.json"), { encoding: "utf-8" }));
export const actionDump = rawDump as ActionDump;`;

await Bun.write(Bun.file("./src/actiondump/index.ts"), generated);
