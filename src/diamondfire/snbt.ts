export type SNBTJson = string | number | SNBTUnit | { [key: string]: SNBTJson };

export class SNBTUnit {
  constructor(public value: number, public unit: string) {}
}

const KEY_REGEX = /^[A-Za-z_][A-Za-z_0-9]*$/;

export namespace SNBT {
  export function byte(value: number): SNBTUnit {
    return new SNBTUnit(value, "b");
  }

  export function short(value: number): SNBTUnit {
    return new SNBTUnit(value, "s");
  }

  export function long(value: number): SNBTUnit {
    return new SNBTUnit(value, "l");
  }

  export function float(value: number): SNBTUnit {
    return new SNBTUnit(value, "f");
  }

  export function double(value: number): SNBTUnit {
    return new SNBTUnit(value, "d");
  }

  export function dump(object: SNBTJson): string {
    if (object instanceof SNBTUnit) return `${object.value}${object.unit}`;

    if (typeof object === "string") return `"${object.replaceAll('"', '\\"')}"`;

    if (typeof object === "object") {
      let out = "{";

      for (const rawKey in object) {
        if (out !== "{") out += ",";

        const key: string = KEY_REGEX.test(rawKey) ? rawKey : `"${rawKey}"`;

        out += `${key}:${dump(object[key])}`;
      }

      return out + "}";
    }

    return object.toString();
  }
}
