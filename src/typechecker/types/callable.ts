import type { CallExpressionNode, ExpressionNode, KeywordArgumentNode, ParserNode } from "../../parser/nodes";
import type { TagsItem } from "../../actiondump";
import { TypeCheckerLiteral } from "./literal";
import type { TypeCheckerType } from "./type";
import type { BinaryOperators } from "../../lexer";
import type { Span } from "../../shared/span";
import { TypeCheckerString } from "./string";
import { TypeCheckerBoolean } from "./boolean";

export interface TypeCheckerCallableSignature {
  return: TypeCheckerType;
  params: TypeCheckerCallableParameter[];
  keywordParams: TypeCheckerCallableKeywordParam[];
}

export interface TypeCheckerCallableParameter {
  name: string;
  type: TypeCheckerType;
  variadic: boolean;
  optional: boolean;
}

export interface TypeCheckerCallableKeywordParam {
  name: string;
  type: TypeCheckerType;
  optional: boolean;
  tag?: { type: "string" | "boolean"; tag: TagsItem; values: TypeCheckerLiteral[] };
}

export interface SignatureError {
  span: Span;
  error: string;
  weight: number;
}

export class TypeCheckerCallable implements TypeCheckerType {
  constructor(
    public readonly name: string,
    public signature: TypeCheckerCallableSignature,
  ) {}

  asString(): string {
    let paramStr = "";

    for (const { name, type, optional, variadic } of this.signature.params) {
      if (paramStr.length > 0) paramStr += ", ";
      paramStr += `${variadic ? "..." : ""}${name}${optional ? "?" : ""}: ${type.asString()}`;
    }

    for (const { name, type } of this.signature.keywordParams) {
      if (paramStr.length > 0) paramStr += ", ";
      paramStr += `${name}: ${type.asString()} = ...`;
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

  findKeywordParameter(name: string): TypeCheckerCallableKeywordParam | null {
    for (const node of this.signature.keywordParams) {
      if (node.name === name) return node;
    }

    return null;
  }

  getAllKeywordArguments(): TypeCheckerCallableKeywordParam[] {
    const keywordParams: Map<string, TypeCheckerCallableKeywordParam> = new Map();

    for (const node of this.signature.keywordParams) {
      keywordParams.set(node.name, node);
    }

    return Array.from(keywordParams.values());
  }

  canCall(
    node: { span: Span; arguments: ExpressionNode[]; keywordArguments: KeywordArgumentNode[] },
    check: (node: ParserNode) => TypeCheckerType,
    skipFirst: boolean = false,
  ): { ok: true } | { ok: false; error: string; span: Span } {
    const params = skipFirst ? this.signature.params.slice(1) : this.signature.params;
    const isVariadic = params.length > 0 && params[params.length - 1].variadic;
    const minArgumentCount = params.length - params.filter((param) => param.optional).length;

    if (!isVariadic && node.arguments.length < minArgumentCount) {
      return {
        ok: false,
        error: `'${this.name}' expected at least ${minArgumentCount} arguments, but got ${node.arguments.length}`,
        span: node.span,
      };
    } else if (!isVariadic && node.arguments.length > params.length) {
      return {
        ok: false,
        error: `'${this.name}' expected at most ${params.length} arguments, but got ${node.arguments.length}`,
        span: node.span,
      };
    } else if (isVariadic && params.length - 1 > node.arguments.length) {
      return {
        ok: false,
        error: `variadic function '${this.name}' expected at least ${params.length - 1} arguments, but got ${node.arguments.length}`,
        span: node.span,
      };
    }

    for (let i = 0; i < node.arguments.length; i++) {
      const { name, type } = i >= params.length ? params[params.length - 1] : params[i];
      const checked = check(node.arguments[i]);

      if (!type.equals(checked)) {
        const prefix = isVariadic && i >= params.length ? "..." : "";

        return {
          ok: false,
          error: `'${prefix}${name}' must be of type ${type.asString()}, got ${checked.asString()}`,
          span: node.arguments[i].span,
        };
      }
    }

    const keywordParams: string[] = [];

    for (const param of node.keywordArguments) {
      const found = this.signature.keywordParams.find((par) => par.name === param.name.value);

      if (!found) {
        return {
          ok: false,
          error: `unexpected keyword argument '${param.name.value}', available keyword arguments: ${this.signature.keywordParams.map((p) => `'${p.name}'`).join(", ")}`,
          span: param.span,
        };
      }

      keywordParams.push(found.name);

      const checked = check(param.value);
      const match = found.type.equals(checked);

      if (match) continue;

      if (!found.tag) {
        return {
          ok: false,
          error: `keyword argument '${found.name}' expected type ${found.type.asString()}, but got ${checked.asString()}`,
          span: param.span,
        };
      }

      const isLiteralParam = param.value.kind === "String" || param.value.kind === "Boolean";

      const literalType =
        param.value.kind === "String"
          ? TypeCheckerLiteral.string(param.value.value.value)
          : param.value.kind === "Boolean"
            ? TypeCheckerLiteral.boolean(param.value.value.value === "true")
            : checked;

      const matchLiteral = found.type.equals(literalType);

      if (found.tag.type === "string") {
        if ((!matchLiteral && isLiteralParam) || !(checked instanceof TypeCheckerString)) {
          return {
            ok: false,
            error: `keyword argument '${found.name}' expected type ${found.type.asString()} | string, but got ${literalType.asString()}`,
            span: param.span,
          };
        }
      } else if (found.tag.type === "boolean") {
        if ((!matchLiteral && isLiteralParam) || !(checked instanceof TypeCheckerBoolean)) {
          return {
            ok: false,
            error: `keyword argument '${found.name}' expected type ${found.type.asString()} | boolean, but got ${literalType.asString()}`,
            span: param.span,
          };
        }
      }
    }

    for (const param of this.signature.keywordParams) {
      if (!keywordParams.includes(param.name) && !param.optional) {
        return {
          ok: false,
          error: `expected keyword argument ${param.name}`,
          span: node.span,
        };
      }
    }

    return { ok: true };
  }
}
