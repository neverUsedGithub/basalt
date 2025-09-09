import os from "os";
import fs from "fs/promises";

export async function getTempDir() {
  return await fs.realpath(os.tmpdir());
}
