# Feature Flag Engine — Workflows

This document walks through the system end-to-end from two perspectives: the **administrator** configuring flags, and the **consumer** (another service) checking flags at runtime. It ties together the concepts from `overview.md`, the rules from `features.md`, the contract from `endpoints.md`, and the entities from `database.md`.

## Workflow 1: Setting Up a New Flag From Scratch

This is the typical path a team follows when rolling out a new feature.

1. **Create the flag in an off state.**

```bash
curl -X POST http://localhost:3000/flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "new-checkout",
    "description": "New checkout flow with one-page payment",
    "globalState": "off",
    "defaultOutcome": "inactive"
  }'
```

At this point the feature is fully dark — no consumer will see it active no matter what context they send.

2. **Define the rollout strategy as rules.**

```bash
curl -X PUT http://localhost:3000/flags/new-checkout/rules \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      { "position": 0, "kind": "segment", "condition": { "segmentId": "8f14e45f-ceea-4b9a-8b41-4c1d2e3f9a01" }, "outcome": "active" },
      { "position": 1, "kind": "percentage", "condition": { "percentage": 10 }, "outcome": "active" }
    ]
  }'
```

This puts a segment rule for `internal-team` first (so internal testers always see it regardless of rollout percentage), followed by a percentage rule for the gradual public rollout.

3. **The system validates the rule set before saving.** If the team accidentally adds a 100% percentage rule before the segment rule, the unreachable-rule conflict check (see `features.md`, section 2.2) rejects the update with a `422` and explains why — preventing a misconfiguration from ever reaching production:

```json
{
  "error": "RULE_CONFLICT",
  "message": "The submitted rule set contains conflicts.",
  "details": [
    { "position": 1, "conflictsWithPosition": 0, "reason": "unreachable-after-catch-all" }
  ]
}
```

4. **Flip the global state on.**

```bash
curl -X PATCH http://localhost:3000/flags/new-checkout/state \
  -H "Content-Type: application/json" \
  -d '{ "globalState": "on" }'
```

From this moment, evaluations start consulting the rule list instead of short-circuiting to "inactive."

5. **Widen the rollout over time.** The team repeats step 2 with an increasing percentage value (e.g. `25`, then `50`, then `100`) as confidence grows, until the flag either reaches 100% or is removed entirely once the feature becomes permanent.

## Workflow 2: Emergency Rollback

This is the path that justifies the kill-switch design decision in `features.md`, section 1.2.

1. A feature behind a flag starts causing problems in production.
2. The team calls:

```bash
curl -X PATCH http://localhost:3000/flags/new-checkout/state \
  -H "Content-Type: application/json" \
  -d '{ "globalState": "off" }'
```

3. Every subsequent evaluation call for that flag returns "inactive" immediately, without consulting any rule — this is intentionally the fastest, simplest code path in the entire evaluation flow, because it has to work even if the rule configuration itself is the source of the problem.
4. No rule data is touched or lost. Once the issue is fixed, the team can flip the global state back on (same call, `"globalState": "on"`) and resume exactly where the rollout left off.

## Workflow 3: A Consumer Checking a Flag (Hot Path)

This is what happens many times per second, from a consuming service's point of view.

1. A user makes a request to the consuming service (e.g. loads a page).
2. The consuming service already has the user's identifier and relevant attributes (country, plan, etc.) — it does not need to ask this API where that data comes from.
3. The consuming service calls:

```bash
curl "http://localhost:3000/flags/new-checkout/evaluate?userId=user_789&country=CR&plan=pro"
```

4. Internally, this API:
   - Checks the cache for the flag's definition. On a cache hit, no database call happens at all.
   - On a cache miss, loads the flag and its rules from persistent storage, then populates the cache for subsequent requests.
   - Runs the evaluation logic described in `features.md`, section 4.1 entirely in memory against the loaded definition.
5. The consuming service receives:

```json
{ "flagKey": "new-checkout", "outcome": "active", "matchedRulePosition": 1 }
```

and decides what to render or which code path to execute.

**Why this matters as a workflow, not just an endpoint:** the entire point of separating "definition" (cached, infrequently changing) from "evaluation" (in-memory, per-request) is that step 4 should almost never touch persistent storage. If this workflow is implemented correctly, the database is mostly invisible at runtime — it only gets exercised when an admin changes something or when cache is cold.

## Workflow 4: Updating a Segment Used by Multiple Flags

This workflow demonstrates why segments are modeled as independent, shared entities.

1. A team maintains a `beta-testers` segment, referenced by three different flags' rules.
2. A new beta tester is added:

```bash
curl -X POST http://localhost:3000/segments/beta-testers/members \
  -H "Content-Type: application/json" \
  -d '{ "userIds": ["user_789"] }'
```

3. No flag's rule list is touched. Nothing about any of the three flags changes in storage.
4. The next time any of those three flags is evaluated for that user, the segment rule will now match — because segment membership is checked live at evaluation time (see `features.md`, section 4.3), not cached separately from the segment's own data.
5. If the team later tries to delete the `beta-testers` segment while these three flags still reference it:

```bash
curl -X DELETE http://localhost:3000/segments/beta-testers
```

the deletion is rejected with a `409`:

```json
{
  "error": "SEGMENT_IN_USE",
  "message": "Segment 'beta-testers' is referenced by one or more flags and cannot be deleted.",
  "details": [
    { "flagKey": "new-checkout", "rulePosition": 0 },
    { "flagKey": "dark-mode", "rulePosition": 0 },
    { "flagKey": "beta-dashboard", "rulePosition": 2 }
  ]
}
```

## Workflow 5: Checking Several Flags on One Page Load

1. A consuming service's page depends on the state of four different flags.
2. Instead of making four separate calls to `GET /flags/:key/evaluate`, the consuming service calls:

```bash
curl -X POST http://localhost:3000/flags/evaluate-batch \
  -H "Content-Type: application/json" \
  -d '{
    "flagKeys": ["new-checkout", "dark-mode", "beta-dashboard", "experimental-search"],
    "context": {
      "userId": "user_789",
      "attributes": { "country": "CR", "plan": "pro" }
    }
  }'
```

3. The API evaluates each flag independently using the same logic as the single-flag path (no shared state between the four evaluations within the batch), and returns all four outcomes together:

```json
{
  "results": [
    { "flagKey": "new-checkout", "outcome": "active", "matchedRulePosition": 1 },
    { "flagKey": "dark-mode", "outcome": "inactive", "matchedRulePosition": null },
    { "flagKey": "beta-dashboard", "outcome": "active", "matchedRulePosition": 0 },
    { "flagKey": "experimental-search", "error": "FLAG_NOT_FOUND" }
  ]
}
```

4. If one of the four flag keys doesn't exist (e.g. a typo, or a flag that was deleted, like `experimental-search` above), that entry in the response is marked as not found, while the other three still return valid outcomes — a mistake on one flag key does not fail the whole batch.

## Summary: Who Touches What, and When

| Actor | Frequency | Primary concern |
|---|---|---|
| Administrator | Low (configuration changes) | Correctness, conflict prevention |
| Consuming service | Very high (every relevant user action) | Speed, cache hit rate |
| Cache | Updated on every admin write, read on every evaluation | Keeping evaluation off the database's critical path |
| Database | Touched on writes and cache misses only | Durable source of truth, not a runtime dependency for evaluation |