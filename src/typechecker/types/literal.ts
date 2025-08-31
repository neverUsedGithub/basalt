import type { BinaryOperators } from "../../lexer";
import type { TypeCheckerType } from "./type";

export class TypeCheckerLiteral implements TypeCheckerType {
  private constructor(
    public type: "string" | "text" | "number" | "boolean",
    public value: string | number | boolean,
  ) {}

  static text(value: string) {
    return new TypeCheckerLiteral("text", value);
  }

  static string(value: string) {
    return new TypeCheckerLiteral("string", value);
  }

  static number(value: number) {
    return new TypeCheckerLiteral("number", value);
  }

  static boolean(value: boolean) {
    return new TypeCheckerLiteral("boolean", value);
  }

  asString(): string {
    return this.type === "string" ? `'${this.value}'` : this.type === "text" ? `"${this.value}"` : `${this.value}`;
  }

  equals(other: TypeCheckerType): boolean {
    return other instanceof TypeCheckerLiteral && other.type === this.type && other.value === this.value;
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
