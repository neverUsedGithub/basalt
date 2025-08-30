import type { BinaryOperators } from "../lexer";
import type { ParserNode, ProgramNode } from "../parser/nodes";
import type { ErrorOptions, SourceFile } from "../shared/source";
import { Span } from "../shared/span";
import * as std from "../standard";
import {
  type TypeCheckerType,
  TypeCheckerAny,
  TypeCheckerBoolean,
  TypeCheckerCallable,
  TypeCheckerDict,
  TypeCheckerList,
  TypeCheckerEvent,
  TypeCheckerNamespace,
  TypeCheckerNumber,
  TypeCheckerReference,
  TypeCheckerString,
  TypeCheckerVoid,
  TypeCheckerStyledText,
  TypeCheckerError,
} from "./types";

export type VariableScope = "@global" | "@saved" | "@thread" | "@line";

enum TypeCheckerScopeType {
  GLOBAL,
  BLOCK,
  FUNCTION,
}

type ScopeSymbolMap = Map<string, { type: TypeCheckerType; scope: VariableScope }>;

export type TypeCheckerScopeSymbols = Record<VariableScope, ScopeSymbolMap>;

export class TypeCheckerScope {
  private symbols: TypeCheckerScopeSymbols = {
    "@global": new Map(),
    "@thread": new Map(),
    "@saved": new Map(),
    "@line": new Map(),
  };

  constructor(
    private type: TypeCheckerScopeType,
    private parent: TypeCheckerScope | null,

    public readonly span: Span,
  ) {}

  addSymbol(name: string, type: TypeCheckerType, scope: VariableScope): void {
    if ((scope === "@global" || scope === "@saved" || scope === "@thread") && this.parent)
      return this.parent.addSymbol(name, type, scope);

    this.symbols[scope].set(name, { type, scope });
  }

  getSymbol(name: string, scope: VariableScope): TypeCheckerType | null {
    if (this.symbols[scope].has(name)) return this.symbols[scope].get(name)!.type;
    return this.parent ? this.parent.getSymbol(name, scope) : null;
  }

  listSymbols(): TypeCheckerScopeSymbols {
    const selfSymbols: Record<string, ScopeSymbolMap> = {};
    const parentSymbols = this.parent ? this.parent.listSymbols() : null;

    for (const name in this.symbols) {
      if (parentSymbols) {
        selfSymbols[name] = new Map([
          ...this.symbols[name as VariableScope].entries(),
          ...parentSymbols![name as VariableScope].entries(),
        ]);
      } else {
        selfSymbols[name] = new Map(this.symbols[name as VariableScope].entries());
      }
    }

    return selfSymbols as TypeCheckerScopeSymbols;
  }

  findClosest(type: TypeCheckerScopeType): TypeCheckerScope | null {
    if (this.type === type) return this;
    return this.parent ? this.parent.findClosest(type) : null;
  }
}

export class TypeCheckerFunctionScope extends TypeCheckerScope {
  private returnType: TypeCheckerType | null = null;

  setReturnType(type: TypeCheckerType): void {
    this.returnType = type;
  }

  getReturnType(): TypeCheckerType {
    return this.returnType ?? new TypeCheckerVoid();
  }
}

export class TypeChecker {
  private topScope: TypeCheckerScope;
  private typeMap: Map<ParserNode, TypeCheckerType> = new Map();
  private scopeMap: Map<ParserNode, TypeCheckerScope> = new Map();

  private errors: ErrorOptions[] = [];

  constructor(
    private source: SourceFile,
    private ast: ProgramNode,

    private mode: "strict" | "tolerant",
  ) {
    this.topScope = new TypeCheckerScope(TypeCheckerScopeType.GLOBAL, null, source.getSpan());
    this.setBuiltins(std.builtins);
  }

  getErrors(): ErrorOptions[] {
    return this.errors;
  }

  getType(node: ParserNode): TypeCheckerType | null {
    return this.typeMap.get(node) ?? null;
  }

  getScope(node: ParserNode): TypeCheckerScope | null {
    const scope = this.scopeMap.get(node);
    if (scope) return scope;

    for (const scope of this.scopeMap.values()) {
      if (scope.span.contains(node.span.start)) {
        return scope;
      }
    }

    return null;
  }

  private tryError(options: ErrorOptions): void {
    if (this.mode === "strict") this.source.error(options);
    this.errors.push(options);
  }

  private expectType<T extends new (...args: any[]) => TypeCheckerType>(
    type: TypeCheckerType,
    expected: T,
    message: string,
    span: Span,
  ): asserts type is InstanceType<T> {
    // @ts-expect-error
    if (!(type instanceof expected) && !(type instanceof TypeCheckerError)) {
      this.source.error({
        type: "Type",
        message: `${message}, but got ${(type as TypeCheckerType).asString()}`,
        span,
      });
    }
  }

  private checkNode(node: ParserNode, scope: TypeCheckerScope): TypeCheckerType {
    switch (node.kind) {
      case "ErrorNode": {
        return new TypeCheckerError();
      }

      case "Program": {
        for (const child of node.body) this.check(child, scope);

        return new TypeCheckerVoid();
      }

      case "Event": {
        const checked = this.check(node.event, scope);

        this.expectType(checked, TypeCheckerEvent, "expected an event type", node.event.span);
        this.check(node.body, scope);

        return new TypeCheckerVoid();
      }

      case "Using": {
        const namespace = this.topScope.getSymbol(node.namespace.value, "@global");

        if (namespace === null) {
          this.tryError({
            type: "Type",
            message: `namespace '${node.namespace.value}' hasn't been defined`,
            span: node.namespace.span,
          });

          return new TypeCheckerError();
        }

        if (!(namespace instanceof TypeCheckerNamespace)) {
          this.tryError({
            type: "Type",
            message: `'${namespace}' is not a namespace`,
            span: node.namespace.span,
          });

          return new TypeCheckerError();
        }

        const value = namespace.getSymbol(node.name.value);

        if (value === null) {
          this.tryError({
            type: "Type",
            message: `namespace '${node.namespace.value}' has no member '${node.name.value}'`,
            span: node.name.span,
          });

          return new TypeCheckerError();
        }

        this.topScope.addSymbol(node.name.value, value, "@global");

        return new TypeCheckerVoid();
      }

      case "Block": {
        const inner = new TypeCheckerScope(TypeCheckerScopeType.BLOCK, scope, node.span);
        for (const child of node.body) this.check(child, inner);

        return new TypeCheckerVoid();
      }

      case "NamespaceGetProperty": {
        const namesp = this.check(node.namespace, scope);
        this.expectType(namesp, TypeCheckerNamespace, "expected a namespace", node.namespace.span);
        if (node.property.kind === "ErrorNode") return new TypeCheckerError();

        const propertyName = node.property.kind === "Identifier" ? node.property.name.value : node.property.value.value;
        const value = namesp.getSymbol(propertyName);

        if (value === null) {
          this.tryError({
            type: "Type",
            message: `${namesp.asString()} has no member '${propertyName}'`,
            span: node.property.span,
          });

          return new TypeCheckerError();
        }

        return value;
      }

      case "VariableNode": {
        const data = scope.getSymbol(node.name.value, node.scope.value as VariableScope);

        if (!data) {
          this.tryError({
            type: "Type",
            message: `couldn't resolve variable '${node.name.value}' with scope ${node.scope.value}`,
            span: node.span,
          });

          return new TypeCheckerError();
        }

        return data;
      }

      case "Identifier": {
        const data = scope.getSymbol(node.name.value, "@global");

        if (!data) {
          this.tryError({
            type: "Type",
            message: `couldn't resolve global variable '${node.name.value}', maybe you forgot a variable scope?`,
            span: node.name.span,
          });

          return new TypeCheckerError();
        }

        return data;
      }

      case "VariableDefinition": {
        const explicitType = node.type ? this.check(node.type, scope) : null;
        const valueType = node.value ? this.check(node.value, scope) : null;

        if (explicitType && valueType && !(valueType instanceof TypeCheckerAny) && !explicitType.equals(valueType)) {
          this.tryError({
            type: "Type",
            message: `type '${valueType.asString()}' cannot be assigned to a variable with type '${explicitType.asString()}'`,
            span: node.value!.span,
          });

          return new TypeCheckerError();
        }

        const checkType = (explicitType ?? valueType)!;

        if (checkType instanceof TypeCheckerVoid) {
          this.tryError({ type: "Type", message: `cannot assign void to variable`, span: node.span });

          return new TypeCheckerError();
        }

        scope.addSymbol(node.name.name.value, checkType, node.name.scope.value as VariableScope);

        return new TypeCheckerVoid();
      }

      case "String": {
        return new TypeCheckerString();
      }

      case "StyledText": {
        return new TypeCheckerStyledText();
      }

      case "Boolean": {
        return new TypeCheckerBoolean();
      }

      case "ReferenceExpression": {
        const symbol = scope.getSymbol(node.name.name.value, node.name.scope.value as VariableScope);

        if (symbol === null) {
          this.tryError({
            type: "Type",
            message: `variable '${node.name.name.value}' hasn't been defined`,
            span: node.name.span,
          });

          return new TypeCheckerError();
        }

        const type = new TypeCheckerReference();
        type.addGenericParameters([symbol]);

        return type;
      }

      case "TypeName": {
        const name = node.name.value;

        switch (name) {
          case "number":
            return new TypeCheckerNumber();

          case "string":
            return new TypeCheckerString();

          case "dict":
            return new TypeCheckerDict();

          case "list":
            return new TypeCheckerList();

          case "any":
            return new TypeCheckerAny();

          case "void":
            return new TypeCheckerVoid();

          case "text":
            return new TypeCheckerStyledText();

          case "boolean":
            return new TypeCheckerBoolean();
        }

        this.source.error({
          type: "Type",
          message: `unimplemented typename '${name}'`,
          span: node.name.span,
        });
      }

      case "ParameterizedType": {
        const type = this.check(node.name, scope);
        const parameters: TypeCheckerType[] = [];

        for (const param of node.parameters) parameters.push(this.check(param, scope));

        const res = type.addGenericParameters(parameters);

        if (!res.ok) {
          this.source.error({
            type: "Type",
            message: res.message,
            span: node.span,
          });
        }

        return type;
      }

      case "Number": {
        return new TypeCheckerNumber();
      }

      case "ExpressionStatement": {
        return this.check(node.expression, scope);
      }

      case "TypeCast": {
        this.check(node.expression, scope);
        return this.check(node.type, scope);
      }

      case "CallExpression": {
        const fn = this.check(node.expression, scope);
        this.expectType(fn, TypeCheckerCallable, "expected a callable expression", node.expression.span);

        const res = fn.canCall(node, (node) => this.check(node, scope));

        if (!res.ok) {
          this.tryError({
            type: "Type",
            message: res.error.error,
            span: res.error.span,
          });

          return new TypeCheckerError();
        }

        return res.signature.return;
      }

      case "AssignmentExpression": {
        const lhs = this.check(node.expression, scope);
        const rhs = this.check(node.value, scope);

        if (!lhs.equals(rhs)) {
          this.tryError({
            type: "Type",
            message: `type '${rhs.asString()}' is not assignable to type '${lhs.asString()}'`,
            span: node.span,
          });

          return new TypeCheckerError();
        }

        return lhs;
      }

      case "ReturnStatement": {
        const fnScope = scope.findClosest(TypeCheckerScopeType.FUNCTION);

        if (!fnScope || !(fnScope instanceof TypeCheckerFunctionScope))
          this.source.error({ type: "Type", message: `cannot return from this scope`, span: node.span });

        const returnType = fnScope.getReturnType();

        if (!returnType.equals(this.check(node.value, scope))) {
          this.source.error({
            type: "Type",
            message: `cannot return this type of expression`,
            span: node.span,
          });
        }

        return new TypeCheckerVoid();
      }

      case "IfActionStatement": {
        if (node.category === null || node.action === null || node.block === null) return new TypeCheckerError();

        const conditionTypes = std.conditions[`if_${node.category.value}`];
        const conditionCallable = conditionTypes.get(node.action.value);

        if (conditionCallable === undefined) {
          this.tryError({
            type: "Type",
            message: `cannot find conditional action '${node.action.value}' in category ${node.action.value}`,
            span: node.action.span,
          });

          return new TypeCheckerError();
        }

        const result = conditionCallable.canCall(node, (node) => this.check(node, scope));

        if (!result.ok) {
          this.tryError({
            type: "Type",
            message: result.error.error,
            span: result.error.span,
          });

          return new TypeCheckerError();
        }

        this.check(node.block, scope);

        return conditionCallable;
      }

      case "BinaryExpression": {
        const lhs = this.check(node.lhs, scope);
        const rhs = this.check(node.rhs, scope);

        const result = lhs.execOperator(node.operator.value as BinaryOperators, rhs);

        if (!result) {
          this.source.error({
            type: "Parser",
            message: `unsupported operands for '${node.operator.value}': '${lhs.asString()}' and '${rhs.asString()}'`,
            span: node.operator.span,
          });
        }

        return result;
      }

      case "IfExpressionStatement": {
        if (!node.expression) return new TypeCheckerError();
        this.check(node.expression, scope);
        return new TypeCheckerVoid();
      }

      case "FunctionDefinition": {
        const inner = new TypeCheckerFunctionScope(TypeCheckerScopeType.FUNCTION, scope, node.body.span);
        const returnType = this.check(node.returnType, inner);
        const parameters: [string, TypeCheckerType][] = [];

        inner.setReturnType(returnType);

        for (const param of node.parameters) {
          const pType = this.check(param.type, inner);

          parameters.push([param.name.value, pType]);
          inner.addSymbol(param.name.value, pType, "@line");
        }

        this.check(node.body, inner);

        this.topScope.addSymbol(
          node.name.value,
          new TypeCheckerCallable(node.name.value, [
            {
              params: parameters,
              keywordParams: [],
              variadic: false,
              return: returnType,
            },
          ]),
          "@global",
        );

        return new TypeCheckerVoid();
      }

      case "TargetExpression": {
        return this.check(node.expression, scope);
      }

      case "TargetStatement": {
        this.check(node.statement, scope);
        return new TypeCheckerVoid();
      }

      default: {
        this.source.error({
          type: "Type",
          message: `unimplemented node '${node.kind}'`,
          span: node.span,
        });
      }
    }
  }

  private check(node: ParserNode, scope: TypeCheckerScope): TypeCheckerType {
    const type = this.checkNode(node, scope);

    this.scopeMap.set(node, scope);
    this.typeMap.set(node, type);

    return type;
  }

  setBuiltins(builtins: Record<string, TypeCheckerType>) {
    for (const name in builtins) this.topScope.addSymbol(name, builtins[name], "@global");
  }

  checkProgram() {
    this.check(this.ast, this.topScope);
  }
}
