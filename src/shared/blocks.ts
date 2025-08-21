import { compressBlocks } from "../diamondfire/df";
import type { DFBlock, DFBlockTarget, DFTarget } from "../diamondfire/types";

export class DFBlockRow {
  constructor(private blocks: DFBlock[] = []) {}

  add(block: DFBlock) {
    this.blocks.push(block);
  }

  async compressed(): Promise<string> {
    return compressBlocks(this.blocks);
  }

  get() {
    return this.blocks;
  }
}

export class BlockRowManager {
  private pointer = -1;
  private rows: DFBlockRow[] = [];
  private blockTargets: DFBlockTarget[] = [];

  begin() {
    this.pointer++;
    this.rows.splice(this.pointer, 0, new DFBlockRow());
  }

  end() {
    this.pointer--;
  }

  add(block: DFBlock) {
    this.rows[this.pointer].add(block);
  }

  pushTarget(target: DFBlockTarget) {
    this.blockTargets.push(target);
  }

  popTarget() {
    this.blockTargets.pop();
  }

  currentBlockTarget(): DFBlockTarget | null {
    if (!this.blockTargets.length) return null;
    return this.blockTargets[this.blockTargets.length - 1];
  }

  currentGameValueTarget(): DFTarget | null {
    const blockTarget = this.currentBlockTarget();
    if (!blockTarget) return null;

    return blockTarget === "AllPlayers" || blockTarget === "AllEntities" ? "Default" : blockTarget;
  }

  get() {
    return this.rows;
  }

  flat() {
    return this.rows.map((r) => r.get()).flat();
  }
}

export function splitBlocks(blocks: DFBlock[]): DFBlockRow[] {
  const rows: DFBlockRow[] = [];

  let start: DFBlock | null = null;
  let body: DFBlock[] = [];
  for (const block of blocks) {
    if (block.id === "block") {
      if (block.block === "func" || block.block === "event") {
        if (start) rows.push(new DFBlockRow([start, ...body]));

        start = block;
        body = [];

        continue;
      }
    }

    body.push(block);
  }

  if (start) rows.push(new DFBlockRow([start, ...body]));

  return rows;
}

export function joinBlocks(rows: DFBlockRow[]): DFBlock[] {
  return rows.map((row) => row.get()).flat();
}