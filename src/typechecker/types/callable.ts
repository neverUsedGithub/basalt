import type { CallExpressionNode, ExpressionNode, KeywordArgumentNode, ParserNode } from "../../parser/nodes";
import type { TagsItem } from "../../../actiondump";
import type { TypeCheckerLiteral } from "./literal";
import type { TypeCheckerType } from "./type";
import type { BinaryOperators } from "../../lexer";
import type { Span } from "../../shared/span";

export interface TypeCheckerCallableSignature {
  return: TypeCheckerType;
  params: [string, TypeCheckerType][];
  keywordParams: TypeCheckerCallableKeywordParam[];
  variadic: boolean;
}

export interface TypeCheckerCallableKeywordParam {
  name: string;
  type: TypeCheckerType;
  optional: boolean;
  tag?: { tag: TagsItem; values: TypeCheckerLiteral[] };
}

export interface SignatureError {
  span: Span;
  error: string;
  weight: number;
}

export class TypeCheckerCallable implements TypeCheckerType {
  constructor(
    public readonly name: string,
    private signatures: TypeCheckerCallableSignature[],
  ) {}

  asString(): string {
    // TODO: show other signatures in asString
    const signature = this.signatures[0];
    let paramStr = "";

    for (const [name, type] of signature.params) {
      if (paramStr.length > 0) paramStr += ", ";
      paramStr += `${name}: ${type}`;
    }

    for (const { name, type } of signature.keywordParams) {
      if (paramStr.length > 0) paramStr += ", ";
      paramStr += `${name}: ${type} = ...`;
    }

    return `${this.name}(${paramStr})`;
  }

  equals(other: TypeCheckerType): boolean {
    return this === other;
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

  canCall(
    node: { span: Span; arguments: ExpressionNode[]; keywordArguments: KeywordArgumentNode[] },
    check: (node: ParserNode) => TypeCheckerType,
  ): { ok: true; signature: TypeCheckerCallableSignature } | { ok: false; error: SignatureError } {
    const errorMessages: SignatureError[] = [];

    signatureLoop: for (const sig of this.signatures) {
      if (!sig.variadic && sig.params.length !== node.arguments.length) {
        errorMessages.push({
          error: `${this.name} expected ${sig.params.length} arguments, but got ${node.arguments.length}`,
          span: node.span,
          weight: 0,
        });
        continue;
      } else if (sig.variadic && sig.params.length - 1 > node.arguments.length) {
        errorMessages.push({
          error: `variadic function ${this.name} expected at least ${sig.params.length - 1} arguments, but got ${node.arguments.length}`,
          span: node.span,
          weight: 0,
        });
        continue;
      }

      for (let i = 0; i < node.arguments.length; i++) {
        const [name, paramType] = i >= sig.params.length ? sig.params[sig.params.length - 1] : sig.params[i];
        const checked = check(node.arguments[i]);

        if (!paramType.equals(checked)) {
          const prefix = sig.variadic && i >= sig.params.length ? "..." : "";

          errorMessages.push({
            error: `${prefix}${name} must be of type ${paramType.asString()}, got ${checked.asString()}`,
            span: node.arguments[i].span,
            weight: i,
          });
          continue signatureLoop;
        }
      }

      const keywordParams: string[] = [];

      for (const param of node.keywordArguments) {
        const found = sig.keywordParams.find((par) => par.name === param.name.value);

        if (!found) {
          errorMessages.push({
            error: `unexpected keyword argument ${param.name.value}, available keyword arguments: ${sig.keywordParams.map((p) => `'${p.name}'`).join(", ")}`,
            span: param.span,
            weight: node.arguments.length + 1,
          });
          continue signatureLoop;
        }

        keywordParams.push(found.name);

        const checked = check(param.value);

        if (!found.type.equals(checked)) {
          errorMessages.push({
            error: `keyword argument ${found.name} expected type ${found.type.asString()}, but got ${checked.asString()}`,
            span: param.span,
            weight: node.arguments.length + 1,
          });
          continue signatureLoop;
        }
      }

      for (const param of sig.keywordParams) {
        if (!keywordParams.includes(param.name) && !param.optional) {
          errorMessages.push({
            error: `expected keyword argument ${param.name}`,
            span: node.span,
            weight: node.arguments.length + 1,
          });
          continue signatureLoop;
        }
      }

      return { ok: true, signature: sig };
    }
    return {
      ok: false,
      error: errorMessages.length === 1 ? errorMessages[0] : errorMessages.sort((a, b) => a.weight - b.weight)[0],
    };
  }
}
