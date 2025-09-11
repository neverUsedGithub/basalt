import type { TypeCheckerCallableParameter, TypeCheckerCallableSignature } from "../typechecker/types/callable";
import { actionDump, type ActionDump, type ActionsItem, type ArgumentsItem } from "../actiondump";
import {
  TypeCheckerAction,
  TypeCheckerAny,
  TypeCheckerDict,
  TypeCheckerEvent,
  TypeCheckerGameValues,
  TypeCheckerList,
  TypeCheckerLiteral,
  TypeCheckerNamespace,
  TypeCheckerNumber,
  TypeCheckerReference,
  TypeCheckerString,
  TypeCheckerStyledText,
  TypeCheckerVoid,
  type TypeCheckerType,
} from "../typechecker/types";
import { TypeCheckerUnion } from "../typechecker/types/union";

const CAMEL_CASE_REGEX = /([a-z])([A-Z])/g;
const SPACE_SEP_REGEX = /([a-zA-Z]) ([a-zA-Z])/g;
const CONDITION_BLOCKS = ["if_game", "if_variable", "if_player", "if_entity"];

const builtins: Record<string, TypeCheckerType> = {};

const cachedNames: Record<string, string> = {};
const camelCaseReplace = (_: unknown, g1: string, g2: string) => `${g1}_${g2}`;
function camelToSnakeCase(camelString: string): string {
  if (camelString in cachedNames) return cachedNames[camelString];

  return (cachedNames[camelString] = camelString //
    .replace(CAMEL_CASE_REGEX, camelCaseReplace)
    .replace(SPACE_SEP_REGEX, camelCaseReplace)
    .toLowerCase()
    .trim());
}

const blockActions: Record<string, ActionsItem[]> = {};

for (const action of actionDump.actions) {
  const blockName = camelToSnakeCase(action.codeblockName);
  if (!blockActions[blockName]) blockActions[blockName] = [];
  blockActions[blockName].push(action);
}

interface TypedArgument {
  type: TypeCheckerType;
  name: string;
}

function typeToChecker(type?: string): TypeCheckerType {
  if (
    type === "ITEM" ||
    type === "BLOCK" || // TODO: block
    type === "SOUND" || // TODO: sound
    type === "POTION" || // TODO: potion
    type === "VECTOR" || // TODO: vector
    type === "VEHICLE" || // TODO: vehicle
    type === "PARTICLE" || // TODO: particle
    type === "LOCATION" || // TODO: location
    type === "SPAWN_EGG" || // TODO: spawn egg
    type === "BLOCK_TAG" || // TODO: block tag?
    type === "PROJECTILE" || // TODO: projectile
    type === "ENTITY_TYPE" // TODO: entity_type?
  )
    return new TypeCheckerVoid();
  else if (type === "LIST") return new TypeCheckerList();
  else if (type === "TEXT") return new TypeCheckerString();
  else if (type === "NUMBER") return new TypeCheckerNumber();
  else if (type === "ANY_TYPE") return new TypeCheckerAny();
  else if (type === "COMPONENT") return new TypeCheckerStyledText();
  else if (type === "DICT") {
    const out = new TypeCheckerDict();
    out.addGenericParameters([new TypeCheckerAny()]);

    return out;
  } else if (type === "VARIABLE") {
    const out = new TypeCheckerReference();
    out.addGenericParameters([new TypeCheckerAny()]);

    return out;
  }

  throw new Error(`unimplemented actiondump type '${type}'`);
}

function parseIconArguments(icon: ArgumentsItem[]): TypeCheckerCallableParameter[] {
  const params: TypeCheckerCallableParameter[] = [];

  for (let i = 0; i < icon.length; i++) {
    if (!icon[i].type) continue;

    let type: TypeCheckerType;
    let name = (icon[i].description ?? ["unknown"]).join(" ").toLowerCase();
    let variadic = icon[i].plural ?? false;
    let optional = icon[i].optional ?? false;
    let union = [typeToChecker(icon[i].type)];

    while (i + 2 < icon.length && icon[i + 1].text?.includes("OR")) {
      if (icon[i + 2].type === "NONE") optional = true;
      else union.push(typeToChecker(icon[i + 2].type));
      i += 2;
    }

    if (union.length > 1) type = new TypeCheckerUnion(union);
    else type = union[0];

    params.push({ name: name, type, variadic, optional });
  }

  return params;
}

const OPERATOR_ACTIONS = ["=", "!=", "<", "<=", ">", ">="];
const conditions: Record<string, Map<string, TypeCheckerAction>> = {};

for (const block of actionDump.codeblocks) {
  const blockName = camelToSnakeCase(block.name);

  if (block.identifier === "event" || block.identifier === "entity_event") {
    const namespaceItems: Map<string, TypeCheckerType> = new Map();

    for (const action of blockActions[blockName]) {
      const actionName = camelToSnakeCase(action.name);
      const docs = action.icon.description.join(" ");

      namespaceItems.set(actionName, new TypeCheckerEvent(blockName, actionName, block.identifier, action.name, docs));
    }

    builtins[blockName] = new TypeCheckerNamespace(blockName, namespaceItems);
  } else if (blockName in blockActions) {
    const namespaceItems: Map<string, TypeCheckerType> = new Map();
    const isCondition = CONDITION_BLOCKS.includes(blockName);

    for (const action of blockActions[blockName]) {
      if (action.name === "dynamic") continue;
      if (block.name === "if_var" && OPERATOR_ACTIONS.includes(action.name)) continue;

      const actionName = camelToSnakeCase(action.name);
      const docs = action.icon.description.join(" ");

      if (action.icon.arguments) {
        const parameters = parseIconArguments(action.icon.arguments!)!;
        const keywordParams: TypeCheckerCallableSignature["keywordParams"] = [];

        for (const tag of action.tags) {
          const values: TypeCheckerLiteral[] = [];
          let type: "string" | "boolean" = "string";

          if (
            tag.options.length === 2 &&
            tag.options[0].name.toLowerCase() === "true" &&
            tag.options[1].name.toLowerCase() === "false"
          ) {
            type = "boolean";
            values.push(TypeCheckerLiteral.boolean(true), TypeCheckerLiteral.boolean(false));
          } else {
            for (const value of tag.options) {
              values.push(TypeCheckerLiteral.string(value.name));
            }
          }

          keywordParams.push({
            name: camelToSnakeCase(tag.name),
            type: new TypeCheckerUnion(values),
            optional: true,
            tag: {
              tag,
              type,
              values,
            },
          });
        }

        const anyRef = new TypeCheckerReference();
        anyRef.addGenericParameters([new TypeCheckerAny()]);

        let returnType: TypeCheckerType = new TypeCheckerVoid();

        const signature: TypeCheckerCallableSignature = {
          params: parameters,
          return: returnType,
          keywordParams,
        };

        namespaceItems.set(
          actionName,
          new TypeCheckerAction(actionName, signature, { action: action.name, codeblock: block.identifier, docs }),
        );
      }
    }

    if (isCondition) {
      conditions[blockName] = namespaceItems as Map<string, TypeCheckerAction>;
    } else {
      builtins[blockName] = new TypeCheckerNamespace(blockName, namespaceItems);
    }
  }
}

export interface GameValueItem {
  name: string;
  type: TypeCheckerType;
  docs: string;
}

const gameValues: Map<string, GameValueItem> = new Map();

for (const gameValue of actionDump.gameValues) {
  const snake = camelToSnakeCase(gameValue.icon.name);
  const type = typeToChecker(gameValue.icon.returnType ?? "");

  gameValues.set(snake, { name: gameValue.icon.name, type, docs: gameValue.icon.description.join(" ") });
}

builtins["game_values"] = new TypeCheckerGameValues(gameValues);

export { builtins, conditions };
