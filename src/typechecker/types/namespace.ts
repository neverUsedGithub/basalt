import type { BinaryOperators } from "../../lexer";
import type { TypeCheckerType } from "./type";

export class TypeCheckerNamespace implements TypeCheckerType {
  constructor(
    private name: string,
    private properties: Map<string, TypeCheckerType>,
  ) {}

  asString(): string {
    return `<namespace ${this.name}>`;
  }

  equals(other: TypeCheckerType): boolean {
    return this === other;
  }

  listSymbols(): string[] {
    return Array.from(this.properties.keys());
  }
  
  getItem(item: TypeCheckerType): TypeCheckerType | null {
    return null;
  }

  getProperty(name: string): TypeCheckerType | null {
    return this.properties.get(name) ?? null;
  }

  addGenericParameters(params: TypeCheckerType[]): { ok: true } | { ok: false; message: string } {
    return { ok: false, message: `${this.asString()} is not generic` };
  }

  execOperator(operator: BinaryOperators, rhs: TypeCheckerType): TypeCheckerType | null {
    return null;
  }
}
