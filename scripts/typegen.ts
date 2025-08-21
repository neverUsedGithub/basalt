import { json2ts } from "json-ts";

const content = await Bun.file("./actiondump.json").text();
let generated = json2ts(content, {
  rootName: "ActionDump",
  prefix: "",
});

generated = generated.replace(/^interface/gm, "export interface");
generated += `\n\nconst rawDump = await Bun.file("actiondump.json").json();\nexport const actionDump = rawDump as ActionDump;`;

await Bun.write(Bun.file("./actiondump.ts"), generated);
