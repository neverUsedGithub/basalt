import type { DFBlock, DFCodeBlock, DFItem, DFParameter, DFVar } from "../diamondfire/types";
import { VariableAliases } from "./pass/variableAliases";
import { TrackVariables } from "./pass/trackVariables";
import { DeadCode } from "./pass/deadCode";

export type VariableScope = "unsaved" | "saved" | "local" | "line";

export interface CodeBlockLocation {
  index: number;
  slot: number;
}

function hashLocation(index: number, slot: number): number {
  return (index << 24) | slot;
}

export class CallableSymbol {
  public usages: number[] = [];

  constructor(private context: OptimizationContext) {}
}

export class VariableSymbol {
  public reads: CodeBlockLocation[] = [];
  public readsHashes: Set<number> = new Set();

  public writes: CodeBlockLocation[] = [];
  public writesHashes: Set<number> = new Set();

  constructor(
    private context: OptimizationContext,
    private scope: VariableScope,
    private isParameter: boolean,
  ) {}

  isConstant() {
    return this.writes.length === 1;
  }

  isUnused() {
    return this.reads.length === 0;
  }

  isInlineable() {
    return (
      !this.isParameter &&
      (this.scope === "line" || this.scope === "local") &&
      this.isConstant() &&
      this.reads.length === 1
    );
  }

  untrackBlock(index: number) {
    for (let i = this.writes.length - 1; i >= 0; i--) {
      if (this.writes[i].index === index) {
        this.writesHashes.delete(hashLocation(this.writes[i].index, this.writes[i].slot));

        if (i === this.writes.length - 1) this.writes = this.writes.slice(0, this.writes.length - 1);
        else this.writes[i] = this.writes.pop()!;
      }
    }

    for (let i = this.reads.length - 1; i >= 0; i--) {
      if (this.reads[i].index === index) {
        this.readsHashes.delete(hashLocation(this.reads[i].index, this.reads[i].slot));

        if (i === this.reads.length - 1) this.reads = this.reads.slice(0, this.reads.length - 1);
        else this.reads[i] = this.reads.pop()!;
      }
    }
  }

  replace(item: DFVar) {
    this.context.changed = true;

    for (const write of this.writes) {
      if (!this.context.blocks[write.index]) continue;
      const block = this.context.blocks[write.index] as OptimizationBlock<DFCodeBlock>;
      const slot = block.args.items[write.slot];

      if (slot.item.id === "var") {
        slot.item = item;
      } else if (slot.item.id === "pn_el") {
        slot.item.data.name = item.data.name;
      }

      block.symbols.delete(this);
      this.context.markSymbol("write", item, write);
    }

    for (const read of this.reads) {
      if (!this.context.blocks[read.index]) continue;
      const block = this.context.blocks[read.index] as OptimizationBlock<DFCodeBlock>;

      block.symbols.delete(this);
      block.args.items[read.slot].item = item;
      this.context.markSymbol("read", item, read);
    }

    this.writes = [];
    this.reads = [];
  }

  mark(type: "read" | "write", location: CodeBlockLocation) {
    const hash = hashLocation(location.index, location.slot);

    if (type === "read" && !this.readsHashes.has(hash)) {
      this.reads.push(location);
      this.readsHashes.add(hash);
    } else if (type === "write" && !this.writesHashes.has(hash)) {
      this.writes.push(location);
      this.writesHashes.add(hash);
    }
  }
}

//
// FUNCTION (some_output: variable, value: any)
// SET_VARIABLE:STRING(temp, value)
// SET_VARIABLE::=(some_output, temp)
// RETURN
//

export type OptimizationBlock<T extends DFBlock = DFBlock> = T & {
  symbols: Set<VariableSymbol>;
  unusedSymbols: number;
};

export class OptimizationContext {
  public changed: boolean = false;
  public blocks: (OptimizationBlock | null)[] = [];

  constructor(
    private row: OptimizerBlockRow,
    blocks: DFBlock[],
    public symbols: Record<VariableScope, Map<string, VariableSymbol>>,
  ) {
    this.blocks = blocks as any;

    for (let i = 0; i < this.blocks.length; i++) {
      this.blocks[i]!.symbols = new Set();
      this.blocks[i]!.unusedSymbols = 0;
    }
  }

  resolveFunction(name: string): DFCodeBlock | null {
    const fnBlock = this.row.optimizer.rows.find(
      (row) => row.head.id === "block" && row.head.block === "func" && row.head.data === name,
    );

    return (fnBlock?.head as DFCodeBlock) ?? null;
  }

  removeBlock(index: number) {
    if (!this.blocks[index]) return;

    this.changed = true;
    const symbols = this.blocks[index].symbols;

    this.blocks[index] = null;
    for (const symbol of symbols) symbol.untrackBlock(index);
  }

  getSymbol(item: DFVar): VariableSymbol | null {
    return this.symbols[item.data.scope].get(item.data.name) ?? null;
  }

  markSymbol(
    type: "read" | "write",
    item: DFVar | DFParameter,
    location: CodeBlockLocation,

    isParameter: boolean = false,
  ) {
    if (!this.blocks[location.index]) return;

    const scope: VariableScope = "scope" in item.data ? item.data.scope : "line";
    let symbol = this.symbols[scope].get(item.data.name);

    if (!symbol) {
      symbol = new VariableSymbol(this, scope, isParameter);
      this.symbols[scope].set(item.data.name, symbol);
    }

    this.blocks[location.index]!.symbols.add(symbol);
    symbol.mark(type, location);
  }
}

export class OptimizerBlockRow {
  constructor(
    public optimizer: Optimizer,
    public head: DFBlock,
    public body: DFBlock[],
  ) {}

  optimize(): OptimizerBlockRow {
    const passes = [new TrackVariables(), new VariableAliases(), new DeadCode()];

    const symbols: Record<VariableScope, Map<string, VariableSymbol>> = {
      unsaved: new Map(),
      saved: new Map(),
      local: new Map(),
      line: new Map(),
    };

    const context = new OptimizationContext(this, structuredClone([this.head, ...this.body]), symbols);
    context.changed = true;

    while (context.changed) {
      context.changed = false;

      for (const pass of passes) {
        for (let i = 0; i < context.blocks.length; i++) {
          if (context.blocks[i]) pass.everyBlock(context, context.blocks[i]!, i);
        }
      }

      for (const pass of passes) {
        for (const category in symbols) {
          for (const symbol of symbols[category as VariableScope].values()) {
            pass.everySymbol(context, symbol);
          }
        }
      }
    }

    const [head, ...body] = context.blocks;

    return new OptimizerBlockRow(
      this.optimizer,
      head!,
      body.filter((value) => value !== null),
    );
  }
}

export class Optimizer {
  public rows: OptimizerBlockRow[] = [];

  constructor(blocks: DFBlock[]) {
    let start: DFBlock | null = null;
    let body: DFBlock[] = [];
    for (const block of blocks) {
      if (block.id === "block") {
        if (block.block === "func" || block.block === "event") {
          if (start) this.rows.push(new OptimizerBlockRow(this, start, body));

          start = block;
          body = [];

          continue;
        }
      }

      body.push(block);
    }

    if (start) this.rows.push(new OptimizerBlockRow(this, start, body));
  }

  optimize(): DFBlock[] {
    let blocks: DFBlock[] = [];

    for (const row of this.rows) {
      const optimized = row.optimize();
      blocks.push(optimized.head, ...optimized.body);
    }

    return blocks;
  }
}
