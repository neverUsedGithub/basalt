import type { BinaryOperators } from "../../lexer";
import { TypeCheckerBoolean } from "./boolean";
import type { TypeCheckerType } from "./type";

export class TypeCheckerUnion implements TypeCheckerType {
  constructor(public types: TypeCheckerType[]) {}

  asString(): string {
    return this.types.map((type) => type.asString()).join(" | ");
  }

  equals(other: TypeCheckerType): boolean {
    return this.types.some((type) => type.equals(other));
  }

  getSymbol(name: string): TypeCheckerType | null {
    return this.types.find((type) => type.getSymbol(name)) ?? null;
  }

  addGenericParameters(params: TypeCheckerType[]): { ok: true } | { ok: false; message: string } {
    return { ok: false, message: `${this.asString()} is not generic` };
  }

  execOperator(operator: BinaryOperators, rhs: TypeCheckerType): TypeCheckerType | null {
    if (operator === "==" || operator === "!=") return new TypeCheckerBoolean();
    const types = this.types.map((type) => type.execOperator(operator, rhs)).filter((type) => type !== null);
    return types.length === 0 ? null : new TypeCheckerUnion(types);
  }
}
