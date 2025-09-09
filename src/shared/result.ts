class ResultValue<TOk, TErr> {
  constructor(
    private _isOk: boolean,
    private value: any,
  ) {}

  unwrap(): TOk {
    if (!this._isOk) throw new Error("cannot unwrap Err() value");
    return this.value;
  }

  unwrapErr(): TErr {
    if (this._isOk) throw new Error("cannot unwrapErr Ok() value");
    return this.value;
  }

  isOk(): boolean {
    return this._isOk;
  }

  isErr(): boolean {
    return !this._isOk;
  }
}

export function Ok<TOk>(value: TOk): Result<TOk, never> {
  return new ResultValue(true, value);
}

export function Err<TErr>(value: TErr): Result<never, TErr> {
  return new ResultValue(false, value);
}

export type Result<TOk, TErr> = ResultValue<TOk, never> | ResultValue<never, TErr>;
