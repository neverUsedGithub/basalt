import { TypeCheckerCallable, type TypeCheckerCallableSignature } from "./callable";
import type { TypeCheckerType } from "./type";

export interface TypeCheckerActionOptions {
  action: string;
  codeblock: string;
}

export class TypeCheckerAction extends TypeCheckerCallable implements TypeCheckerType {
  constructor(
    name: string,
    signature: TypeCheckerCallableSignature,
    public opts: TypeCheckerActionOptions,
  ) {
    super(name, signature);
  }
}
