import { OptimizationPass } from ".";
import type { OptimizationBlock, OptimizationContext, VariableSymbol } from "..";
import type { DFBlock } from "../../diamondfire/types";
import { findEndingBracket } from "../util";

const IF_ACTIONS = ["if_variable", "if_player", "if_entity", "if_game"];

export class DeadCode extends OptimizationPass {
  override everyBlock(context: OptimizationContext, block: OptimizationBlock, index: number): void {
    if (block.id !== "block") return;

    if (IF_ACTIONS.includes(block.block)) {
      const nextBlock = context.blocks[index + 1];
      if (!nextBlock || nextBlock.id !== "bracket" || nextBlock.direct !== "open") return;
      const ending = findEndingBracket(index + 2, context.blocks, "norm");

      for (let i = index + 2; i < ending; i++) {
        if (context.blocks[i]) return;
      }

      for (let i = index; i <= ending; i++) {
        context.removeBlock(i);
      }
    }
  }

  override everySymbol(context: OptimizationContext, symbol: VariableSymbol): void {
    if (!symbol.isUnused()) return;

    for (const write of symbol.writes) {
      const writeBlock = context.blocks[write.index];
      if (!writeBlock || writeBlock.id !== "block" || writeBlock.block != "set_var") continue;

      context.removeBlock(write.index);
    }
  }
}
