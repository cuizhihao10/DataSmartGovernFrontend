import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "src/pages/DataSync.tsx"), "utf8");
const effectStart = source.indexOf("消费 Agent 历史结果携带的任务定位");
const effectEnd = source.indexOf("agentWizardHandoff", effectStart);
const effect = source.slice(effectStart, effectEnd);

assert(effectStart >= 0 && effectEnd > effectStart, "Agent task locator effect must remain discoverable");
assert(
  effect.indexOf("consumedAgentTaskLocator.current = locatorKey") > effect.indexOf(".then((result)"),
  "the locator must be consumed only after the task has loaded successfully",
);
assert(effect.includes("agentTaskLocatorRetryVersion"), "transient failures must expose a retry trigger");
assert(effect.includes("instanceof ApiError"), "HTTP scope failures must be distinguished from transient failures");
assert(effect.includes("status === 401") && effect.includes("status === 403") && effect.includes("status === 404"),
  "authorization/not-found status handling must stay explicit");
assert(effect.includes("重试"), "the transient failure message must offer a user retry action");

console.log("PASS DataSync Agent task locator consumes only successful loads and preserves transient retry");
