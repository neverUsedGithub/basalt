import zlib from "node:zlib";
import type { DFCode } from "./types";
import { promisify } from "node:util";

const compressGZIP = promisify(zlib.gzip);
const decompressGZIP = promisify(zlib.gunzip);

export async function decompressDF(source: string): Promise<DFCode> {
  const compressedCode = Buffer.from(source, "base64");
  const stringifiedCode = await decompressGZIP(compressedCode as any);

  return JSON.parse(stringifiedCode.toString("utf-8"));
}

export async function compressDF(source: DFCode): Promise<string> {
  const outputCodeCompressed = await compressGZIP(JSON.stringify(source));
  return outputCodeCompressed.toString("base64");
}
