import type { TypeCheckerType } from "./type";

export interface TypeCheckerIterable {
  getIteratePattern(): TypeCheckerType[];
}