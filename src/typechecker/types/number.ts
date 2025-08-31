import type { BinaryOperators } from "../../lexer";
import { TypeCheckerBoolean } from "./boolean";
import type { TypeCheckerType } from "./type";

export class TypeCheckerNumber implements TypeCheckerType {
  asString(): string {
    return "number";
  }

  equals(other: TypeCheckerType) {
    return other instanceof TypeCheckerNumber;
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
    if (!(rhs instanceof TypeCheckerNumber)) return null;
    if (operator === "==" || operator === "!=") return new TypeCheckerBoolean();
    if (operator === "<" || operator === ">" || operator === "<=" || operator === ">=") return new TypeCheckerBoolean();
    if (operator === "+" || operator === "-" || operator === "*" || operator === "/" || operator === "%")
      return new TypeCheckerNumber();

    return null;
  }
}
