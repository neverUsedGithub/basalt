import type { BinaryOperators } from "../../lexer";
import type { TypeCheckerType } from "./type";

export class TypeCheckerLiteral implements TypeCheckerType {
  constructor(private value: string | number | boolean) {}

  asString(): string {
    return typeof this.value === "string" ? `"${this.value}"` : `${this.value}`;
  }

  equals(other: TypeCheckerType): boolean {
    return other instanceof TypeCheckerLiteral && other.value === this.value;
  }

  getSymbol(name: string): TypeCheckerType | null {
    return null;
  }

  addGenericParameters(params: TypeCheckerType[]): { ok: true } | { ok: false; message: string } {
    return { ok: false, message: `${this.asString()} is not generic` };
  }
  
  execOperator(operator: BinaryOperators, rhs: TypeCheckerType): TypeCheckerType | null {
    return null;
  }
}