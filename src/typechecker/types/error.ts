import type { BinaryOperators } from "../../lexer";
import { TypeCheckerBoolean } from "./boolean";
import type { TypeCheckerType } from "./type";

export class TypeCheckerError implements TypeCheckerType {
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
    return new TypeCheckerError();
  }

  addGenericParameters(params: TypeCheckerType[]): { ok: true } | { ok: false; message: string } {
    return { ok: true };
  }

  execOperator(operator: BinaryOperators, rhs: TypeCheckerType): TypeCheckerType | null {
    return new TypeCheckerError();
  }
}
