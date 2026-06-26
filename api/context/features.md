# Feature Flag Engine — Features

This document describes the system's functionality and the business rules behind each capability. It assumes familiarity with the concepts defined in `overview.md`.

## 1. Flag Lifecycle

### 1.1 Create a Flag
A flag is created with a key, a description, an initial global state (on/off), and a default outcome. A newly created flag has no rules — it simply returns its default outcome to every evaluation until rules are added.

**Business rules:**
- The flag key must be unique across the system.
- The flag key is immutable once created (renaming a flag is treated as creating a new one, to avoid breaking existing integrations that reference the old key).

### 1.2 Update Global State (Kill Switch)
A flag can be toggled fully on or off, independent of its rules. When off, evaluation short-circuits immediately — no rule is evaluated, and the result is always "inactive," regardless of what the rules would have said.

**Why this matters:** this is the emergency-stop mechanism. If a feature misbehaves in production, turning the flag off must be instant and must not depend on the rule evaluation logic working correctly.

### 1.3 Delete a Flag
Deleting a flag removes its rules along with it. Any consumer still requesting evaluation for a deleted flag key should receive a clear "flag not found" response rather than a default value, so that misconfiguration on the consumer side is visible rather than silently masked.

## 2. Rule Management

### 2.1 Add or Update Rules
Rules are managed as an ordered list attached to a flag. Updating the rule set replaces the entire ordered list in one operation (rather than supporting partial inserts), because rule order is meaningful and partial updates make ordering ambiguous.

**Business rules:**
- Rules are evaluated strictly in the order provided; the first match wins.
- Each rule must declare its kind (attribute, segment, or percentage) and its outcome.

### 2.2 Conflict Detection (Write-Time Validation)
Before a rule set is saved, the system validates it for conflicts. This validation happens once, at write time — never during evaluation. Conflicts that must be detected:

- **Duplicate conditions:** two rules with the exact same condition (e.g. the same attribute/value pair, or the same segment) within one flag. The second occurrence can never be reached and is rejected.
- **Unreachable rules:** any rule placed after a rule that matches unconditionally for all possible contexts (most notably, a percentage rule set to 100%). Everything after such a rule is dead configuration.
- **Contradictory percentage totals:** this system does not require percentage rules within a flag to sum to 100 — a flag can have a single 10% rollout rule with everything else falling to default. This is not treated as a conflict; only unreachability and duplication are.

If a conflict is detected, the update is rejected with a description of which rules conflict and why. The flag's previous, valid rule set remains in effect.

**Reference implementation:**

```typescript
type RuleInput = {
  position: number;
  kind: "attribute" | "segment" | "percentage";
  condition: Record<string, unknown>;
  outcome: "active" | "inactive";
};

type ConflictError = {
  position: number;
  conflictsWithPosition: number;
  reason: "duplicate-condition" | "unreachable-after-catch-all";
};

function conditionKey(rule: RuleInput): string {
  // Normalizes a condition into a comparable string so two rules
  // with the same effective condition can be detected regardless
  // of key ordering in the input object.
  return `${rule.kind}:${JSON.stringify(rule.condition, Object.keys(rule.condition).sort())}`;
}

function isCatchAll(rule: RuleInput): boolean {
  // A percentage rule at 100% matches every possible context —
  // anything placed after it can never be reached.
  return rule.kind === "percentage" && rule.condition.percentage === 100;
}

function validateRuleSet(rules: RuleInput[]): ConflictError[] {
  const errors: ConflictError[] = [];
  const seenConditions = new Map<string, number>(); // conditionKey -> position
  let catchAllPosition: number | null = null;

  for (const rule of rules.sort((a, b) => a.position - b.position)) {
    if (catchAllPosition !== null) {
      errors.push({
        position: rule.position,
        conflictsWithPosition: catchAllPosition,
        reason: "unreachable-after-catch-all",
      });
      continue;
    }

    const key = conditionKey(rule);
    const existingPosition = seenConditions.get(key);
    if (existingPosition !== undefined) {
      errors.push({
        position: rule.position,
        conflictsWithPosition: existingPosition,
        reason: "duplicate-condition",
      });
    } else {
      seenConditions.set(key, rule.position);
    }

    if (isCatchAll(rule)) {
      catchAllPosition = rule.position;
    }
  }

  return errors;
}
```

This validation runs once, when `PUT /flags/:key/rules` is called — never on the evaluation path. An empty array returned from `validateRuleSet` means the rule set is valid and can be persisted.

### 2.3 Rule Removal
Removing a rule is equivalent to submitting an updated rule set without it, and is subject to the same validation as any other update (in practice, removing a rule can only reduce conflicts, not introduce new ones, but it goes through the same path for consistency).

## 3. Segment Management

### 3.1 Create a Segment
A segment is created with a name and an initial list of user identifiers. Segments exist independently of flags — creating a segment does not require referencing any flag.

### 3.2 Modify Segment Membership
Users can be added to or removed from a segment after creation. Because segments may be referenced by multiple flags, a membership change can affect the evaluation outcome of every flag that uses a segment rule referencing that segment. This is expected and intentional — it is the entire point of sharing segments.

### 3.3 Delete a Segment
A segment cannot be deleted while it is referenced by an active rule in any flag. This prevents flags from silently falling through to unrelated outcomes because a segment they depend on disappeared. The system must identify which flags reference a segment before allowing deletion.

## 4. Evaluation

### 4.1 Evaluate a Single Flag
Given a flag key and an evaluation context (user identifier plus attributes), the system returns the outcome for that user. The evaluation logic, in order:

1. If the flag does not exist, return "not found."
2. If the flag's global state is off, return "inactive" immediately.
3. Walk the ordered rule list; return the outcome of the first rule that matches the context.
4. If no rule matches, return the flag's default outcome.

**Reference implementation:**

```typescript
type EvaluationContext = {
  userId: string;
  attributes: Record<string, string>;
};

type Rule = {
  position: number;
  kind: "attribute" | "segment" | "percentage";
  condition: Record<string, unknown>;
  outcome: "active" | "inactive";
};

type Flag = {
  key: string;
  globalState: "on" | "off";
  defaultOutcome: "active" | "inactive";
  rules: Rule[]; // already sorted by position
};

type EvaluationResult = {
  outcome: "active" | "inactive";
  matchedRulePosition: number | null; // null means default outcome was used
};

function matchesRule(
  rule: Rule,
  context: EvaluationContext,
  flagKey: string,
  isUserInSegment: (segmentId: string, userId: string) => boolean
): boolean {
  switch (rule.kind) {
    case "attribute": {
      const { attribute, value } = rule.condition as { attribute: string; value: string };
      return context.attributes[attribute] === value;
    }
    case "segment": {
      const { segmentId } = rule.condition as { segmentId: string };
      return isUserInSegment(segmentId, context.userId);
    }
    case "percentage": {
      const { percentage } = rule.condition as { percentage: number };
      return matchesPercentageRule(context.userId, flagKey, percentage);
    }
  }
}

function evaluateFlag(
  flag: Flag,
  context: EvaluationContext,
  isUserInSegment: (segmentId: string, userId: string) => boolean
): EvaluationResult {
  if (flag.globalState === "off") {
    return { outcome: "inactive", matchedRulePosition: null };
  }

  for (const rule of flag.rules) {
    if (matchesRule(rule, context, flag.key, isUserInSegment)) {
      return { outcome: rule.outcome, matchedRulePosition: rule.position };
    }
  }

  return { outcome: flag.defaultOutcome, matchedRulePosition: null };
}
```

Note this function takes `isUserInSegment` as an injected dependency rather than reaching into a repository directly — `evaluateFlag` itself stays pure domain logic with no I/O, which is what makes it trivially unit-testable (see `overview.md`'s architectural rationale).

### 4.2 Percentage Rollout Determinism
A percentage rule must produce a stable, repeatable result for a given user and flag combination. This is achieved by hashing the combination of user identifier and flag key into a number, then mapping that number into a bucket between 0 and 99. A user falls inside the rollout if their bucket is less than the configured percentage.

**Why this matters:** the same user must never see a feature flicker on and off across requests. Determinism is a hard requirement, not an optimization.

**Reference implementation:**

```typescript
// A simple, fast, well-distributed string hash (FNV-1a variant).
// Does not need to be cryptographic — only deterministic and
// evenly distributed across buckets.
function hashToUint32(input: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0; // force unsigned 32-bit
}

function bucketFor(userId: string, flagKey: string): number {
  const hash = hashToUint32(`${userId}:${flagKey}`);
  return hash % 100; // bucket in [0, 99]
}

function matchesPercentageRule(
  userId: string,
  flagKey: string,
  percentage: number
): boolean {
  return bucketFor(userId, flagKey) < percentage;
}
```

Note the hash input is `userId:flagKey`, not just `userId` — this is what makes bucket assignment independent across different flags. The same user can be in the 10% rollout bucket for one flag and outside the rollout bucket for a completely different flag, because each combination hashes differently.

### 4.3 Segment Matching
A segment rule matches if the evaluation context's user identifier is currently a member of the referenced segment. Membership is checked live at evaluation time — it is not snapshotted or cached separately from the segment's own data.

### 4.4 Batch Evaluation (Optional Capability)
Given a list of flag keys and a single evaluation context, return the outcome for all requested flags in one call. This exists purely to reduce round trips for consumers that need to check several flags on a single page load — it does not introduce new evaluation logic beyond what section 4.1 describes, repeated per flag.

## 5. Caching Behavior

### 5.1 What Gets Cached
The full definition of a flag (its global state, default outcome, and ordered rule list) is cached as a unit. Individual per-user evaluation results are **not** cached — caching every (flag, user) combination would grow unbounded and defeats the purpose of a fast, stateless evaluation function.

### 5.2 Cache Invalidation
Whenever a flag's global state or rule set is updated, its cache entry is invalidated immediately (not left to expire naturally). Consistency between "what an admin just configured" and "what consumers see" takes priority over minimizing cache writes.

### 5.3 Cache Miss Behavior
If a flag is requested for evaluation and is not present in cache, the system loads it from persistent storage, populates the cache, and proceeds with evaluation using the freshly loaded definition.