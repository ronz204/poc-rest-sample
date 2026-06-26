# Feature Flag Engine — Overview

## What This Project Is

A backend service that lets a system decide, per request, whether a given feature should be active for a specific user. Unlike a simple boolean toggle, this engine supports **targeting**: the answer to "is this feature on?" can depend on who is asking — their attributes, their group membership, or a controlled random rollout.

This is the kind of system that sits behind a product team saying: "Let's enable the new checkout flow for 10% of users first" or "Only show this to users in Costa Rica" or "Only my internal team should see this while we test it."

## Why This Project Is Interesting (Architecturally)

Most CRUD APIs don't have real domain logic — they validate input and persist it. This project is different because:

- **The evaluation logic is genuine business logic.** Deciding whether a flag is active for a given user involves rules, ordering, and a deterministic randomization algorithm — not just a database lookup.
- **It has a real performance constraint.** The evaluation endpoint is expected to be called extremely often (on most page loads, for example), so caching and fast-path design matter for real reasons, not as an academic exercise.
- **It has more than one meaningful port.** A flag repository (persistence) and a flag cache (speed) are genuinely separate concerns with separate lifecycles — this is a natural fit for ports and adapters, not a forced one.
- **It has a non-trivial consistency rule.** The same user must always get the same answer for the same flag (no flickering between requests), which forces a deterministic design instead of a naive random one.

## Core Domain Concepts

### Flag
A feature that can be turned on or off in a controlled way. Each flag has:
- A unique key (e.g. `new-checkout`)
- A global on/off switch (kill switch) — if off, no rule evaluation happens at all
- An ordered list of targeting rules
- A default outcome, used when no rule matches

### Rule
A single targeting condition attached to a flag, evaluated in order. A rule answers: "does this user match my condition, and if so, what's the outcome?" There are three kinds of rules:
- **Attribute rule** — matches on an exact attribute value (e.g. `country == "CR"`)
- **Segment rule** — matches if the user belongs to a named segment
- **Percentage rollout rule** — matches a deterministic percentage of users, without storing any per-user decision

Rules are ordered, and the first rule that matches determines the outcome. This ordering is an explicit part of the flag's configuration, not an implementation detail.

### Segment
A reusable, named group of users (e.g. `beta-testers`, `internal-team`). Segments exist independently of any single flag, so the same group can be referenced by multiple flags without duplicating membership data. A user's segment membership is checked at evaluation time.

### Evaluation Context
The set of information about a user that travels with each evaluation request — at minimum a user identifier, plus any attributes relevant to targeting (e.g. country, plan tier). The system never assumes where this data originates (token, header, query parameter); it only consumes whatever context is provided.

### Evaluation
The act of answering "is this flag active for this context?" This is the most frequent operation in the system and the one most worth optimizing.

### Shape of a Flag (Reference Example)

To make the concepts above concrete, here is what a fully configured flag looks like as JSON. This same shape reappears throughout `endpoints.md`, `database.md`, and `workflows.md`.

```json
{
  "key": "new-checkout",
  "description": "New checkout flow with one-page payment",
  "globalState": "on",
  "defaultOutcome": "inactive",
  "rules": [
    {
      "order": 0,
      "kind": "segment",
      "condition": { "segment": "internal-team" },
      "outcome": "active"
    },
    {
      "order": 1,
      "kind": "percentage",
      "condition": { "percentage": 10 },
      "outcome": "active"
    }
  ]
}
```

Reading this flag: internal team members always get the new checkout; everyone else has a 10% deterministic chance of getting it; everyone else falls through to `defaultOutcome` ("inactive").

## Key Design Principles

1. **Determinism over randomness.** Percentage rollouts use a hash of the user identifier and the flag key, not a random number generator, so the same user always gets the same result for the same flag.
2. **Conflicts are prevented at write time, not evaluation time.** Rule conflicts (e.g. two rules with the identical condition, or an unreachable rule) are detected when rules are created or updated — never during evaluation, which must stay fast and side-effect free.
3. **Read-heavy, write-light.** The system is designed assuming evaluations vastly outnumber configuration changes. Caching strategy and data modeling both follow from this assumption.
4. **Segments are a first-class, shared resource.** They are not an attribute of a flag; they are an independent entity that flags reference.

## What This Project Is Not

- It is not a full experimentation/A-B testing platform (no statistical analysis, no automatic winner selection).
- It is not a multi-tenant SaaS product — single workspace, single set of flags.
- It does not include an audit log or flag change history (explicitly out of scope, could be a future extension).