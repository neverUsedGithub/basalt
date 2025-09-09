import type { DFBlock, DFBracket, DFCode, DFCodeBlock, DFVar } from "../diamondfire/types";
import { DFBlockRow, getBlocksSize, BRACKET_BLOCKS, splitBlocks } from "../shared/blocks";

export interface BlockSplitterOptions {
  plotSize: number;
}

export class BlockSplitter {
  private tempFunctionIndex: number = 0;

  constructor(private options: BlockSplitterOptions) {}

  private tempFunction(): string {
    return `basalt-wrap#${this.tempFunctionIndex++}`;
  }

  private wrapRow(row: DFBlockRow, depth: number = 0): DFBlockRow[] {
    const blocks = row.get();
    const extra: DFBlockRow[] = [];
    const out: DFBlock[] = [];
    let size = 0;

    for (let i = 0; i < blocks.length; i++) {
      let wrapBody: DFBlock[];

      if (blocks[i].id === "bracket") {
        if (i - 1 < 0) throw new Error("invalid brackets");
        const start = i++;

        for (let brackets = 1; brackets > 0; i++) {
          if (i >= blocks.length) throw new Error("invalid brackets");
          if (blocks[i].id !== "bracket") continue;

          if ((blocks[i] as DFBracket).direct === "open") brackets++;
          else {
            if (brackets === 0) throw new Error("invalid brackets");
            if (brackets === 1) break;
            brackets--;
          }
        }

        const bracketContent = blocks.slice(start + 1, i);
        const amount = getBlocksSize(bracketContent) + 1 + 2;

        if (size + amount < this.options.plotSize - 1) {
          size += amount;
          out.push(blocks[start]);
          out.push(...bracketContent);
          out.push(blocks[i]);

          continue;
        }

        out.push(blocks[start]);
        wrapBody = bracketContent;
      } else {
        // Bracket blocks must have space for at least their brackets and a single code block inside.
        const amount = BRACKET_BLOCKS.includes((blocks[i] as DFCodeBlock).block) ? 5 : 2;

        if (size + amount < this.options.plotSize - 1) {
          size += amount;
          out.push(blocks[i]);

          continue;
        }

        wrapBody = blocks.slice(i, blocks.length);
        i = blocks.length;
      }

      for (const block of wrapBody) {
        if (block.id !== "block") continue;
        if (block.block !== "control") continue;

        if (block.action === "Return" || block.action === "ReturnNTimes") {
          block.action = "ReturnNTimes";
          block.args.items = [{ item: { id: "num", data: { name: `${depth + 2}` } }, slot: 0 }];
        }
      }

      const innerFunction = this.tempFunction();
      const innerDefinition: DFCodeBlock = { id: "block", block: "func", data: innerFunction, args: { items: [] } };
      const innerRow = new DFBlockRow([innerDefinition, ...wrapBody]);

      const wrapped = this.wrapRow(innerRow, depth + 1);

      const innerVariables = innerRow.getVariables();
      const outerVariables = new DFBlockRow(out).getVariables();

      const callItems: DFVar[] = [];

      for (const scope of ["line", "local", "unsaved", "saved"] as const) {
        const shared = innerVariables[scope].intersection(outerVariables[scope]);

        for (const item of shared) {
          innerDefinition.args.items.push({
            item: { id: "pn_el", data: { type: "var", name: item, optional: false, plural: false } },
            slot: innerDefinition.args.items.length,
          });

          callItems.push({ id: "var", data: { name: item, scope } });
        }
      }

      out.push({
        id: "block",
        block: "call_func",
        data: innerFunction,
        args: { items: callItems.map((item, slot) => ({ item, slot })) },
      });

      if (i < blocks.length && blocks[i].id === "bracket") out.push(blocks[i]);

      extra.push(...wrapped);
    }

    return [...extra, new DFBlockRow(out)];
  }

  wrapBlocks(blocks: DFBlock[]): DFBlock[] {
    const rows = splitBlocks(blocks);
    const wrapped = rows.map((row) => this.wrapRow(row));

    return wrapped.flatMap((rows) => rows.flatMap((row) => row.get()));
  }
}
