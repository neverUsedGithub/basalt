import type { BinaryOperators } from "../../lexer";
import type { TypeCheckerType } from "./type";

export class TypeCheckerBoolean implements TypeCheckerType {
  asString(): string {
    return "boolean";
  }

  equals(other: TypeCheckerType) {
    return other instanceof TypeCheckerBoolean;
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
