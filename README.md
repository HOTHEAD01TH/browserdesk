# browserdesk

Job queue over a local page graph. Laya picks the next action from a short list: navigate, extract, stop. There is no purchase action and no pay action. If a job asks to pay, it is rejected and Laya is not called. Steps are simulated in-process. The app does not open or drive a logged-in browser.

Cost is taken from a `cost` field on Laya usage when that field exists. Otherwise the API and the page say `cost is unknown`. Token counts are shown only when Laya returns them. No dollar figure is invented.

If the sidecar is down or the checkpoint is not loaded, the API and the page say `Laya not running` and the job has no fabricated action scores.

## Run

```bash
python3 -m pip install laya
python3 sidecar.py
```

Sidecar: `127.0.0.1:4013`. `Router.predict` in-process. `LAYA_SERVE_BACKEND=laya` or the sidecar refuses the request. The first predict downloads weights from `huggingface.co/convaiinnovations/laya`. Listening does not.

```bash
bun install && bun run start
```

UI: `http://127.0.0.1:3013`.

Abstention uses `min_confidence` (0.6). An abstained action stops the job. The app does not read `action.act_probability`.
