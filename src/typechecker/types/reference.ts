import type { BinaryOperators } from "../../lexer";
import { TypeCheckerBoolean } from "./boolean";
import type { TypeCheckerType } from "./type";
import { TypeCheckerVoid } from "./void";

export class TypeCheckerReference implements TypeCheckerType {
  private valueType: TypeCheckerType = new TypeCheckerVoid();

  unwrap(): TypeCheckerType {
    return this.valueType;
  }

  asString(): string {
    return `ref[${this.valueType.asString()}]`;
  }

  equals(other: TypeCheckerType): boolean {
    return other instanceof TypeCheckerReference && this.valueType.equals(other.valueType);
  }
  
  getItem(item: TypeCheckerType): TypeCheckerType | null {
    return null;
  }

  getProperty(name: string): TypeCheckerType | null {
    return null;
  }

  addGenericParameters(params: TypeCheckerType[]): { ok: true } | { ok: false; message: string } {
    if (params.length !== 1) return { ok: false, message: `expected one generic argument` };
    this.valueType = params[0];

    return { ok: true };
  }

  execOperator(operator: BinaryOperators, rhs: TypeCheckerType): TypeCheckerType | null {
    if (operator === "==" || operator === "!=") return new TypeCheckerBoolean();
    return null;
  }
}
