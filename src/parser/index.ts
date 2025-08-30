import { Token, TokenType, type Lexer } from "../lexer";
import { SourceError, type ErrorOptions, type SourceFile } from "../shared/source";
import { Span } from "../shared/span";
import type {
  BlockNode,
  CallExpressionNode,
  EventNode,
  ExpressionNode,
  FunctionDefinitionNode,
  IdentifierNode,
  KeywordArgumentNode,
  NumberNode,
  ParameterizedTypeNode,
  ProgramNode,
  ReferenceExpressionNode,
  ReturnStatementNode,
  SpecialNode,
  StatementNode,
  StringNode,
  TypeNameNode,
  TypeNode,
  UsingNode,
  VariableDefinitionNode,
  IfActionStatementNode,
  IfExpressionStatementNode,
  VariableNode,
  TargetExpressionNode,
  TargetStatementNode,
  ErrorNode,
  ParserNode,
  StyledTextNode,
  ForStatementNode,
} from "./nodes";

const OPERATOR_PRECEDENCE = {
  "::": 13,
  call: 12,
  prop: 11,
  as: 10,
  "+=": 9,
  "-=": 9,
  "*=": 9,
  "/=": 9,
  "=": 9,
  ".": 7,
  "<": 6,
  ">": 6,
  "<=": 6,
  ">=": 6,
  "==": 6,
  "!=": 6,
};

const CONDITION_OPERATORS = ["<", ">", "<=", ">=", "==", "!="];

export const IF_CATEGORIES = ["player", "entity", "game", "variable"];

function noop() {}

export class Parser {
  private pointer: number = 0;
  private tokens: Token[] = [];
  private current: Token;
  private onNode: (node: ParserNode) => void;

  private errors: ErrorOptions[] = [];

  constructor(
    private source: SourceFile,
    private lexer: Lexer,
    private mode: "strict" | "tolerant",
    onNode: null | ((node: ParserNode) => void),
  ) {
    this.current = lexer.next();
    this.tokens.push(this.current);
    this.onNode = onNode ?? noop;
  }

  getErrors(): ErrorOptions[] {
    return this.errors;
  }

  private error(options: ErrorOptions): never;
  private error(options: ErrorOptions, passable: true): void;
  private error(options: ErrorOptions, passable?: boolean): void | never {
    if (this.mode === "strict" || !passable) this.source.error(options);
    this.errors.push(options);
  }

  private addEatError(type: TokenType, value?: string) {
    this.errors.push({
      type: "Parser",
      span: this.current.span,
      message: this.formatExpected(type, value),
    });
  }

  private eatStatementEnd(type: TokenType, value?: string) {
    if (this.mode === "strict" || this.is(type, value) || !this.is(TokenType.NEWLINE)) {
      this.eat(type, value);
    } else {
      this.addEatError(type, value);
    }
  }

  private unadvance() {
    this.current = this.tokens[--this.pointer];
  }

  private advance() {
    if (this.pointer + 1 >= this.tokens.length) this.tokens.push(this.lexer.next());
    this.current = this.tokens[++this.pointer];
  }

  private lookahead(): Token {
    if (this.pointer + 1 < this.tokens.length) return this.tokens[this.pointer + 1];
    const next = this.lexer.next();
    this.tokens.push(next);

    return next;
  }

  private make<T extends ParserNode>(node: T): T {
    this.onNode(node);
    return node;
  }

  private is(type: TokenType, value?: string) {
    if (this.current.type !== type) return false;
    if (value && this.current.value !== value) return false;

    return true;
  }

  private isLookahead(type: TokenType, value?: string) {
    if (this.lookahead().type !== type) return false;
    if (value && this.lookahead().value !== value) return false;

    return true;
  }

  private skipNewlines() {
    while (this.is(TokenType.NEWLINE)) this.eat(TokenType.NEWLINE);
  }

  private formatExpected(type: TokenType, value?: string): string {
    const currentValue = this.current.type === TokenType.NEWLINE ? "newline" : `token '${this.current.value}'`;
    return `unexpected ${currentValue} (${this.current.type}) expected ${value ? `'${value}' (${type})` : type}`;
  }

  private eat<T extends TokenType>(type: T, value?: string): Token<T> {
    if (!this.is(type, value)) {
      this.error({
        type: "Parser",
        message: this.formatExpected(type, value),
        span: this.current.span,
      });
    }

    const curr = this.current;
    this.advance();

    return curr as any;
  }

  private pIdentifier(): IdentifierNode {
    const token = this.eat(TokenType.IDENTIFIER);

    return this.make({
      kind: "Identifier",
      name: token,
      span: token.span,
    });
  }

  private pNumber(): NumberNode {
    const token = this.eat(TokenType.NUMBER);

    return this.make({
      kind: "Number",
      value: token,
      span: token.span,
    });
  }

  private pString(): StringNode {
    const token = this.eat(TokenType.STRING);

    return this.make({
      kind: "String",
      value: token,
      span: token.span,
    });
  }

  private pStyledText(): StyledTextNode {
    const token = this.eat(TokenType.STYLED_TEXT);

    return this.make({
      kind: "StyledText",
      value: token,
      span: token.span,
    });
  }

  private pTypeNameNode(): TypeNameNode {
    const token = this.eat(TokenType.TYPENAME);

    return this.make({
      kind: "TypeName",
      name: token,
      span: token.span,
    });
  }

  private pTypeNode(): TypeNode {
    let ident: IdentifierNode | TypeNameNode;

    if (this.is(TokenType.TYPENAME)) ident = this.pTypeNameNode();
    else if (this.is(TokenType.IDENTIFIER)) ident = this.pIdentifier();
    else {
      this.error({
        type: "Parser",
        message: `expected an identifier or a typename`,
        span: this.current.span,
      });
    }

    if (this.is(TokenType.DELIMITER, "[")) {
      const parameters: ParameterizedTypeNode["parameters"] = [];

      this.eat(TokenType.DELIMITER, "[");
      while (!this.is(TokenType.DELIMITER, "]")) {
        if (parameters.length > 0) this.eat(TokenType.COMMA);
        parameters.push(this.pTypeNode());
      }

      const end = this.eat(TokenType.DELIMITER, "]");

      return this.make({
        kind: "ParameterizedType",
        name: ident,
        parameters,
        span: new Span(ident.span.start, end.span.end),
      });
    }

    return ident;
  }

  private pBoolean(): ExpressionNode {
    const token = this.eat(TokenType.KEYWORD);

    return this.make({
      kind: "Boolean",
      value: token,
      span: token.span,
    });
  }

  private pReference(): ReferenceExpressionNode {
    const token = this.eat(TokenType.KEYWORD, "ref");
    const name = this.pVariable();

    return this.make({
      kind: "ReferenceExpression",
      name,
      span: new Span(token.span.start, name.span.end),
    });
  }

  private pVariable(): VariableNode {
    const scope = this.eat(TokenType.SCOPE);
    const name = this.is(TokenType.IDENTIFIER) ? this.eat(TokenType.IDENTIFIER) : this.eat(TokenType.STRING);

    return this.make({
      kind: "VariableNode",
      name,
      scope,
      span: new Span(scope.span.start, name.span.end),
    });
  }

  private pTargetExpression(): TargetExpressionNode {
    const target = this.eat(TokenType.TARGET);
    const expression = this.pExpression();

    return this.make({
      kind: "TargetExpression",
      expression,
      target,
      span: new Span(target.span.start, expression.span.end),
    });
  }

  private pAtomic(): ExpressionNode {
    if (this.is(TokenType.KEYWORD, "true") || this.is(TokenType.KEYWORD, "false")) return this.pBoolean();
    if (this.is(TokenType.IDENTIFIER)) return this.pIdentifier();
    if (this.is(TokenType.KEYWORD, "ref")) return this.pReference();
    if (this.is(TokenType.TARGET)) return this.pTargetExpression();
    if (this.is(TokenType.SCOPE)) return this.pVariable();
    if (this.is(TokenType.NUMBER)) return this.pNumber();
    if (this.is(TokenType.STRING)) return this.pString();
    if (this.is(TokenType.STYLED_TEXT)) return this.pStyledText();

    this.error(
      {
        type: "Parser",
        message: "expected an expression",
        span: this.current.span,
      },
      true,
    );

    return this.make({
      kind: "ErrorNode",
      span: this.current.span,
    });
  }

  private pExpressionIsOperator(): boolean {
    return this.is(TokenType.OPERATOR) || this.is(TokenType.DELIMITER, "(") || this.is(TokenType.DELIMITER, "[");
  }

  private pExpressionGetPrecedence(): number {
    if (this.is(TokenType.OPERATOR)) return OPERATOR_PRECEDENCE[this.current.value as keyof typeof OPERATOR_PRECEDENCE];
    if (this.is(TokenType.DELIMITER, "(")) return OPERATOR_PRECEDENCE.call;
    if (this.is(TokenType.DELIMITER, "[")) return OPERATOR_PRECEDENCE.prop;

    throw "UNREACHABLE";
  }

  private pFunctionCall(): { args: CallExpressionNode["arguments"]; keywordArgs: KeywordArgumentNode[] } {
    const args: CallExpressionNode["arguments"] = [];
    const keywordArgs: KeywordArgumentNode[] = [];

    this.skipNewlines();

    while (!this.is(TokenType.DELIMITER, ")")) {
      if (args.length > 0 || keywordArgs.length > 0) this.eat(TokenType.COMMA);
      this.skipNewlines();

      if (this.is(TokenType.IDENTIFIER) && this.isLookahead(TokenType.OPERATOR, "=")) {
        const name = this.eat(TokenType.IDENTIFIER);
        this.eat(TokenType.OPERATOR, "=");
        const value = this.pExpression();

        keywordArgs.push(
          this.make({
            kind: "KeywordArgument",
            name,
            value,
            span: new Span(name.span.start, value.span.end),
          }),
        );
      } else {
        args.push(this.pExpression());
      }

      this.skipNewlines();
    }

    return { args, keywordArgs };
  }

  private pExpressionInner(lhs: ExpressionNode, minPrecedence: number): ExpressionNode {
    while (this.pExpressionIsOperator() && this.pExpressionGetPrecedence() >= minPrecedence) {
      const opPrecedence = this.pExpressionGetPrecedence();

      if (this.is(TokenType.DELIMITER, "(")) {
        this.eat(TokenType.DELIMITER, "(");

        const { args, keywordArgs } = this.pFunctionCall();
        const end = this.eat(TokenType.DELIMITER, ")").span.end;

        lhs = this.make({
          kind: "CallExpression",
          arguments: args,
          expression: lhs,
          keywordArguments: keywordArgs,
          span: new Span(lhs.span.start, end),
        });

        continue;
      }

      if (this.is(TokenType.DELIMITER, "[")) {
        this.eat(TokenType.DELIMITER, "[");
        this.eat(TokenType.DELIMITER, "[");
        const key = this.pExpression();
        const end = this.eat(TokenType.DELIMITER, "]");

        lhs = this.make({
          kind: "PropertyAccess",
          object: lhs,
          property: key,
          computed: true,
          span: new Span(lhs.span.start, end.span.end),
        });

        continue;
      }

      const operator = this.eat(TokenType.OPERATOR);
      let rhs: ExpressionNode;

      if (operator.value === "::" && (this.is(TokenType.KEYWORD) || this.is(TokenType.TYPENAME))) {
        const keyw = this.eat(this.current.type);

        rhs = this.make({
          kind: "Identifier",
          name: keyw,
          span: keyw.span,
        });
      } else if (operator.value === "as") {
        rhs = this.pTypeNode() as ExpressionNode;
      } else {
        rhs = this.pAtomic();
      }

      while (this.pExpressionIsOperator() && this.pExpressionGetPrecedence() > opPrecedence) {
        rhs = this.pExpressionInner(rhs, opPrecedence + 1);
      }

      if (
        operator.value === "=" ||
        operator.value === "+=" ||
        operator.value === "-=" ||
        operator.value === "*=" ||
        operator.value === "/="
      ) {
        if (lhs.kind !== "Identifier" && lhs.kind !== "VariableNode" && lhs.kind !== "PropertyAccess") {
          this.error({
            type: "Parser",
            message: `cannot assign to this type of expression`,
            span: lhs.span,
          });
        }

        lhs = this.make({
          kind: "AssignmentExpression",
          expression: lhs,
          operator,
          value: rhs,
          span: new Span(lhs.span.start, rhs.span.end),
        });

        continue;
      }

      if (operator.value === ".") {
        if (rhs.kind !== "Identifier")
          this.error({
            type: "Parser",
            message: `invalid syntax`,
            span: rhs.span,
          });

        lhs = this.make({
          kind: "PropertyAccess",
          object: lhs,
          property: rhs,
          computed: false,
          span: new Span(lhs.span.start, rhs.span.end),
        });

        continue;
      }

      if (operator.value === "as") {
        lhs = this.make({
          kind: "TypeCast",
          expression: lhs,
          type: rhs as TypeNode,
          span: new Span(lhs.span.start, rhs.span.end),
        });

        continue;
      }

      if (operator.value === "::") {
        if (lhs.kind !== "Identifier" && lhs.kind !== "NamespaceGetProperty") {
          this.error({
            type: "Parser",
            message: `cannot access members of this expression`,
            span: lhs.span,
          });
        }

        if (rhs.kind !== "Identifier" && rhs.kind !== "String" && rhs.kind !== "ErrorNode") {
          this.error({
            type: "Parser",
            message: `expected an identifier or string`,
            span: rhs.span,
          });
        }

        lhs = this.make({
          kind: "NamespaceGetProperty",
          namespace: lhs,
          property: rhs,
          span: new Span(lhs.span.start, rhs.span.end),
        });

        continue;
      }

      lhs = this.make({
        kind: "BinaryExpression",
        operator,
        lhs,
        rhs,
        span: new Span(lhs.span.start, rhs.span.end),
      });
    }

    return lhs;
  }

  private pExpression(): ExpressionNode {
    return this.pExpressionInner(this.pAtomic(), 0);
  }

  private pVariableDefinition(): VariableDefinitionNode {
    const start = this.eat(TokenType.KEYWORD, "let");
    const name = this.pVariable();

    let type: VariableDefinitionNode["type"] = undefined;
    let value: VariableDefinitionNode["value"] = undefined;

    if (this.is(TokenType.COLON)) {
      this.eat(TokenType.COLON);
      type = this.pTypeNode();
    }

    if (!type || this.is(TokenType.OPERATOR, "=")) {
      this.eat(TokenType.OPERATOR, "=");
      value = this.pExpression();
    }

    this.eatStatementEnd(TokenType.SEMICOLON);

    return this.make({
      kind: "VariableDefinition",
      name,
      type,
      value,
      span: new Span(start.span.start, value ? value.span.end : type!.span.end),
    });
  }

  private pReturnStatement(): ReturnStatementNode {
    const start = this.eat(TokenType.KEYWORD, "return").span.start;
    const value = this.pExpression();

    const node: ReturnStatementNode = this.make({
      kind: "ReturnStatement",
      value,
      span: new Span(start, value.span.end),
    });

    this.eat(TokenType.SEMICOLON);

    return node;
  }

  private pIfStatement(): IfExpressionStatementNode | IfActionStatementNode {
    const start = this.eat(TokenType.KEYWORD, "if").span.start;

    if (this.is(TokenType.KEYWORD) || !this.is(TokenType.DELIMITER, "(")) {
      if (this.mode === "tolerant" && !this.is(TokenType.KEYWORD)) {
        this.error(
          {
            type: "Parser",
            message: `expected a category or (`,
            span: this.current.span,
          },
          true,
        );

        return this.make({
          kind: "IfActionStatement",

          block: null,
          action: null,
          category: null,
          arguments: [],
          keywordArguments: [],

          span: new Span(start, this.current.span.end),
        });
      }

      let category: Token | null = this.eat(TokenType.KEYWORD);
      let action: Token | null = null;

      let end = category.span.end;

      if (this.is(TokenType.IDENTIFIER)) {
        action = this.eat(TokenType.IDENTIFIER);
        end = action.span.end;
      } else {
        this.error(
          {
            type: "Parser",
            message: `expected an action from category '${category.value}'`,
            span: this.current.span,
          },
          true,
        );
      }

      if (!IF_CATEGORIES.includes(category.value)) {
        this.error(
          {
            type: "Parser",
            message: `invalid if category '${category.value}'`,
            span: category.span,
          },
          true,
        );

        category = null;
      }

      let args: ExpressionNode[] = [];
      let keywordArgs: KeywordArgumentNode[] = [];

      if (this.mode === "strict" || this.is(TokenType.DELIMITER, "(")) {
        this.eat(TokenType.DELIMITER, "(");
        const fnCall = this.pFunctionCall();
        end = this.eat(TokenType.DELIMITER, ")").span.end;

        args = fnCall.args;
        keywordArgs = fnCall.keywordArgs;
      } else {
        this.addEatError(TokenType.DELIMITER, "(");
      }

      let block: BlockNode | null = null;

      if (this.mode === "strict" || this.is(TokenType.DELIMITER, "{")) {
        block = this.pBlock();
        end = block.span.end;
      } else {
        this.addEatError(TokenType.DELIMITER, "{");
      }

      return this.make({
        kind: "IfActionStatement",
        action,
        category,
        arguments: args,
        keywordArguments: keywordArgs,
        block,
        span: new Span(start, end),
      });
    }

    this.eat(TokenType.DELIMITER, "(");

    const expression = this.pExpression();
    let end = expression.span.end;

    if (expression.kind !== "BinaryExpression" || !CONDITION_OPERATORS.includes(expression.operator.value)) {
      if (expression.kind !== "Identifier" && expression.kind !== "VariableNode") {
        this.error(
          {
            type: "Parser",
            message: `expected a comparison expression`,
            span: expression.span,
          },
          true,
        );
      }
    }

    if (this.mode === "tolerant" && !this.is(TokenType.DELIMITER, ")")) {
      this.addEatError(TokenType.DELIMITER, ")");
    } else {
      end = this.eat(TokenType.DELIMITER, ")").span.end;
    }

    let block: BlockNode | null = null;

    if (this.mode === "strict" || this.is(TokenType.DELIMITER, "{")) {
      block = this.pBlock();
      end = block.span.end;
    } else {
      this.addEatError(TokenType.DELIMITER, "{");
    }

    return this.make({
      kind: "IfExpressionStatement",
      expression,
      block,
      span: new Span(start, end),
    });
  }

  private pTargetStatement(): TargetStatementNode {
    const target = this.eat(TokenType.TARGET);
    const statement = this.pStatement();

    return this.make({
      kind: "TargetStatement",
      target,
      statement,
      span: new Span(target.span.start, statement.span.end),
    });
  }

  private pForStatement(): ForStatementNode {
    const start = this.eat(TokenType.KEYWORD, "for").span.start;
    const pattern: VariableNode[] = [];

    do {
      if (pattern.length > 0) this.eat(TokenType.COMMA);
      pattern.push(this.pVariable());

      if (this.is(TokenType.KEYWORD, "in") || this.is(TokenType.KEYWORD, "to")) break;
    } while (true);

    const type = this.is(TokenType.KEYWORD, "in")
      ? this.eat(TokenType.KEYWORD, "in")
      : this.eat(TokenType.KEYWORD, "to");

    const expression = this.pExpression();
    const block = this.pBlock();

    return this.make({
      kind: "ForStatement",
      type: type.value as "in" | "to",
      expression,
      pattern,
      block,
      span: new Span(start, block.span.end)
    });
  }

  private pStatement(): StatementNode {
    if (this.is(TokenType.KEYWORD, "return")) return this.pReturnStatement();
    if (this.is(TokenType.KEYWORD, "let")) return this.pVariableDefinition();
    if (this.is(TokenType.KEYWORD, "for")) return this.pForStatement();
    if (this.is(TokenType.KEYWORD, "if")) return this.pIfStatement();
    if (this.is(TokenType.TARGET)) return this.pTargetStatement();
    if (this.is(TokenType.DELIMITER, "{")) return this.pBlock();

    const expr = this.pExpression();
    this.eatStatementEnd(TokenType.SEMICOLON);

    return this.make({
      kind: "ExpressionStatement",
      expression: expr,
      span: expr.span,
    });
  }

  private pBlock(): BlockNode {
    const start = this.eat(TokenType.DELIMITER, "{").span.start;
    const body: BlockNode["body"] = [];

    while (!this.is(TokenType.DELIMITER, "}")) {
      while (this.is(TokenType.SEMICOLON) || this.is(TokenType.NEWLINE)) this.advance();
      if (this.is(TokenType.DELIMITER, "}")) break;

      body.push(this.pStatement());
    }

    const end = this.eat(TokenType.DELIMITER, "}").span.end;

    return this.make({
      kind: "Block",
      body,
      span: new Span(start, end),
    });
  }

  private pUsing(): UsingNode {
    const start = this.eat(TokenType.KEYWORD, "using");
    const namespace = this.eat(TokenType.IDENTIFIER);
    this.eat(TokenType.OPERATOR, "::");
    const name = this.eat(TokenType.IDENTIFIER);

    return this.make({
      kind: "Using",
      namespace,
      name,
      span: new Span(start.span.start, name.span.end),
    });
  }

  private pEvent(): EventNode {
    const start = this.eat(TokenType.KEYWORD, "event");
    const name = this.pExpression();
    let end = name.span.end;

    if (name.kind !== "Identifier" && name.kind !== "NamespaceGetProperty") {
      if (this.mode === "strict" || name.kind !== "ErrorNode")
        this.error({
          type: "Parser",
          message: `expected an identifier or a namespace access`,
          span: name.span,
        });
    }

    let block: BlockNode | null = null;

    if (this.mode === "strict" || this.is(TokenType.DELIMITER, "{")) {
      block = this.pBlock();
      end = block.span.end;
    } else {
      this.addEatError(TokenType.DELIMITER, "{");
    }

    return this.make({
      kind: "Event",
      event: name,
      body: block,
      span: new Span(start.span.start, end),
    });
  }

  private pFunctionDefinition(): FunctionDefinitionNode {
    const start = this.eat(TokenType.KEYWORD, "fn").span.start;
    const name = this.eat(this.is(TokenType.TYPENAME) ? TokenType.TYPENAME : TokenType.IDENTIFIER);
    const parameters: FunctionDefinitionNode["parameters"] = [];

    this.eat(TokenType.DELIMITER, "(");
    this.skipNewlines();
    while (!this.is(TokenType.DELIMITER, ")")) {
      this.skipNewlines();
      if (this.is(TokenType.DELIMITER, ")")) break;

      if (parameters.length > 0) this.eat(TokenType.COMMA);
      const parameterName = this.eat(TokenType.IDENTIFIER);
      this.eat(TokenType.COLON);
      const parameterType = this.pTypeNode();

      parameters.push(
        this.make({
          kind: "FunctionParameter",
          name: parameterName,
          type: parameterType,

          span: new Span(parameterName.span.start, parameterType.span.end),
        }),
      );
    }
    this.eat(TokenType.DELIMITER, ")");
    this.eat(TokenType.COLON);

    const returnType = this.pTypeNode();

    this.skipNewlines();
    const body = this.pBlock();

    return this.make({
      kind: "FunctionDefinition",
      name,
      parameters,
      body,
      returnType,
      span: new Span(start, body.span.end),
    });
  }

  private pProgram(): ProgramNode {
    const body: ProgramNode["body"] = [];
    const start = this.current.span.start;

    while (!this.is(TokenType.EOF)) {
      while (this.is(TokenType.SEMICOLON) || this.is(TokenType.NEWLINE)) this.advance();
      if (this.is(TokenType.EOF)) break;

      if (this.is(TokenType.KEYWORD, "let")) body.push(this.pVariableDefinition());
      else if (this.is(TokenType.KEYWORD, "using")) body.push(this.pUsing());
      else if (this.is(TokenType.KEYWORD, "fn")) body.push(this.pFunctionDefinition());
      else body.push(this.pEvent());
    }

    return this.make({
      kind: "Program",
      body,
      span: new Span(start, this.current.span.end),
    });
  }

  parse(): ProgramNode {
    return this.pProgram();
  }
}
