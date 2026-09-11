# MilkFlow AI pump coach backend

This Firebase Function is an **optional explanation layer** over MilkFlow's deterministic pump coach. The app never depends on AI to save data or calculate the immediate next-pump suggestion.

## Context model

Every request is authenticated with the signed-in Firebase user's ID token. The function reads the user's canonical Firestore pumping records for the recent window and merges them with the client's recent local records so a just-entered or not-yet-synced pump is not lost.

The model receives a compact, versioned context packet containing:

- current 5/6-pump target and Normal / Tired / Travel mode
- saved pump schedule and daily output goal
- current deterministic next-pump recommendation
- recent pump times, amounts and durations
- nursing counts/minutes kept separate from pumped volume
- 30 daily summaries (pump count, total mL, first/last pump, average/longest gap)
- 7-day output average, prior 7-day average and change
- recent coach-day history so 5-pump trials can be compared with earlier 6-pump days
- postpartum weeks when a baby birth date exists

Names, email addresses, notes and Baby-event history are not sent to the OpenAI model.

## Reliability design

1. `smart-pumping.js` always produces the immediate recommendation locally.
2. The browser calls this function only as an enhancement.
3. The function verifies Firebase identity and rebuilds context from Firestore + current client data.
4. The OpenAI call uses a strict JSON response contract and a primary + fallback model attempt.
5. If OpenAI is unavailable, the function returns a deterministic rules-based explanation with HTTP 200.
6. If the whole endpoint is unreachable, the browser keeps the local coach on screen and restores the most recent AI explanation if available.

This makes the user flow resilient, but no external API can be guaranteed to have zero outages.

## One-time deployment

From a trusted development machine authenticated to the Firebase project:

```bash
firebase functions:secrets:set OPENAI_API_KEY
firebase deploy --only functions:pumpCoachAI
```

Do not commit or paste the API key into `config.js`, GitHub, or browser JavaScript.

After deployment, set `MILKFLOW_CONFIG.aiCoachEndpoint` in `config.js` to the HTTPS URL printed by Firebase (normally the `us-central1` `pumpCoachAI` function URL), then deploy the web app.

The default model is `gpt-5.6-sol`; the backend can override it with `OPENAI_MODEL` without changing the browser app.
