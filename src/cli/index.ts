import logger from "@justcoding123/logger";
import { basename, isAbsolute, join } from "node:path";
import { CodeGen } from "../codegen";
import { Lexer } from "../lexer";
import { Optimizer } from "../optimizer";
import { Parser } from "../parser";
import { joinBlocks as joinBlockRows, splitBlocks, type DFBlockRow } from "../shared/blocks";
import { loadProject } from "../shared/project";
import { SourceError, SourceFile } from "../shared/source";
import { TypeChecker } from "../typechecker";
import { CodeClientConnection } from "../codeclient";

// const dec = await decompressDF(
//   JSON.parse(
//     '{"author":"CodeClient","name":"Template to be placed","version":1,"code":"H4sIAAAAAAAACr2UQWvcMBSE/4qZa33otmnZPOgh9FbYHtqSSwhCK70YJbJkLHlpMf7vQbYFiVk3S5bk6GfN+H0zwj321quHALrpYTRoekYJqaLxDoQf3jiU85zAB3YxvW+rAOphItdJfjsM5cIiS5S0Vtx1Th2VldAyShD0nZWuEsaZiKVXXofw4Vt2BiFwFAfZLn0nmsj1OEk206HpQz2crBmEe2+cUL4beYLyTRoGeWCNYSgRrI+gj+MqT71cVy+9CJssiaDNcGIYM3iIrXHVKyEu9YWS++32s9Z8sc0gIFjj+L8cr81kBTA3hLcoSOSMzsQ7Na33IlTsIreshW9G71P5ktTXzZrhqW2B8Jud3nEIsuJMBUJj5T9uxXzqJbaVXdKfo/ie6qPinJv4Uvm0WTpib0WUVTalfg1sLYckJlxZU7maXSx2Xqfx3BLhF1edHbc+yNbIveUze84woE9f34jmD/+NxbW0HRc7bqsp0UyEn74IjVQcjjEd79d5MUue7f8l3bfb4RGiF67sWwYAAA=="}',
//   ).code,
// );
// await Bun.write("debug-blocks-parsed.json", JSON.stringify(dec, null, 2));

if (Bun.argv.length < 3) {
  logger.fail("usage: basalt <project>");
  process.exit(1);
}

function codeClientFail() {
  logger.fail("Could not connect to CodeClient, do you have your API enabled?");
  process.exit(1);
}

async function cli() {
  const projectDir = isAbsolute(Bun.argv[2]) ? Bun.argv[2] : join(process.cwd(), Bun.argv[2]);
  const entryName = basename(projectDir);
  const entryPoint = join(projectDir, `${entryName}.basalt`);

  const project = await loadProject(projectDir);
  const source = await SourceFile.from(entryPoint);

  const compileStart: number = performance.now();

  let rows: DFBlockRow[];

  try {
    const lexer = new Lexer(source, "strict");
    const parser = new Parser(source, lexer, "strict", null);
    const ast = parser.parse();

    const checker = new TypeChecker(source, ast, "strict");
    checker.checkProgram();

    const codegen = new CodeGen(source, checker, ast);
    const blockRows = codegen.generateProgram();
    const blocks = joinBlockRows(blockRows);

    const optimizer = new Optimizer(blocks);
    const newBlocks = optimizer.optimize();

    if (Bun.argv.includes("-d")) {
      await Bun.write("debug-blocks-unoptimized.json", JSON.stringify(blocks, null, 2));
      await Bun.write("debug-blocks-optimized.json", JSON.stringify(newBlocks, null, 2));
    }

    rows = splitBlocks(newBlocks);
  } catch (e) {
    if (e instanceof SourceError) {
      console.error(e.message);
      process.exit(1);
    } else {
      throw e;
    }
  }

  const compileTime = performance.now() - compileStart;

  logger.done(`Compilation took ${compileTime.toFixed(2)}ms`);

  if (!Bun.argv.includes("-cc")) {
    return;
  }

  const codeClient = new CodeClientConnection(["movement", "write_code"]);
  await codeClient.authed();

  codeClient.setMode("dev");
  await Bun.sleep(600);
  await codeClient.placeTemplates(rows).catch(codeClientFail);
  await Bun.sleep(400);
  codeClient.setMode("play");
  await Bun.sleep(200);
  codeClient.close();
}

cli();
