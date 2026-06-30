export type RuleError =
  | { type: "INVALID_RULE_PRIORITY"; priority: number; }
  | { type: "INVALID_RULE_ROLLOUT"; rollout: number; };

export const RuleErrors = Object.freeze({
  invalidPriority: (priority: number): RuleError => ({ type: "INVALID_RULE_PRIORITY", priority }),
  invalidRollout: (rollout: number): RuleError => ({ type: "INVALID_RULE_ROLLOUT", rollout }),
});
