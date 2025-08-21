export interface DFTag {
  id: "bl_tag";
  data: {
    option: string;
    tag: string;
    action: string;
    block: string;
    variable?: DFVar;
  };
}

export interface DFVar {
  id: "var";
  data: {
    name: string;
    scope: "unsaved" | "saved" | "local" | "line";
  };
}

export interface DFNumber {
  id: "num";
  data: {
    name: string;
  };
}

export interface DFString {
  id: "txt";
  data: {
    name: string;
  };
}

export interface DFSound {
  id: "snd";
  data: {
    pitch: number;
    vol: number;
    sound: string;
  };
}

export interface DFLocation {
  id: "loc";
  data: {
    isBlock: boolean;
    loc: {
      x: number;
      y: number;
      z: number;
      pitch: number;
      yaw: number;
    };
  };
}

export interface DFParticle {
  id: "part";
  data: {
    particle: string;
    cluster: {
      amount: number;
      horizontal: number;
      vertical: number;
    };
    data:
      | {}
      | {
          x: number;
          y: number;
          z: number;
          motionVariation: number;
        };
  };
}

export interface DFVector {
  id: "vec";
  data: {
    x: number;
    y: number;
    z: number;
  };
}

export interface DFPotion {
  id: "pot";
  data: {
    pot: string;
    dur: number;
    amp: number;
  };
}

export interface DFGlobal {
  id: "g_val";
  data: {
    type: string;
    target: DFTarget;
  };
}

export interface DFStyledText {
  id: "comp";
  data: {
    name: string;
  };
}

export interface DFMCItem {
  id: "item";
  data: {
    item: string;
  };
}

export interface DFParameter {
  id: "pn_el";
  data: {
    name: string;
    type: "any" | "dict" | "item" | "list" | "loc" | "num" | "part" | "pot" | "txt" | "comp" | "var" | "vec";
    plural: boolean;
    optional: boolean;
  };
}

export interface DFHint {
  id: "hint";
  data: {
    id: string;
  };
}

export type DFItem =
  | DFTag
  | DFVar
  | DFGlobal
  | DFNumber
  | DFString
  | DFLocation
  | DFSound
  | DFParticle
  | DFVector
  | DFPotion
  | DFStyledText
  | DFMCItem
  | DFParameter
  | DFHint;

export interface DFCodeBlock {
  id: "block";
  block: string;
  attribute?: "NOT" | "LS_CANCEL";
  args: { items: { item: DFItem; slot: number }[] };
  target?: DFBlockTarget;
  subAction?: string;
  action?: string;
  data?: string;
}

export interface DFBracket {
  id: "bracket";
  direct: "open" | "close";
  type: "norm" | "repeat";
}

export type DFTarget =
  | "Selection"
  | "Default"
  | "Killer"
  | "Damager"
  | "Victim"
  | "Shooter"
  | "Projectile"
  | "LastEntity";

export type DFBlockTarget = "AllEntities" | "AllPlayers" | DFTarget;

export type DFBlock = DFCodeBlock | DFBracket;

export type DFCode = { blocks: DFBlock[] };

export type MCText =
  | string
  | {
      text: string;
      extra?: MCText[];
      color?:
        | "black"
        | "dark_blue"
        | "dark_green"
        | "dark_aqua"
        | "dark_red"
        | "dark_purple"
        | "gold"
        | "gray"
        | "dark_gray"
        | "blue"
        | "green"
        | "aqua"
        | "red"
        | "light_purple"
        | "yellow"
        | string;
      bold?: boolean;
      italic?: boolean;
      underlined?: boolean;
      strikethrough?: boolean;
      obfuscated?: boolean;
    };
