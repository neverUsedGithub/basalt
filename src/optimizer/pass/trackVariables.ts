import type { OptimizationBlock, OptimizationContext } from "..";
import type { DFBlock } from "../../diamondfire/types";
import { actionDump } from "../../actiondump";
import { OptimizationPass } from ".";

export class TrackVariables extends OptimizationPass {
  private actionDumpCodeblocks: Record<string, string> = {};

  constructor() {
    super();

    for (const codeblock of actionDump.codeblocks) {
      this.actionDumpCodeblocks[codeblock.name] = codeblock.identifier;
    }
  }

  override everyBlock(context: OptimizationContext, block: OptimizationBlock, index: number): void {
    if (block.id !== "block" || !("args" in block)) return;

    if (block.block !== "call_func") {
      for (const slot of block.args.items) {
        if (slot.item.id === "var") {
          let type: "read" | "write" = "read";

          const action = actionDump.actions.find(
            (action) => this.actionDumpCodeblocks[action.codeblockName] === block.block && action.name === block.action,
          );

          if (
            action &&
            action.icon.arguments &&
            action.icon.arguments[slot.slot] &&
            action.icon.arguments[slot.slot].type === "VARIABLE"
          ) {
            type = "write";
          }

          context.markSymbol(type, slot.item, { index, slot: slot.slot });
        } else if (slot.item.id === "pn_el") {
          context.markSymbol("write", slot.item, { index, slot: slot.slot });
        }
      }
    } else if (block.data) {
      const resolved = context.resolveFunction(block.data);
      if (!resolved) return;

      for (let slot = 0; slot < resolved.args.items.length; slot++) {
        const parameter = resolved.args.items[slot];
        const argument = block.args.items[slot];

        if (!argument || argument.item.id !== "var") continue;

        let type: "read" | "write" = "read";

        if (parameter.item.id === "pn_el" && parameter.item.data.type === "var") {
          type = "write";
        }

        context.markSymbol(type, argument.item, { index, slot: argument.slot });
      }
    }
  }
}
