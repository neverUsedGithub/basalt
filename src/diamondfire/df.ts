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

// export async function writeBlocks(file: string, hotbarId: number, options: ItemOptions) {
//   const { parsed } = await nbt.parse(await readFile(file));
//   const hotbars = (parsed as nbt.Tags["compound"]).value;
//   const hotbar = hotbars[hotbarId] as nbt.Tags["list"];
//   const hotbarItems = hotbar.value.value as nbt.Tags["compound"]["value"][];

//   const newItem = nbt.comp({
//     id: nbt.string("minecraft:ender_chest"),
//     Count: nbt.byte(1),
//     tag: nbt.comp({
//       PublicBukkitValues: nbt.comp({
//         "hypercube:codetemplatedata": nbt.string(
//           JSON.stringify({
//             author: options?.author ?? "unknown",
//             name: options?.name ?? "unnamed",
//             version: 1,
//             code: await compressBlocks(options.blocks),
//           }),
//         ),
//       }),
//       display: nbt.comp({
//         Name: nbt.string(JSON.stringify(options?.displayName ?? { text: "Unnamed Template", color: "red" })),
//       }),
//     }),
//   });

//   hotbarItems[0] = newItem.value;
//   for (let i = 1; i < 9; i++)
//     hotbarItems[i] = nbt.comp({
//       id: nbt.string("minecraft:air"),
//       Count: nbt.byte(0),
//     }).value;

//   const out = nbt.writeUncompressed(parsed);
//   await Bun.write(file, out.buffer);
// }

// const template = new DFTemplate();

// template.addBlock({
//   id: "block",
//   block: "event",
//   action: "Join",
//   args: {
//     items: []
//   }
// })

// template.addBlock({
//   id: "block",
//   block: "player_action",
//   action: "SendMessage",
//   args: {
//     items: [
//       {
//         item: {
//           data: { name: "Hello, World!" },
//           id: "txt",
//         },
//         slot: 0,
//       },
//       {
//         item: {
//           data: { name: "Testing" },
//           id: "txt"
//         },
//         slot: 1
//       },
//       {
//         item: {
//           data: { name: "Testing 3" },
//           id: "txt"
//         },
//         slot: 2
//       },
//     ],
//   },
// });

// const HOTBAR_FILE_LOCATION = String.raw`F:\Prism Launcher Data\instances\Fabulously Optimized\.minecraft\hotbar.nbt`;
const HOTBAR_FILE_LOCATION = String.raw`C:\Users\PC\AppData\Roaming\.minecraft\hotbar.nbt`;

// console.log(JSON.stringify(template.json(), null, 2));
// await template.write(HOTBAR_FILE_LOCATION, 0, { name: "yooo" });

function getBlock(action: "CreateList" | "AppendValue", type: string, numbers: number[]) {
  return {
    id: "block",
    block: "set_var",
    action,
    args: {
      items: [
        {
          item: {
            id: "var",
            data: {
              name: "permutations",
              scope: "unsaved",
            },
          },
          slot: 0,
        },
        ...numbers.map((num, i) => ({
          item: {
            id: type,
            data: {
              name: num.toString(),
            },
          },
          slot: i + 1,
        })),
      ],
    },
  };
}

// const items = [
//   151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21,
//   10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149,
//   56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229,
//   122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209,
//   76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217,
//   226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42,
//   223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98,
//   108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179,
//   162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50,
//   45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
// ];

// const items = JSON.parse(await Bun.file("src/df/uuids.json").text());

// const blocks: DFBlock[] = [];
// const chunk: number[] = [];
// let chunkId = 0;

// for (let i = 0; i < items.length; i++) {
//   if (chunk.length >= 26) {
//     blocks.push(getBlock(chunkId === 0 ? "CreateList" : "AppendValue", "str", chunk) as any);
//     chunk.length = 0;
//     chunkId++;
//   }

//   chunk.push(items[i]);
// }

// blocks.push(getBlock(chunkId === 0 ? "CreateList" : "AppendValue", "str", chunk) as any);
// console.log(JSON.stringify(blocks, null, 2));

// const ws = new WebSocket("ws://localhost:31375");
// const item = await snbtFromBlocks({ blocks });

// ws.addEventListener("open", () => {
//   console.log("connected to codeclient, requesting inventory scope");
//   ws.send("scopes inventory");
// });

// ws.addEventListener("message", async ({ data }) => {
//   if (data === "auth") {
//     const item = await snbtFromBlocks({ blocks });

//     ws.send(`give ${item}`);
//     ws.close();
//   }
// });
