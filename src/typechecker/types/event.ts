import type { BinaryOperators } from "../../lexer";
import type { TypeCheckerType } from "./type";

export class TypeCheckerEvent implements TypeCheckerType {
  constructor(
    public name: string,
    public id: string,
    public dfName: string,
    public dfId: string,
    public docs: string,
  ) {}

  asString(): string {
    return `<event ${this.name}>`;
  }

  equals(other: TypeCheckerType): boolean {
    return other instanceof TypeCheckerEvent && other.name === this.name && other.id === this.id;
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
