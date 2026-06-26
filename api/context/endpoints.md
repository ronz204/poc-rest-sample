# Feature Flag Engine — Endpoints

This document defines the HTTP contract for the API. It assumes the domain concepts from `overview.md` and the business rules from `features.md`. Each endpoint includes concrete request/response JSON examples.

## Conventions

- All flag-related paths are scoped under `/flags`.
- All segment-related paths are scoped under `/segments`.
- The evaluation endpoint is the hot path of this API and is designed for minimal latency; everything else is administrative and prioritizes correctness over speed.
- Errors follow a consistent shape:

```json
{
  "error": "RULE_CONFLICT",
  "message": "The submitted rule set contains conflicts.",
  "details": [
    { "position": 1, "conflictsWithPosition": 0, "reason": "unreachable-after-catch-all" }
  ]
}
```

`details` is only present for conflict errors (`422` on `PUT /flags/:key/rules`); other errors omit it.

---

## Flag Management

### `POST /flags`
Creates a new flag.

**Request body:**
```json
{
  "key": "new-checkout",
  "description": "New checkout flow with one-page payment",
  "globalState": "off",
  "defaultOutcome": "inactive"
}
```

**Responses:**

`201 Created`
```json
{
  "key": "new-checkout",
  "description": "New checkout flow with one-page payment",
  "globalState": "off",
  "defaultOutcome": "inactive",
  "rules": [],
  "createdAt": "2026-06-25T14:02:11.000Z",
  "updatedAt": "2026-06-25T14:02:11.000Z"
}
```

`409 Conflict`
```json
{ "error": "FLAG_KEY_EXISTS", "message": "A flag with key 'new-checkout' already exists." }
```

### `GET /flags/:key`
Retrieves the full definition of a flag, including its ordered rule list. Intended for administrative views (e.g. a dashboard), not for evaluation.

**Responses:**

`200 OK`
```json
{
  "key": "new-checkout",
  "description": "New checkout flow with one-page payment",
  "globalState": "on",
  "defaultOutcome": "inactive",
  "rules": [
    {
      "position": 0,
      "kind": "segment",
      "condition": { "segmentId": "8f14e45f-ceea-4b9a-8b41-4c1d2e3f9a01" },
      "outcome": "active"
    },
    {
      "position": 1,
      "kind": "percentage",
      "condition": { "percentage": 10 },
      "outcome": "active"
    }
  ],
  "createdAt": "2026-06-20T09:00:00.000Z",
  "updatedAt": "2026-06-25T14:02:11.000Z"
}
```

`404 Not Found`
```json
{ "error": "FLAG_NOT_FOUND", "message": "No flag with key 'new-checkout' exists." }
```

### `GET /flags`
Lists all flags, with a summary view (key, description, global state) rather than full rule detail, to keep the response light for dashboard listing use cases.

**Responses:**

`200 OK`
```json
{
  "flags": [
    { "key": "new-checkout", "description": "New checkout flow with one-page payment", "globalState": "on" },
    { "key": "dark-mode", "description": "Dark mode UI", "globalState": "off" }
  ]
}
```

### `PATCH /flags/:key/state`
Toggles the global on/off state of a flag. This is the kill-switch endpoint — it intentionally does not touch the rule list, so it remains the fastest and simplest way to disable a feature.

**Request body:**
```json
{ "globalState": "off" }
```

**Responses:**

`200 OK`
```json
{ "key": "new-checkout", "globalState": "off", "updatedAt": "2026-06-25T15:30:00.000Z" }
```

`404 Not Found` — same shape as `GET /flags/:key`'s 404.

### `PUT /flags/:key/rules`
Replaces the entire ordered rule list for a flag. This is a full replace, not a partial patch, because rule order is meaningful (see `features.md`, section 2.1).

**Request body:**
```json
{
  "rules": [
    {
      "position": 0,
      "kind": "segment",
      "condition": { "segmentId": "8f14e45f-ceea-4b9a-8b41-4c1d2e3f9a01" },
      "outcome": "active"
    },
    {
      "position": 1,
      "kind": "percentage",
      "condition": { "percentage": 10 },
      "outcome": "active"
    }
  ]
}
```

**Responses:**

`200 OK` — returns the full updated flag, same shape as `GET /flags/:key`.

`422 Unprocessable Entity`
```json
{
  "error": "RULE_CONFLICT",
  "message": "The submitted rule set contains conflicts.",
  "details": [
    { "position": 1, "conflictsWithPosition": 0, "reason": "unreachable-after-catch-all" }
  ]
}
```

### `DELETE /flags/:key`
Deletes a flag and its associated rules.

**Responses:**
- `204 No Content` — deleted successfully, empty body.
- `404 Not Found` — same shape as `GET /flags/:key`'s 404.

---

## Segment Management

### `POST /segments`
Creates a new segment.

**Request body:**
```json
{ "name": "beta-testers", "memberIds": ["user_123", "user_456"] }
```

**Responses:**

`201 Created`
```json
{
  "id": "8f14e45f-ceea-4b9a-8b41-4c1d2e3f9a01",
  "name": "beta-testers",
  "memberIds": ["user_123", "user_456"],
  "createdAt": "2026-06-25T14:10:00.000Z"
}
```

`409 Conflict`
```json
{ "error": "SEGMENT_NAME_EXISTS", "message": "A segment named 'beta-testers' already exists." }
```

### `GET /segments/:name`
Retrieves a segment's full membership list.

**Responses:**

`200 OK`
```json
{
  "id": "8f14e45f-ceea-4b9a-8b41-4c1d2e3f9a01",
  "name": "beta-testers",
  "memberIds": ["user_123", "user_456"]
}
```

`404 Not Found`
```json
{ "error": "SEGMENT_NOT_FOUND", "message": "No segment named 'beta-testers' exists." }
```

### `POST /segments/:name/members`
Adds one or more user identifiers to a segment.

**Request body:**
```json
{ "userIds": ["user_789"] }
```

**Responses:**

`200 OK`
```json
{
  "id": "8f14e45f-ceea-4b9a-8b41-4c1d2e3f9a01",
  "name": "beta-testers",
  "memberIds": ["user_123", "user_456", "user_789"]
}
```

`404 Not Found` — same shape as `GET /segments/:name`'s 404.

### `DELETE /segments/:name/members/:userId`
Removes a single user identifier from a segment.

**Responses:**

`200 OK`
```json
{
  "id": "8f14e45f-ceea-4b9a-8b41-4c1d2e3f9a01",
  "name": "beta-testers",
  "memberIds": ["user_123", "user_456"]
}
```

`404 Not Found`
```json
{ "error": "MEMBERSHIP_NOT_FOUND", "message": "User 'user_789' is not a member of segment 'beta-testers'." }
```

### `DELETE /segments/:name`
Deletes a segment, provided it is not currently referenced by any flag's rule set (see `features.md`, section 3.3).

**Responses:**
- `204 No Content` — deleted successfully.
- `404 Not Found` — same shape as `GET /segments/:name`'s 404.

`409 Conflict`
```json
{
  "error": "SEGMENT_IN_USE",
  "message": "Segment 'beta-testers' is referenced by one or more flags and cannot be deleted.",
  "details": [
    { "flagKey": "new-checkout", "rulePosition": 0 }
  ]
}
```

---

## Evaluation (Hot Path)

### `GET /flags/:key/evaluate`
Evaluates a single flag for a given user context.

**Query parameters:** user identifier (required), followed by any number of arbitrary attribute key/value pairs used for attribute-based rule matching.

**Example request:**
```
GET /flags/new-checkout/evaluate?userId=user_789&country=CR&plan=pro
```

**Responses:**

`200 OK`
```json
{
  "flagKey": "new-checkout",
  "outcome": "active",
  "matchedRulePosition": 1
}
```
(`matchedRulePosition: null` indicates the default outcome was used rather than any rule.)

`404 Not Found`
```json
{ "error": "FLAG_NOT_FOUND", "message": "No flag with key 'new-checkout' exists." }
```

### `POST /flags/evaluate-batch`
Evaluates multiple flags at once for the same user context, to save round trips for consumers checking several flags together (see `features.md`, section 4.4).

**Request body:**
```json
{
  "flagKeys": ["new-checkout", "dark-mode", "typo-flag"],
  "context": {
    "userId": "user_789",
    "attributes": { "country": "CR", "plan": "pro" }
  }
}
```

**Responses:**

`200 OK`
```json
{
  "results": [
    { "flagKey": "new-checkout", "outcome": "active", "matchedRulePosition": 1 },
    { "flagKey": "dark-mode", "outcome": "inactive", "matchedRulePosition": null },
    { "flagKey": "typo-flag", "error": "FLAG_NOT_FOUND" }
  ]
}
```
Note `typo-flag` does not fail the whole batch — it is reported per-item, while the other two valid flag keys still resolve normally.