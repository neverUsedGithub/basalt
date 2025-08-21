import * as path from "path";
import EventEmitter from "events";
import temporaryDirectory from "temp-dir";
import type { DFBlockRow } from "../shared/blocks";

interface CodeClientEvents {
  auth: [];
  error: [];
  connect: [];
  disconnect: [];
}

const TEMPORARY_TOKEN_FILE = Bun.file(path.join(temporaryDirectory, ".basalt.token.temp"));

export type CodeClientScope = "movement" | "write_code" | "read_code" | "clear_plot" | "inventory" | "plot";
export type CodeClientMode = "play" | "dev" | "build";

export enum CodeClientState {
  UNAUTHED,
  TOKEN_INVALID,
  AUTHED,
}

export class CodeClientConnection extends EventEmitter<CodeClientEvents> {
  private codeClientState: CodeClientState = CodeClientState.UNAUTHED;
  private token: string | null;
  private ws: WebSocket;

  private activeTransaction: (() => void) | null = null;

  constructor(private scopes: CodeClientScope[]) {
    super();

    this.token = null;
    this.ws = new WebSocket("ws://localhost:31375");

    this.ws.addEventListener("error", () => this.emit("error"));
    this.ws.addEventListener("open", () => this.emit("connect"));
    this.ws.addEventListener("close", () => this.emit("disconnect"));
    this.ws.addEventListener("message", async ({ data }) => this.onMessage(data as string));

    this.on("connect", async () => {
      this.token = await this.getSavedToken();
      if (this.token) this.ws.send(`token ${this.token}`);
      else this.ws.send(`scopes ${this.scopes.join(" ")}`);
    });
  }

  placeTemplates(templates: DFBlockRow[]): Promise<void> {
    return new Promise(async (res, rej) => {
      this.activeTransaction = res;

      this.ws.send("place swap");
      for (const item of templates) this.ws.send(`place ${await item.compressed()}`);
      this.ws.send("place go");
    });
  }

  setMode(mode: CodeClientMode): void {
    this.ws.send(`mode ${mode}`);
  }

  close() {
    this.ws.close();
  }

  authed(): Promise<void> {
    if (this.codeClientState === CodeClientState.AUTHED) return Promise.resolve();
    return new Promise((res) => this.once("auth", res));
  }

  private async getSavedToken(): Promise<string | null> {
    return await TEMPORARY_TOKEN_FILE.text().catch(() => null);
  }

  private async setSavedToken(token: string): Promise<void> {
    await Bun.write(TEMPORARY_TOKEN_FILE, token);
  }

  private async onMessage(data: string) {
    const [command, ...args] = data.split(" ");

    if (command === "auth") {
      const state = this.codeClientState;
      this.codeClientState = CodeClientState.AUTHED;

      this.emit("auth");
      if (state === CodeClientState.TOKEN_INVALID) this.ws.send("token");
    } else if (command === "invalid" && args[0] === "token") {
      this.codeClientState = CodeClientState.TOKEN_INVALID;
      this.ws.send(`scopes ${this.scopes.join(" ")}`);
    } else if (command === "token") {
      this.setSavedToken(args[0]);
    } else if (command === "place" && args[0] === "done") {
      if (this.activeTransaction) this.activeTransaction();
    }
  }
}
