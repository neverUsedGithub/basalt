import { decode, encode, stringify, Byte } from "nbt-ts";
import type { DFBlock, MCText } from "./types";
import { compressDF } from "./compression";

export async function compressBlocks(blocks: DFBlock[]): Promise<string> {
  return await compressDF({ blocks });
}

export interface ItemOptions {
  blocks: DFBlock[];
  name?: string;
  displayName?: MCText;
  author?: string;
  lore?: MCText[];
}

export async function snbtFromBlocks(options: ItemOptions): Promise<string> {
  return stringify(
    {
      Count: new Byte(1),
      id: "minecraft:ender_chest",
      components: {
        "minecraft:custom_name": JSON.stringify(options?.displayName ?? { text: "Generated Template", color: "aqua" }),
        "minecraft:lore": options?.lore?.map((v) => JSON.stringify(v)) ?? [],
        "minecraft:custom_data": {
          PublicBukkitValues: {
            "hypercube:codetemplatedata": JSON.stringify({
              author: options?.author ?? "unknown",
              name: options?.name ?? "unnamed",
              version: 1,
              code: await compressBlocks(options.blocks),
            }),
          },
        },
      },
    },
    {
      breakLength: Infinity,
      pretty: false,
    },
  );
}