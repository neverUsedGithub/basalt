import type { DFBlock, DFBracket } from "../diamondfire/types";

export function findEndingBracket(start: number, blocks: (DFBlock | null)[], type: DFBracket["type"]): number {
  const bracketStack: DFBracket["type"][] = [type];

  for (let i = start; i < blocks.length; i++) {
    const bracket = blocks[i];

    if (!bracket || bracket.id !== "bracket") continue;
    if (bracket.direct === "open") bracketStack.push(bracket.type);
    else if (bracket.direct === "close") {
      if (bracketStack.length && bracket.type === bracketStack.pop()) {
        if (!bracketStack.length) return i;
        continue;
      }

      return -1;
    }
  }

  return -1;
}
