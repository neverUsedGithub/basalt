import type { BinaryOperators } from "../../lexer";
import { TypeCheckerBoolean } from "./boolean";
import type { TypeCheckerIterable } from "./iterable";
import { TypeCheckerString } from "./string";
import type { TypeCheckerType } from "./type";
import { TypeCheckerVoid } from "./void";

export class TypeCheckerDict implements TypeCheckerType, TypeCheckerIterable {
  private valueType: TypeCheckerType = new TypeCheckerVoid();

  constructor() {}

  asString(): string {
    return `dict[${this.valueType.asString()}]`;
  }

  equals(other: TypeCheckerType) {
    return other instanceof TypeCheckerDict && this.valueType.equals(other.valueType);
  }

  getItem(item: TypeCheckerType): TypeCheckerType | null {
    return item instanceof TypeCheckerString ? this.valueType : null;
  }

  getProperty(name: string): TypeCheckerType | null {
    return this.valueType;
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

  getIteratePattern(): TypeCheckerType[] {
    return [new TypeCheckerString(), this.valueType];
  }
  
  isEmpty() {
    return this.valueType instanceof TypeCheckerVoid;
  }
}
