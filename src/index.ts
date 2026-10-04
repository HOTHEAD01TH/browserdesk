import { Hono } from "hono";
import {
  PAGES,
  SEED,
  START,
  actionQuestions,
  applyAction,
  asksToPay,
  costReport,
  layaState,
  type Step,
} from "./desk.ts";
import { NOT_RUNNING, predict, sidecarHealth, type Usage } from "./laya.ts";

const PORT = 3013;
const MAX_STEPS = 6;

type Job = {
  id: string;
  goal: string;
  status: "queued" | "done" | "rejected" | "stopped";
  steps: Step[];
  result: string | null;
  cost: string | null;
  usage: { input_tokens: number; output_tokens: number } | null;
  error: string | null;
};

const jobs: Job[] = SEED.map((seed) => ({
  ...seed,
  status: "queued",
  steps: [],
  result: null,
  cost: null,
  usage: null,
  error: null,
}));

async function runJob(job: Job): Promise<Job> {
  if (asksToPay(job.goal)) {
    job.status = "rejected";
    job.result = "Rejected. Pay and purchase actions are not available.";
    job.cost = "cost is unknown";
    job.usage = null;
    job.error = null;
    job.steps = [];
    return job;
  }
  let url = START;
  const extracted: string[] = [];
  const usages: Usage[] = [];
  job.steps = [];
  for (let i = 0; i < MAX_STEPS; i++) {
    const page = PAGES[url];
    const result = await predict(layaState(job.goal, url), actionQuestions(page?.links ?? []));
    if (!result.ok) {
      job.status = "stopped";
      job.error = NOT_RUNNING;
      job.result = null;
      job.cost = "cost is unknown";
      job.usage = null;
      return job;
    }
    usages.push(result.usage);
    const applied = applyAction(url, result);
    url = applied.url;
    job.steps.push(applied.step);
    if (applied.extracted) extracted.push(applied.extracted);
    if (applied.done || applied.step.action === "stop") break;
  }
  const cost = costReport(usages);
  job.status = "done";
  job.error = null;
  job.result = extracted.length ? extracted.join("\n") : "Stopped without an extract.";
  job.cost = cost.cost;
  job.usage = cost.usage;
  return job;
}

const app = new Hono();
const page = await Bun.file(new URL("../public/index.html", import.meta.url)).text();

app.get("/", (c) => c.html(page));
app.get("/api/health", async (c) => {
  const health = await sidecarHealth();
  if (!health.loaded) return c.json({ loaded: false, error: NOT_RUNNING });
  return c.json({ loaded: true, error: null });
});
app.get("/api/jobs", (c) => c.json({ jobs }));
app.post("/api/jobs/:id/run", async (c) => {
  const job = jobs.find((row) => row.id === c.req.param("id"));
  if (!job) return c.json({ error: "unknown job" }, 404);
  await runJob(job);
  return c.json({ job });
});

if (import.meta.main) {
  Bun.serve({ hostname: "127.0.0.1", port: PORT, fetch: app.fetch });
  console.log(`browserdesk listening on http://127.0.0.1:${PORT}`);
}
