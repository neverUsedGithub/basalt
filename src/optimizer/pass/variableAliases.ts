import { OptimizationPass } from ".";
import type { OptimizationContext, VariableSymbol } from "..";

export class VariableAliases extends OptimizationPass {
  override everySymbol(context: OptimizationContext, symbol: VariableSymbol): void {
    if (!symbol.isInlineable()) return;

    const [read] = symbol.reads;

    const block = context.blocks[read.index];

    if (!block || block.id !== "block") return;
    if (block.block !== "set_var" || block.action !== "=" || read.slot !== 1) return;

    const replacer = block.args.items[0];
    if (replacer.item.id !== "var") return;

    symbol.replace(replacer.item);
    context.removeBlock(read.index);
  }
}
