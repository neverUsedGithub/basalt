import type { Token, TokenType } from "../lexer";
import type { Span } from "../shared/span";

export interface BaseNode<T> {
  kind: T;
  span: Span;
}

export interface PackageNode extends BaseNode<"Package"> {
  name: Token;
}

export interface IdentifierNode extends BaseNode<"Identifier"> {
  name: Token;
}

export interface VariableNode extends BaseNode<"VariableNode"> {
  scope: Token;
  name: Token;
}

export interface NumberNode extends BaseNode<"Number"> {
  value: Token;
}

export interface StringNode extends BaseNode<"String"> {
  value: Token;
}

export interface StyledTextNode extends BaseNode<"StyledText"> {
  value: Token;
}

export interface BooleanNode extends BaseNode<"Boolean"> {
  value: Token;
}

export interface SpecialNode extends BaseNode<"Special"> {
  name: Token;
}

export interface TypeNameNode extends BaseNode<"TypeName"> {
  name: Token;
}

export interface NamespaceGetPropertyNode extends BaseNode<"NamespaceGetProperty"> {
  namespace: IdentifierNode | NamespaceGetPropertyNode;
  property: IdentifierNode | StringNode | ErrorNode;
}

export interface BlockNode extends BaseNode<"Block"> {
  body: StatementNode[];
}

export interface EventNode extends BaseNode<"Event"> {
  event: IdentifierNode | NamespaceGetPropertyNode;
  body: BlockNode;
}

export interface VariableDefinitionNode extends BaseNode<"VariableDefinition"> {
  name: VariableNode;
  type?: TypeNode;
  value?: ExpressionNode;
}

export interface ParameterizedTypeNode extends BaseNode<"ParameterizedType"> {
  name: IdentifierNode | TypeNameNode;
  parameters: TypeNode[];
}

export interface ExpressionStatementNode extends BaseNode<"ExpressionStatement"> {
  expression: ExpressionNode;
}

export interface BinaryExpressionNode extends BaseNode<"BinaryExpression"> {
  lhs: ExpressionNode;
  rhs: ExpressionNode;
  operator: Token<TokenType.OPERATOR>;
}

export interface AssignmentExpressionNode extends BaseNode<"AssignmentExpression"> {
  operator: Token<TokenType.OPERATOR>;
  expression: IdentifierNode | PropertyAccessNode | VariableNode;
  value: ExpressionNode;
}

export interface PropertyAccessNode extends BaseNode<"PropertyAccess"> {
  object: ExpressionNode;
  property: ExpressionNode;
  computed: boolean;
}

export interface KeywordArgumentNode extends BaseNode<"KeywordArgument"> {
  name: Token;
  value: ExpressionNode;
}

export interface CallExpressionNode extends BaseNode<"CallExpression"> {
  expression: ExpressionNode;
  arguments: ExpressionNode[];
  keywordArguments: KeywordArgumentNode[];
}

export interface ProgramNode extends BaseNode<"Program"> {
  body: (UsingNode | EventNode | VariableDefinitionNode | FunctionDefinitionNode)[];
}

export interface ReferenceExpressionNode extends BaseNode<"ReferenceExpression"> {
  name: VariableNode;
}

export interface UsingNode extends BaseNode<"Using"> {
  namespace: Token;
  name: Token;
}

export interface FunctionParameterNode extends BaseNode<"FunctionParameter"> {
  name: Token;
  type: TypeNode;
}

export interface FunctionDefinitionNode extends BaseNode<"FunctionDefinition"> {
  name: Token;
  parameters: FunctionParameterNode[];
  body: BlockNode;
  returnType: TypeNode;
}

export interface ReturnStatementNode extends BaseNode<"ReturnStatement"> {
  value: ExpressionNode;
}

export interface IfExpressionStatementNode extends BaseNode<"IfExpressionStatement"> {
  expression: ExpressionNode | null;
  block: BlockNode | null;
}

export interface IfActionStatementNode extends BaseNode<"IfActionStatement"> {
  category: Token | null;
  action: Token | null;
  arguments: ExpressionNode[];
  keywordArguments: KeywordArgumentNode[];
  block: BlockNode | null;
}

export interface TargetStatementNode extends BaseNode<"TargetStatement"> {
  target: Token;
  statement: StatementNode;
}

export interface TargetExpressionNode extends BaseNode<"TargetExpression"> {
  target: Token;
  expression: ExpressionNode;
}

export interface TypeCastNode extends BaseNode<"TypeCast"> {
  expression: ExpressionNode;
  type: TypeNode;
}

export interface RepeatStatementNode extends BaseNode<"RepeatStatement"> {}

export interface ForStatementNode extends BaseNode<"ForStatement"> {
  type: "in" | "to";
  pattern: VariableNode[];
  expression: ExpressionNode;
}

export interface ErrorNode extends BaseNode<"ErrorNode"> {}

export type ParserNode =
  | ProgramNode
  | UsingNode
  | EventNode
  | BlockNode
  | StatementNode
  | ExpressionNode
  | TypeNode
  | ErrorNode
  | KeywordArgumentNode
  | FunctionParameterNode;

export type StatementNode =
  | VariableDefinitionNode
  | ReturnStatementNode
  | ExpressionStatementNode
  | BlockNode
  | IfExpressionStatementNode
  | IfActionStatementNode
  | FunctionDefinitionNode
  | TargetStatementNode;

export type ExpressionNode =
  | IdentifierNode
  | VariableNode
  | SpecialNode
  | NumberNode
  | StringNode
  | StyledTextNode
  | BooleanNode
  | NamespaceGetPropertyNode
  | PropertyAccessNode
  | CallExpressionNode
  | BinaryExpressionNode
  | AssignmentExpressionNode
  | ReferenceExpressionNode
  | TargetExpressionNode
  | TypeCastNode
  | ErrorNode;

export type TypeNode = TypeNameNode | IdentifierNode | ParameterizedTypeNode;
