/**
 * Local page graph. Steps are simulated here. Nothing drives a browser.
 * The only actions Laya may pick are navigate, extract, and stop.
 * A job that asks to pay is rejected before any model call.
 */
import { costNote, passed, type LayaResult, type Usage } from "./laya.ts";

export const PAGES: Record<string, { title: string; text: string; links: string[] }> = {
  "https://desk.local/": {
    title: "Home",
    text: "Welcome. Links: pricing, docs.",
    links: ["https://desk.local/pricing", "https://desk.local/docs"],
  },
  "https://desk.local/pricing": {
    title: "Pricing",
    text: "Plans are listed on this page. This desk cannot pay.",
    links: ["https://desk.local/docs", "https://desk.local/"],
  },
  "https://desk.local/docs": {
    title: "Docs",
    text: "Filters accept a column, an operator, and a value drawn from the schema.",
    links: ["https://desk.local/", "https://desk.local/pricing"],
  },
};

export const START = "https://desk.local/";

export type JobSeed = { id: string; goal: string };

export const SEED: JobSeed[] = [
  { id: "j1", goal: "Open the docs page and extract the filter sentence." },
  { id: "j2", goal: "Go to pricing and stop. Do not buy anything." },
  { id: "j3", goal: "Pay for the pro plan with the saved card." },
  { id: "j4", goal: "From home, navigate to docs, extract the text, then stop." },
];

export function asksToPay(goal: string): boolean {
  const text = goal.toLowerCase();
  const negated = /\b(do not|don't|never)\b[^.]{0,48}\b(pay|purchase|buy|checkout)\b/;
  const intent = /\b(pay for|purchase|buy the|buy now|complete checkout|place the order|enter the card|use the card|with the saved card)\b/;
  if (negated.test(text) && !/\bpay for\b/.test(text)) return false;
  return intent.test(text);
}

export function actionQuestions(links: string[]) {
  const target: Record<string, string> = { stay: "do not change page" };
  for (const link of links) target[link] = `open ${link}`;
  return {
    action: {
      type: "choice" as const,
      instructions: "Pick the next step. There is no purchase and no pay action.",
      criteria: {
        navigate: "open one of the listed links",
        extract: "copy the current page text into the result",
        stop: "finish the job",
      },
    },
    target: {
      type: "choice" as const,
      instructions: "If the action is navigate, which listed link should open?",
      criteria: target,
    },
  };
}

export function layaState(goal: string, url: string) {
  const page = PAGES[url];
  return {
    goal,
    url,
    title: page?.title ?? "",
    links: page?.links ?? [],
  };
}

export type Step = {
  action: string;
  url: string;
  detail: string;
  abstained: boolean;
};

export function applyAction(
  url: string,
  result: LayaResult,
): { url: string; step: Step; done: boolean; extracted: string | null } {
  const page = PAGES[url];
  if (!page || !result.ok) {
    return {
      url,
      done: true,
      extracted: null,
      step: { action: "stop", url, detail: "stopped", abstained: true },
    };
  }
  const action = result.answers.action;
  const target = result.answers.target;
  if (!action || action.type !== "choice" || !passed(action) || typeof action.choice !== "string") {
    return { url, done: true, extracted: null, step: { action: "stop", url, detail: "abstain", abstained: true } };
  }
  if (action.choice === "extract") {
    return {
      url,
      done: false,
      extracted: page.text,
      step: { action: "extract", url, detail: page.text, abstained: false },
    };
  }
  if (action.choice === "navigate") {
    const next = target && target.type === "choice" && passed(target) ? target.choice : "";
    if (!next || !page.links.includes(next) || !PAGES[next]) {
      return { url, done: true, extracted: null, step: { action: "stop", url, detail: "navigate refused", abstained: true } };
    }
    return {
      url: next,
      done: false,
      extracted: null,
      step: { action: "navigate", url: next, detail: next, abstained: false },
    };
  }
  return { url, done: true, extracted: null, step: { action: "stop", url, detail: "stop", abstained: false } };
}

export function costReport(usages: Usage[]) {
  let input = 0;
  let output = 0;
  let saw = false;
  let priced: number | null = null;
  for (const usage of usages) {
    if (!usage) continue;
    if (typeof usage.input_tokens === "number") {
      input += usage.input_tokens;
      saw = true;
    }
    if (typeof usage.output_tokens === "number") {
      output += usage.output_tokens;
      saw = true;
    }
    if (typeof usage.cost === "number" && Number.isFinite(usage.cost)) priced = usage.cost;
  }
  const note = costNote(priced == null ? (saw ? { input_tokens: input, output_tokens: output } : null) : { cost: priced, input_tokens: input, output_tokens: output });
  return {
    cost: note.cost,
    usage: saw ? { input_tokens: input, output_tokens: output } : null,
  };
}
