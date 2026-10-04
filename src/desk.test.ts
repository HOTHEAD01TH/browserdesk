import { describe, expect, test } from "bun:test";
import { asksToPay, applyAction, costReport, actionQuestions, PAGES } from "./desk.ts";
import { NOT_RUNNING } from "./laya.ts";

describe("browserdesk", () => {
  test("pay jobs are rejected and a negated buy is not", () => {
    expect(asksToPay("Pay for the pro plan with the saved card.")).toBe(true);
    expect(asksToPay("Go to pricing and stop. Do not buy anything.")).toBe(false);
    expect(asksToPay("Open the docs page and extract the filter sentence.")).toBe(false);
  });

  test("action list has no pay or purchase", () => {
    const q = actionQuestions(PAGES["https://desk.local/"]!.links);
    const keys = Object.keys(q.action.criteria);
    expect(keys.sort()).toEqual(["extract", "navigate", "stop"]);
  });

  test("unknown action choice does not navigate", () => {
    const out = applyAction("https://desk.local/", {
      ok: true,
      model: "english",
      usage: null,
      routing: null,
      answers: {
        action: { type: "choice", choice: "pay", abstention: "passed", answer_confidence: 0.99 },
      },
    });
    expect(out.url).toBe("https://desk.local/");
    expect(out.done).toBe(true);
    expect(out.step.action).toBe("stop");
  });

  test("down model stops the step", () => {
    const out = applyAction("https://desk.local/", { ok: false, error: NOT_RUNNING });
    expect(out.done).toBe(true);
  });

  test("cost is unknown when usage has no cost field", () => {
    const report = costReport([{ input_tokens: 12, output_tokens: 3 }]);
    expect(report.cost).toBe("cost is unknown");
    expect(report.usage).toEqual({ input_tokens: 12, output_tokens: 3 });
  });

  test("missing usage still says the cost is unknown", () => {
    expect(costReport([null]).cost).toBe("cost is unknown");
  });
});
