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
import { BlockSplitter } from "../splitter";
import { compileProject } from "../basalt/compileProject";

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

  const compileStart = performance.now();
  let result;

  try {
    result = await compileProject(projectDir, { optimize: true });
  } catch (e) {
    logger.fail(`Failed to compile.`);

    if (e instanceof SourceError) {
      console.log(e.message);
    } else {
      throw e;
    }

    process.exit(1);
  }

  if (!result.isOk()) {
    logger.fail(`Failed to compile: ${result.unwrapErr()}`);
    process.exit(1);
  }

  const rows = result.unwrap();

  if (Bun.argv.includes("-d")) {
    await Bun.write(
      "debug-blocks.json",
      JSON.stringify(
        rows.flatMap((row) => row.get()),
        null,
        2,
      ),
    );
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
  await codeClient.close();
}

cli();
