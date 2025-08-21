import type { OptimizationBlock, OptimizationContext, VariableSymbol } from "..";

export abstract class OptimizationPass {
  everyBlock(context: OptimizationContext, block: OptimizationBlock, index: number): void {}
  everySymbol(context: OptimizationContext, symbol: VariableSymbol): void {}
}
