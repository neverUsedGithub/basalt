export interface ActionDump {
    codeblocks: CodeblocksItem[];
    actions: ActionsItem[];
    gameValueCategories: GameValueCategoriesItem[];
    gameValues: GameValuesItem[];
    particleCategories: ParticleCategoriesItem[];
    particles: ParticlesItem[];
    soundCategories: SoundCategoriesItem[];
    sounds: SoundsItem[];
    potions: PotionsItem[];
    cosmetics: CosmeticsItem[];
    shops: ShopsItem[];
}
export interface CodeblocksItem {
    name: string;
    identifier: string;
    item: Item;
}
export interface Item {
    material: string;
    name: string;
    deprecatedNote: any[];
    description: string[];
    example: string[];
    worksWith: any[];
    additionalInfo: any[];
    requiredRank: string;
    requireTokens: boolean;
    requireRankAndTokens: boolean;
    advanced: boolean;
    loadedItem: string;
    head?: string;
}
export interface ActionsItem {
    name: string;
    codeblockName: string;
    tags: TagsItem[];
    aliases: string[];
    icon: Icon;
    subActionBlocks?: string[];
}
export interface Icon {
    material: string;
    name: string;
    deprecatedNote: string[];
    description: string[];
    example: string[];
    worksWith: string[];
    additionalInfo: any[];
    requiredRank: string;
    requireTokens: boolean;
    requireRankAndTokens: boolean;
    advanced: boolean;
    loadedItem: string;
    tags?: number;
    arguments?: ArgumentsItem[];
    returnValues?: ReturnValuesItem[];
    head?: string;
    color?: Color;
    cancellable?: boolean;
    cancelledAutomatically?: boolean;
    returnType?: string;
    returnDescription?: string[];
}
export interface ArgumentsItem {
    type?: string;
    plural?: boolean;
    optional?: boolean;
    description?: string[];
    notes?: any[];
    text?: string;
}
export interface TagsItem {
    name: string;
    options: OptionsItem[];
    defaultOption: string;
    slot: number;
}
export interface OptionsItem {
    name: string;
    icon: Icon;
    aliases: string[];
}
export interface Color {
    red: number;
    green: number;
    blue: number;
}
export interface ReturnValuesItem {
    type?: string;
    description?: string[];
    text?: string;
}
export interface GameValueCategoriesItem {
    identifier: string;
    guiSlot: number;
    icon: Icon;
}
export interface GameValuesItem {
    aliases: string[];
    category: string;
    icon: Icon;
}
export interface ParticleCategoriesItem {
    particle: string;
    icon: Icon;
    category: string | null;
    fields: string[];
}
export interface ParticlesItem {
    particle: string;
    icon: Icon;
    category: string | null;
    fields: string[];
}
export interface SoundCategoriesItem {
    identifier: string;
    icon: Icon;
    hasSubCategories: boolean;
}
export interface SoundsItem {
    sound: string;
    soundId: string;
    icon: Icon;
    variants?: VariantsItem[];
}
export interface VariantsItem {
    id: string;
    name: string;
    seed: number;
}
export interface PotionsItem {
    potion: string;
    icon: Icon;
}
export interface CosmeticsItem {
    id: string;
    icon: Icon;
    name: string;
    category: Category;
}
export interface Category {
}
export interface ShopsItem {
    id: string;
    slot?: number;
    name?: string;
    icon?: Icon;
    purchasables: PurchasablesItem[];
}
export interface PurchasablesItem {
    item: Item;
    id: string;
    price?: number;
    currencyType?: string;
    oneTimePurchase?: boolean;
}

import { join } from "path";
import { readFileSync } from "fs";
const parentDir = typeof import.meta === "undefined" ? __dirname : import.meta.dir;
const rawDump = JSON.parse(readFileSync(join(parentDir, "actiondump.json"), { encoding: "utf-8" }));
export const actionDump = rawDump as ActionDump;