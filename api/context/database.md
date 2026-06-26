# Feature Flag Engine — Database Model

This document describes the conceptual data model: entities, their fields, and their relationships. It intentionally avoids any specific database technology, schema syntax, or ORM notation — the goal is to describe *what* needs to be stored and *why* the relationships exist, leaving the concrete implementation as a separate decision.

## Entity: Flag

Represents a single feature flag.

| Field | Meaning |
|---|---|
| Key | Unique, immutable identifier for the flag (e.g. `new-checkout`) |
| Description | Human-readable explanation of what the flag controls |
| Global state | Whether the flag is on or off as a whole (the kill switch) |
| Default outcome | The result returned when no rule matches |
| Created/updated timestamps | Standard bookkeeping |

**Notes:**
- The key, not a generated internal ID, is the natural identifier consumers use when calling the evaluation endpoint — it should be treated as the primary lookup field even if an internal surrogate ID also exists for relational integrity.

## Entity: Rule

Represents a single targeting condition belonging to a flag.

| Field | Meaning |
|---|---|
| Flag reference | Which flag this rule belongs to |
| Order/position | Where this rule sits in the evaluation sequence — required, since evaluation order is meaningful |
| Kind | One of: attribute, segment, percentage |
| Condition | The kind-specific matching criteria (see below) |
| Outcome | What this rule returns when it matches |

**Condition shape by kind:**
- **Attribute rule:** an attribute name and the value it must equal (e.g. `country` equals `CR`).
- **Segment rule:** a reference to a Segment entity.
- **Percentage rule:** a percentage value (0–100) used as the rollout threshold.

**Relationship:** A Flag has many Rules (one-to-many). A Rule belongs to exactly one Flag — rules are not shared between flags, even if two flags happen to have an identical-looking condition. This is what makes the per-flag conflict validation described in `features.md` meaningful: conflicts are checked within a single flag's rule set, never across flags.

## Entity: Segment

Represents a reusable, named group of users.

| Field | Meaning |
|---|---|
| Name | Unique identifier for the segment (e.g. `beta-testers`) |
| Members | The set of user identifiers belonging to this segment |
| Created/updated timestamps | Standard bookkeeping |

**Relationship:** A Segment can be referenced by many Rules, across many different Flags (many-to-one from Rule's perspective, when the rule's kind is "segment"). This is precisely why Segment is modeled as an independent entity rather than nested inside Flag — see `overview.md` for the reasoning. A Segment knows nothing about which flags reference it; that relationship is only visible from the Rule side, which is why segment deletion (see `features.md`, section 3.3) requires scanning rules rather than something the Segment entity tracks directly.

## Entity: Segment Membership

Represents one user's belonging to one segment.

| Field | Meaning |
|---|---|
| Segment reference | Which segment this membership belongs to |
| User identifier | The user who is a member |

**Notes:**
- Modeled as its own entity (rather than an array field on Segment) because membership lists can grow large and benefit from being queried/indexed independently — particularly for the "is this user in this segment" check that happens on every relevant evaluation.
- This is the one place in the model where lookup performance genuinely matters at the data layer, since segment matching happens on the hot evaluation path.

## Relationship Summary

```
Flag (1) ───── (many) Rule
Segment (1) ─── (many) Segment Membership
Rule [kind=segment] (many) ───── (1) Segment   [reference only, not enforced as a hard foreign key requirement if a segment is deleted while unreferenced]
```

## What Is Deliberately Not Modeled

- **Evaluation history/logs:** evaluations are not persisted as records. The system answers a question; it does not keep a transcript of every question asked. (An analytics/audit layer is explicitly out of scope per `overview.md`.)
- **Rule conflict state:** conflicts are a validation outcome computed at write time, not a stored property of a rule. There is no "this rule is in conflict" flag persisted anywhere.
- **Cached flag definitions:** the cache (see `features.md`, section 5) is a runtime concern, not part of the persistent data model. It holds a copy of Flag + Rule data, not a distinct entity with its own identity.

---

## SQL Schema (PostgreSQL)

```sql
-- Enums for fields with a fixed, known set of values.
CREATE TYPE flag_state AS ENUM ('on', 'off');
CREATE TYPE rule_kind AS ENUM ('attribute', 'segment', 'percentage');
CREATE TYPE rule_outcome AS ENUM ('active', 'inactive');

-- Flags
CREATE TABLE flags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key             VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT NOT NULL DEFAULT '',
    global_state    flag_state NOT NULL DEFAULT 'off',
    default_outcome rule_outcome NOT NULL DEFAULT 'inactive',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Key is the natural lookup field on the hot path (see notes above),
-- so it gets its own index even though UNIQUE already implies a btree.
CREATE INDEX idx_flags_key ON flags (key);

-- Segments
CREATE TABLE segments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Segment Membership (separate table, not an array column,
-- because membership lookups happen on the evaluation hot path)
CREATE TABLE segment_memberships (
    segment_id  UUID NOT NULL REFERENCES segments (id) ON DELETE CASCADE,
    user_id     VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (segment_id, user_id)
);

-- The reverse lookup ("is user X in segment Y") is covered by the
-- composite primary key above. This index supports the other direction
-- ("list all segments a user belongs to"), used less often but still real.
CREATE INDEX idx_segment_memberships_user_id ON segment_memberships (user_id);

-- Rules
CREATE TABLE rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id     UUID NOT NULL REFERENCES flags (id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    kind        rule_kind NOT NULL,
    -- Condition shape depends on `kind` (see features.md / endpoints.md):
    --   attribute  -> { "attribute": "country", "value": "CR" }
    --   segment    -> { "segmentId": "<uuid>" }
    --   percentage -> { "percentage": 10 }
    condition   JSONB NOT NULL,
    outcome     rule_outcome NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- A flag cannot have two rules at the same position — this is the
    -- DB-level backstop for ordering integrity. It does NOT replace the
    -- conflict validation in features.md 2.2 (duplicate conditions and
    -- unreachable rules are semantic checks, not something a constraint
    -- can express), but it does guarantee position is unambiguous.
    UNIQUE (flag_id, position)
);

CREATE INDEX idx_rules_flag_id ON rules (flag_id, position);

-- Partial index to make segment-reference lookups fast — this is what
-- backs the "which flags reference this segment" check required before
-- a segment can be deleted (features.md, section 3.3).
CREATE INDEX idx_rules_segment_condition ON rules ((condition->>'segmentId'))
    WHERE kind = 'segment';
```

### Notes on Specific Choices

- **`condition` as JSONB on `rules`:** the three rule kinds have genuinely different condition shapes. Modeling this as three nullable columns (`attribute_value`, `segment_id`, `percentage`) would work too, but JSONB avoids a wide, mostly-null row and keeps adding a fourth rule kind in the future a non-breaking change. The tradeoff is that the segment reference inside `condition` is not a real foreign key — referential integrity for segment references is enforced at the application layer, not the database layer.
- **`position` instead of relying on insertion order:** Postgres does not guarantee row retrieval order without an explicit `ORDER BY`, and rule order is meaningful business data (see `features.md`, section 2.1) — so it must be an explicit column, not an assumption about storage order.
- **`ON DELETE CASCADE` on `rules.flag_id`:** matches the business rule in `features.md`, section 1.3 — deleting a flag deletes its rules.
- **No foreign key from `rules.condition->segmentId` to `segments.id`:** JSONB fields cannot carry a native foreign key constraint in PostgreSQL. The application layer is responsible for validating that a segment exists when a segment rule is created, and for the pre-deletion reference check described in `features.md`, section 3.3.