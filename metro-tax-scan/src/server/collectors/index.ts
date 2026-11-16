import type { CountyCollectResult } from "../types";
import { collectCobb } from "./cobb";
import { collectDekalb } from "./dekalb";
import { collectFulton } from "./fulton";
import { collectHenry } from "./henry";

export async function collectAllCounties(): Promise<CountyCollectResult[]> {
  const results = await Promise.all([
    collectDekalb(),
    collectCobb(),
    collectFulton(),
    collectHenry(),
  ]);
  return results;
}
