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
  
  getItem(item: TypeCheckerType): TypeCheckerType | null {
    const match = this.types.map((type) => type.getItem(item)).filter(it => it !== null);
    if (match.length === 0) return null;
    if (match.length > 1) return new TypeCheckerUnion(match);
    return match[0];
  }

  getProperty(name: string): TypeCheckerType | null {
    const match = this.types.map((type) => type.getProperty(name)).filter(it => it !== null);
    if (match.length === 0) return null;
    if (match.length > 1) return new TypeCheckerUnion(match);
    return match[0];
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
