import type { TypeCheckerCallableSignature } from "../typechecker/types/callable";
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

function typeToChecker(type: string): TypeCheckerType {
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

function argToType(item: ArgumentsItem): TypedArgument {
  const name = (item.description ?? ["argument"]).join(" ").toLowerCase();
  const type: TypeCheckerType = typeToChecker(item.type ?? "");

  return { type, name };
}

function getPermutations<T>(array: (T | T[])[]): T[][] {
  const stack: [number, number][] = [];
  const permutations: T[][] = [];

  let i = 0;
  let pointer = 0;
  let currArray: T[] = [];

  perms: while (true) {
    if (i === array.length) {
      permutations.push(currArray);

      if (stack.length === 0) break;

      let top = stack[stack.length - 1];
      top[1]++;

      while (top[1] >= (array[top[0]] as T[]).length) {
        stack.pop();
        pointer--;

        if (stack.length === 0) break perms;

        top = stack[stack.length - 1];
        top[1]++;
      }

      currArray = currArray.slice(0, top[0]);
      pointer--;
      i = top[0];
    }

    if (Array.isArray(array[i])) {
      if (stack.length <= pointer) stack.push([i, 0]);

      const [index, offset] = stack[pointer];
      currArray.push((array[index] as T[])[offset]);
      pointer++;
      i++;
    } else {
      currArray.push(array[i] as T);
      i++;
    }
  }

  return permutations;
}

function parseOrArray(args: ArgumentsItem[]) {
  const array: (TypedArgument | TypedArgument[])[] = [];

  let isVariadic: boolean = false;

  for (let i = 0; i < args.length; i++) {
    if (!args[i].type) continue;

    // assumes variadic arguments can only have one type
    if (args[i].plural) isVariadic = true;

    const possible = [argToType(args[i])];

    while (i + 1 < args.length && args[i + 1].text && args[i + 1].text?.includes("OR")) {
      i += 2;
      if (args[i].type !== "NONE") possible.push(argToType(args[i]));
    }

    if (possible.length === 1) array.push(possible[0]);
    else array.push(possible);
  }

  return { array, isVariadic };
}

const conditions: Record<string, Map<string, TypeCheckerAction>> = {};

for (const block of actionDump.codeblocks) {
  const blockName = camelToSnakeCase(block.name);

  if (block.identifier === "event" || block.identifier === "entity_event") {
    const namespaceItems: Map<string, TypeCheckerType> = new Map();

    for (const action of blockActions[blockName]) {
      const actionName = camelToSnakeCase(action.name);

      namespaceItems.set(actionName, new TypeCheckerEvent(blockName, actionName, block.identifier, action.name));
    }

    builtins[blockName] = new TypeCheckerNamespace(blockName, namespaceItems);
  } else if (blockName in blockActions) {
    const namespaceItems: Map<string, TypeCheckerType> = new Map();
    const isCondition = CONDITION_BLOCKS.includes(blockName);

    for (const action of blockActions[blockName]) {
      if (action.name === "dynamic") continue;

      const actionName = camelToSnakeCase(action.name);

      if (action.icon.arguments) {
        const { array, isVariadic } = parseOrArray(action.icon.arguments!)!;
        const permutations = getPermutations(array);
        const signatures: TypeCheckerCallableSignature[] = [];
        const keywordParams: TypeCheckerCallableSignature["keywordParams"] = [];

        for (const tag of action.tags) {
          const values: TypeCheckerLiteral[] = [];

          if (
            tag.options.length === 2 &&
            tag.options[0].name.toLowerCase() === "true" &&
            tag.options[1].name.toLowerCase() === "false"
          ) {
            values.push(new TypeCheckerLiteral(true), new TypeCheckerLiteral(false));
          } else {
            for (const value of tag.options) {
              values.push(new TypeCheckerLiteral(camelToSnakeCase(value.name)));
            }
          }

          keywordParams.push({
            name: camelToSnakeCase(tag.name),
            type: new TypeCheckerAny(),
            optional: true,
            tag: {
              tag,
              values,
            },
          });
        }

        for (const perm of permutations) {
          signatures.push({
            params: perm.map(({ name, type }, i) => [name, type]),
            return: new TypeCheckerVoid(),
            keywordParams,
            variadic: isVariadic,
          });
        }

        namespaceItems.set(
          actionName,
          new TypeCheckerAction(actionName, signatures, { action: action.name, codeblock: block.identifier }),
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
}

const gameValues: Map<string, GameValueItem> = new Map();

for (const gameValue of actionDump.gameValues) {
  const snake = camelToSnakeCase(gameValue.icon.name);
  const type = typeToChecker(gameValue.icon.returnType ?? "");

  gameValues.set(snake, { name: gameValue.icon.name, type });
}

builtins["game_values"] = new TypeCheckerGameValues(gameValues);

export { builtins, conditions };
