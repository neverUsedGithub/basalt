import type { BinaryOperators } from "../../lexer";
import type { TypeCheckerType } from "./type";

export class TypeCheckerVoid implements TypeCheckerType {
  asString(): string {
    return "void";
  }

  equals(other: TypeCheckerType) {
    return other instanceof TypeCheckerVoid;
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
    return null;
  }
}
