import type { BinaryOperators } from "../../lexer";

export interface TypeCheckerType {
  asString(): string;
  equals(other: TypeCheckerType): boolean;
  getSymbol(name: string): TypeCheckerType | null;
  execOperator(operator: BinaryOperators, rhs: TypeCheckerType): TypeCheckerType | null;
  addGenericParameters(params: TypeCheckerType[]): { ok: true } | { ok: false; message: string };
}
