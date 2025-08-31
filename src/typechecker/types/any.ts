import type { BinaryOperators } from "../../lexer";
import { TypeCheckerBoolean } from "./boolean";
import type { TypeCheckerType } from "./type";

export class TypeCheckerAny implements TypeCheckerType {
  asString(): string {
    return "any";
  }

  equals(other: TypeCheckerType): boolean {
    return true;
  }
  
  getItem(item: TypeCheckerType): TypeCheckerType | null {
    return null;
  }

  getProperty(name: string): TypeCheckerType | null {
    return new TypeCheckerAny();
  }

  addGenericParameters(params: TypeCheckerType[]): { ok: true } | { ok: false; message: string } {
    return { ok: false, message: `${this.asString()} is not generic` };
  }

  execOperator(operator: BinaryOperators, rhs: TypeCheckerType): TypeCheckerType | null {
    if (operator === "==" || operator === "!=") return new TypeCheckerBoolean();
    return new TypeCheckerAny();
  }
}
