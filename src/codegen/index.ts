import type { DFBlock, DFBlockTarget, DFCodeBlock, DFItem, DFParameter, DFTarget, DFVar } from "../diamondfire/types";
import type {
  BaseNode,
  ExpressionNode,
  KeywordArgumentNode,
  ParserNode,
  ProgramNode,
  StringNode,
} from "../parser/nodes";
import type { OptionsItem } from "../actiondump";
import type { SourceFile } from "../shared/source";
import { type TypeChecker, type VariableScope } from "../typechecker";
import {
  TypeCheckerAction,
  TypeCheckerAny,
  TypeCheckerBoolean,
  TypeCheckerCallable,
  TypeCheckerDict,
  TypeCheckerEvent,
  TypeCheckerGameValues,
  TypeCheckerList,
  TypeCheckerLiteral,
  TypeCheckerNamespace,
  TypeCheckerNumber,
  TypeCheckerReference,
  TypeCheckerString,
  TypeCheckerVoid,
  type TypeCheckerType,
} from "../typechecker/types";
import { DFBlockRow, BlockRowManager } from "../shared/blocks";
import type { TypeCheckerCallableSignature } from "../typechecker/types/callable";
import type { TargetTokens } from "../lexer";

function getParameterType(type: TypeCheckerType): (DFItem & { id: "pn_el" })["data"]["type"] {
  if (type instanceof TypeCheckerAny) return "any";
  if (type instanceof TypeCheckerDict) return "dict";
  if (type instanceof TypeCheckerString) return "txt";
  if (type instanceof TypeCheckerNumber) return "num";
  if (type instanceof TypeCheckerLiteral) return "num";
  if (type instanceof TypeCheckerBoolean) return "num";
  if (type instanceof TypeCheckerReference) return "var";

  return "any";
}

const scope2df: Record<VariableScope, "unsaved" | "saved" | "local" | "line"> = {
  "@global": "unsaved",
  "@saved": "saved",
  "@thread": "local",
  "@line": "line",
};

const SELECTION_ACTIONS = ["player_action", "entity_action", "if_player", "if_entity"];

const TARGET_TO_DF: Record<TargetTokens, DFBlockTarget> = {
  all_entities: "AllEntities",
  all_players: "AllPlayers",
  damager: "Damager",
  default: "Default",
  killer: "Killer",
  last_entity: "LastEntity",
  projectile: "Projectile",
  selection: "Selection",
  shooter: "Shooter",
  victim: "Victim",
};

function assertNode<T extends string>(node: BaseNode<string>): asserts node is BaseNode<T> {}

export class CodeGen {
  private blocks: BlockRowManager = new BlockRowManager();
  private hadJoinEvent: boolean = false;
  private tempVariableIndex: number = 0;
  private functionReturnVariable: string = "";

  constructor(
    private source: SourceFile,
    private checker: TypeChecker,
    private root: ProgramNode,
  ) {}

  private nextTempVariable(): string {
    return `basalt#${this.tempVariableIndex++}`;
  }

  private generateAction(
    signature: TypeCheckerCallableSignature,
    args: ExpressionNode[],
    keywordArguments: KeywordArgumentNode[],
    expr: TypeCheckerAction,

    extraItems?: DFItem[],
  ): void {
    const items: { item: DFItem; slot: number }[] = extraItems ? extraItems.map((item, slot) => ({ item, slot })) : [];
    for (const item of args) items.push({ item: this.generateItem(item), slot: items.length });

    let slot = items.length;
    for (const arg of keywordArguments) {
      const param = signature.keywordParams.find((p) => p.name === arg.name.value)!;

      if (!param.tag) items.push({ item: this.generateItem(arg.value), slot: slot++ });
      else {
        let literalOption: string | null = null;

        if (arg.value.kind === "String" || arg.value.kind === "Boolean") {
          for (const option of param.tag.tag.options) {
            if (option.name === arg.value.value.value) {
              literalOption = option.name;
            }
          }
        }

        const item: DFItem = {
          id: "bl_tag",
          data: {
            block: expr.opts.codeblock,
            action: expr.opts.action,
            tag: param.tag.tag.name,
            option: literalOption ?? param.tag.tag.defaultOption,
          },
        };

        if (arg.value.kind === "VariableNode") item.data.variable = this.generateItem(arg.value) as DFVar;

        items.push({
          item,
          slot: param.tag.tag.slot,
        });
      }
    }

    const currentTarget = this.blocks.currentBlockTarget();
    const block: DFCodeBlock = {
      id: "block",
      action: expr.opts.action,
      block: expr.opts.codeblock,
      args: { items },
    };

    if (currentTarget && SELECTION_ACTIONS.includes(expr.opts.codeblock)) {
      block.target = currentTarget;
    }

    this.blocks.add(block);
  }

  private generateItem(node: ParserNode): DFItem {
    switch (node.kind) {
      case "TypeCast": {
        return this.generateItem(node.expression);
      }

      case "Number": {
        return { id: "num", data: { name: node.value.value } };
      }

      case "String": {
        return { id: "txt", data: { name: node.value.value } };
      }

      case "StyledText": {
        return { id: "comp", data: { name: node.value.value } };
      }

      case "Boolean": {
        return { id: "num", data: { name: node.value.value === "true" ? "1" : "0" } };
      }

      case "ReferenceExpression": {
        return {
          id: "var",
          data: { name: node.name.name.value, scope: scope2df[node.name.scope.value as VariableScope] },
        };
      }

      case "VariableNode": {
        return {
          id: "var",
          data: { name: node.name.value, scope: scope2df[node.scope.value as VariableScope] },
        };
      }

      case "CallExpression": {
        const expr = this.checker.getType(node.expression)! as TypeCheckerCallable;
        const args = node.arguments.map((arg) => this.generateItem(arg));
        const tempVar = {
          id: "var",
          data: {
            name: Math.random().toString(16).substring(2),
            scope: "line",
          },
        } as const;

        if (expr instanceof TypeCheckerAction) {
          const meta = this.checker.getMeta(node);

          if (!meta || meta.kind !== "FunctionCall" || !meta.implicitVariable)
            this.source.error({
              type: "CodeGen",
              message: "this action cannot be used here",
              span: node.span,
            });

          const tempName = this.nextTempVariable();
          const tempVar = { id: "var", data: { name: tempName, scope: "line" } } as const;

          this.generateAction(expr.signature, node.arguments, node.keywordArguments, expr, [tempVar]);
          return tempVar;
        }

        this.blocks.add({
          id: "block",
          block: "call_func",
          data: expr.name,
          args: {
            items: [
              {
                item: tempVar,
                slot: 0,
              },
              ...args.map((item, i) => ({ item, slot: i + 1 })),
            ],
          },
        });

        return tempVar;
      }

      case "NamespaceGetProperty": {
        const namespace = this.checker.getType(node.namespace)!;

        if (namespace instanceof TypeCheckerGameValues) {
          const prop =
            node.property.kind === "Identifier" ? node.property.name.value : (node.property as StringNode).value.value;
          const gameValue = namespace.getGameValue(prop)!;

          return {
            id: "g_val",
            data: {
              type: gameValue.name,
              target: this.blocks.currentGameValueTarget() ?? "Default",
            },
          };
        }

        break;
      }

      case "TargetExpression": {
        this.blocks.pushTarget(TARGET_TO_DF[node.target.value as TargetTokens]);
        const item = this.generateItem(node.expression);
        this.blocks.popTarget();

        return item;
      }
    }

    this.source.error({
      type: "TypeError",
      message: `cannot generate an item from this expression (${node.kind})`,
      span: node.span,
    });
  }

  private generate(node: ParserNode, parent: ParserNode) {
    const scope = this.checker.getScope(node);

    switch (node.kind) {
      case "Program": {
        const definitions = [];

        for (const child of node.body) {
          if (child.kind === "VariableDefinition") {
            definitions.push(child);
          } else {
            this.generate(child, node);
          }
        }

        this.blocks.begin();
        this.blocks.add({
          id: "block",
          block: "func",
          data: "basalt_init",
          args: {
            items: [],
          },
        });

        if (definitions.length > 0) {
          this.blocks.add({
            id: "block",
            block: "if_var",
            action: "=",
            args: {
              items: [
                {
                  item: {
                    id: "g_val",
                    data: {
                      type: "Player Count",
                      target: "Default",
                    },
                  },
                  slot: 0,
                },
                {
                  item: {
                    id: "num",
                    data: {
                      name: "1",
                    },
                  },
                  slot: 1,
                },
              ],
            },
          });

          this.blocks.add({
            id: "bracket",
            direct: "open",
            type: "norm",
          });

          for (const def of definitions) {
            this.generate(def, node);
          }

          this.blocks.add({
            id: "bracket",
            direct: "close",
            type: "norm",
          });
        }

        this.blocks.end();

        if (!this.hadJoinEvent) {
          this.blocks.begin();
          this.blocks.add({
            id: "block",
            block: "event",
            action: "Join",
            args: {
              items: [],
            },
          });
          this.blocks.add({
            id: "block",
            block: "call_func",
            data: "basalt_init",
            args: {
              items: [],
            },
          });
          this.blocks.end();
        }

        break;
      }

      case "Using": {
        break;
      }

      case "Event": {
        const ev = this.checker.getType(node.event) as TypeCheckerEvent;
        this.blocks.begin();
        this.blocks.add({
          id: "block",
          action: ev.dfId,
          block: ev.dfName,
          args: { items: [] },
        });

        if (ev.dfId === "Join") {
          this.hadJoinEvent = true;
          this.blocks.add({
            id: "block",
            block: "call_func",
            args: {
              items: [],
            },
            data: "basalt_init",
          });
        }

        for (const body of node.body!.body) this.generate(body, node);

        this.blocks.end();
        break;
      }

      case "ExpressionStatement": {
        this.generate(node.expression, node);

        break;
      }

      case "CallExpression": {
        const expr = this.checker.getType(node.expression)!;

        if (expr instanceof TypeCheckerAction) {
          const res = expr.canCall(node, (node) => this.checker.getType(node)!);
          if (!res.ok) throw new Error("unreachable");

          this.generateAction(expr.signature, node.arguments, node.keywordArguments, expr);
        } else if (expr instanceof TypeCheckerCallable) {
          const args = node.arguments.map((arg) => this.generateItem(arg));

          this.blocks.add({
            id: "block",
            block: "call_func",
            data: expr.name,
            args: {
              items: args.map((item, i) => ({ item, slot: i + 1 })),
            },
          });
        }

        break;
      }

      case "VariableDefinition": {
        const variableScope = scope2df[node.name.scope.value as VariableScope];

        if (!node.value) break;

        if (variableScope === "saved" && parent.kind === "Program") {
          this.blocks.add({
            id: "block",
            block: "if_var",
            action: "VarExists",
            attribute: "NOT",
            args: {
              items: [
                {
                  item: {
                    id: "var",
                    data: {
                      name: node.name.name.value,
                      scope: variableScope as any,
                    },
                  },
                  slot: 0,
                },
              ],
            },
          });

          this.blocks.add({
            id: "bracket",
            direct: "open",
            type: "norm",
          });
        }

        this.blocks.add({
          id: "block",
          action: "=",
          block: "set_var",
          args: {
            items: [
              {
                item: {
                  id: "var",
                  data: {
                    name: node.name.name.value,
                    scope: variableScope as any,
                  },
                },
                slot: 0,
              },
              {
                item: this.generateItem(node.value),
                slot: 1,
              },
            ],
          },
        });

        if (variableScope === "saved" && parent.kind === "Program") {
          this.blocks.add({
            id: "bracket",
            direct: "close",
            type: "norm",
          });
        }

        break;
      }

      case "AssignmentExpression": {
        const lhs = this.generateItem(node.expression);
        const rhs = this.generateItem(node.value);
        const args: DFItem[] = [lhs];

        let operator = node.operator.value;

        if (node.operator.value === "*=" || node.operator.value === "/=") {
          args.push(lhs);
          operator = node.operator.value[0];
        }

        args.push(rhs);

        this.blocks.add({
          id: "block",
          action: operator,
          block: "set_var",
          args: {
            items: args.map((item, i) => ({ item, slot: i })),
          },
        });

        break;
      }

      case "Block": {
        for (const child of node.body) this.generate(child, node);

        break;
      }

      case "FunctionDefinition": {
        this.blocks.begin();
        this.functionReturnVariable = this.nextTempVariable();

        const params = node.parameters.map(
          (param, slot) =>
            ({
              item: {
                id: "pn_el",
                data: {
                  type: getParameterType(this.checker.getType(param.type)!),
                  name: param.name.value,
                  optional: false,
                  plural: false,
                },
              },
              slot: slot + 1,
            }) satisfies { item: DFItem; slot: number },
        );

        this.blocks.add({
          id: "block",
          block: "func",
          data: node.name.value,
          args: {
            items: [
              {
                item: {
                  id: "pn_el",
                  data: {
                    type: "var",
                    name: this.functionReturnVariable,
                    optional: false,
                    plural: false,
                  },
                },
                slot: 0,
              },
              ...params,
            ],
          },
        });

        this.generate(node.body, node);
        this.blocks.end();

        break;
      }

      case "ReturnStatement": {
        const item = this.generateItem(node.value);

        this.blocks.add({
          id: "block",
          block: "set_var",
          args: {
            items: [
              {
                item: {
                  id: "var",
                  data: {
                    name: this.functionReturnVariable,
                    scope: "line",
                  },
                },
                slot: 0,
              },
              {
                item,
                slot: 1,
              },
            ],
          },
          action: "=",
        });

        this.blocks.add({
          id: "block",
          block: "control",
          action: "Return",
          args: {
            items: [],
          },
        });

        break;
      }

      case "IfActionStatement": {
        const type = this.checker.getType(node) as TypeCheckerAction;
        const res = type.canCall(node, (node) => this.checker.getType(node)!);
        if (!res.ok) throw new Error("unreachable");

        this.generateAction(type.signature, node.arguments, node.keywordArguments, type);

        this.blocks.add({
          id: "bracket",
          type: "norm",
          direct: "open",
        });

        this.generate(node.block!, node);

        this.blocks.add({
          id: "bracket",
          type: "norm",
          direct: "close",
        });

        break;
      }

      case "IfExpressionStatement": {
        assertNode<"BinaryExpression" | "VariableNode" | "Identifier">(node.expression!);

        if (node.expression.kind === "BinaryExpression") {
          const opString = node.expression.operator.value === "==" ? "=" : node.expression.operator.value;

          this.blocks.add({
            id: "block",
            block: "if_var",
            action: opString,
            args: {
              items: [
                { item: this.generateItem(node.expression.lhs), slot: 0 },
                { item: this.generateItem(node.expression.rhs), slot: 1 },
              ],
            },
          });
        } else if (node.expression.kind === "VariableNode" || node.expression.kind === "Identifier") {
          this.blocks.add({
            id: "block",
            block: "if_var",
            action: "!=",
            args: {
              items: [
                { item: this.generateItem(node.expression), slot: 0 },
                { item: { id: "num", data: { name: "0" } }, slot: 1 },
              ],
            },
          });
        }

        this.blocks.add({
          id: "bracket",
          type: "norm",
          direct: "open",
        });

        this.generate(node.block!, node);

        this.blocks.add({
          id: "bracket",
          type: "norm",
          direct: "close",
        });

        return;
      }

      case "TargetStatement": {
        this.blocks.pushTarget(TARGET_TO_DF[node.target.value as TargetTokens]);
        this.generate(node.statement, node);
        this.blocks.popTarget();

        return;
      }

      case "TargetExpression": {
        this.blocks.pushTarget(TARGET_TO_DF[node.target.value as TargetTokens]);
        this.generate(node.expression, node);
        this.blocks.popTarget();

        return;
      }

      case "ForStatement": {
        const items: DFItem[] = [];
        let action: string = "Multiple";

        if (node.type === "in") {
          const expr = this.checker.getType(node.expression)!;

          if (expr instanceof TypeCheckerList) {
            action = "ForEach";
          } else if (expr instanceof TypeCheckerDict) {
            action = "ForEachEntry";
          }
        }

        for (const variable of node.pattern) {
          items.push(this.generateItem(variable));
        }

        items.push(this.generateItem(node.expression));

        this.blocks.add({
          id: "block",
          block: "repeat",
          action: action,
          args: { items: items.map((it, i) => ({ item: it, slot: i })) },
        });

        this.blocks.add({
          id: "bracket",
          type: "repeat",
          direct: "open",
        });

        this.generate(node.block, node);

        this.blocks.add({
          id: "bracket",
          type: "repeat",
          direct: "close",
        });

        return;
      }

      case "TypeCast": {
        this.generate(node.expression, node);

        return;
      }

      default: {
        this.source.error({
          type: "CodeGen",
          message: `invalid top-level directive '${node.kind}'`,
          span: node.span,
        });
      }
    }

    return null;
  }

  generateProgram(): DFBlockRow[] {
    this.generate(this.root, this.root);
    return this.blocks.get();
  }
}
