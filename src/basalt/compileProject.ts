import { basename, join } from "node:path";
import { CodeGen } from "../codegen";
import { Lexer } from "../lexer";
import { Optimizer } from "../optimizer";
import { Parser } from "../parser";
import { joinBlocks as joinBlockRows, splitBlocks, type DFBlockRow } from "../shared/blocks";
import { loadProject } from "../shared/project";
import { SourceError, SourceFile } from "../shared/source";
import { TypeChecker } from "../typechecker";
import { BlockSplitter } from "../splitter";

export interface CompileProjectOptions {
  optimize?: boolean;
}

const DEFAULT_SETTINGS: CompileProjectOptions = {
  optimize: true,
};

export async function compileProject(projectDir: string, options_?: CompileProjectOptions): Promise<DFBlockRow[]> {
  const entryName = basename(projectDir);
  const entryPoint = join(projectDir, `${entryName}.basalt`);

  const options = Object.assign({}, DEFAULT_SETTINGS, options_);

  const project = await loadProject(projectDir);
  const source = await SourceFile.from(entryPoint);

  let rows: DFBlockRow[];

  const lexer = new Lexer(source, "strict");
  const parser = new Parser(source, lexer, "strict", null);
  const ast = parser.parse();

  const checker = new TypeChecker(source, ast, "strict");
  checker.checkProgram();

  const codegen = new CodeGen(source, checker, ast);
  const blockRows = codegen.generateProgram();
  const blocks = joinBlockRows(blockRows);

  const optimizer = new Optimizer(blocks);
  const optimizedBlocks = optimizer.optimize();

  const splitter = new BlockSplitter({ plotSize: project.plot.size });

  if (!options?.optimize) {
    rows = splitBlocks(splitter.wrapBlocks(blocks));
  } else {
    rows = splitBlocks(splitter.wrapBlocks(optimizedBlocks));
  }

  return rows;
}
