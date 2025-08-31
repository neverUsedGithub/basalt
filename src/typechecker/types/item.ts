import type { BinaryOperators } from "../../lexer";
import { TypeCheckerBoolean } from "./boolean";
import type { TypeCheckerType } from "./type";

export class TypeCheckerItem implements TypeCheckerType {
  private stackSize: number;

  constructor(
    private itemID: string,
    stackSize?: number,
  ) {
    this.stackSize = stackSize ?? 1;
  }

  asString(): string {
    return `item("${this.itemID}", ${this.stackSize})`;
  }

  equals(other: TypeCheckerType): boolean {
    return other instanceof TypeCheckerItem;
  }
  
  getItem(item: TypeCheckerType): TypeCheckerType | null {
    return null;
  }

  getProperty(name: string): TypeCheckerType | null {
    return null;
  }

  addGenericParameters(params: TypeCheckerType[]): { ok: true } | { ok: false; message: string } {
    return { ok: false, message: `${this.asString()} is not generic` };
  }

  execOperator(operator: BinaryOperators, rhs: TypeCheckerType): TypeCheckerType | null {
    if (operator === "==" || operator === "!=") return new TypeCheckerBoolean();
    return null;
  }
}
