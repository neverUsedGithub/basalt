import type { GameValueItem } from "../../standard";
import { TypeCheckerNamespace } from "./namespace";
import type { TypeCheckerType } from "./type";

export class TypeCheckerGameValues extends TypeCheckerNamespace {
  constructor(private gameValues: Map<string, GameValueItem>) {
    const builtMap = new Map<string, TypeCheckerType>();
    for (const [key, value] of gameValues) builtMap.set(key, value.type);
    super("game_values", builtMap);
  }

  getGameValue(name: string): GameValueItem | null {
    return this.gameValues.get(name) ?? null;
  }
}
