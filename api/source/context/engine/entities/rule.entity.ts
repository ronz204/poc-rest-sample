import { RuleErrors, type RuleError } from "./rule.exceptions";
import type { CreateAction, UpdateAction } from "./rule.interfaces";
import { Success, Failure, type Result } from "@shared/helpers/result.helper";

interface Row {
  id: string;
  flagId: string;
  segmentId: string;
  priority: number;
  outcome: boolean;
  rollout: number | null;
};

export class Rule {
  private constructor(private row: Row) {};

  public primitives(): Row {
    return structuredClone(this.row);
  };

  public static hydrate(row: Row): Rule {
    return new Rule(row);
  };

  get id() { return this.row.id; }
  get flagId() { return this.row.flagId; }
  get segmentId() { return this.row.segmentId; }
  get priority() { return this.row.priority; }
  get outcome() { return this.row.outcome; }
  get rollout() { return this.row.rollout; }


  public refresh(cmd: UpdateAction): Result<void, RuleError> {
    if (cmd.priority !== undefined && cmd.priority < 1) {
      return Failure(RuleErrors.invalidPriority(cmd.priority));
    };

    if (cmd.rollout !== undefined && cmd.rollout !== null && (cmd.rollout < 0 || cmd.rollout > 100)) {
      return Failure(RuleErrors.invalidRollout(cmd.rollout));
    };

    if (cmd.outcome !== undefined) this.row.outcome = cmd.outcome;
    if (cmd.rollout !== undefined) this.row.rollout = cmd.rollout;
    
    if (cmd.priority !== undefined) this.row.priority = cmd.priority;
    if (cmd.segmentId !== undefined) this.row.segmentId = cmd.segmentId;

    return Success(undefined);
  };
  

  public static factory(cmd: CreateAction): Result<Rule, RuleError> {
    if (cmd.priority < 1) {
      return Failure(RuleErrors.invalidPriority(cmd.priority));
    };

    if (cmd.rollout !== undefined && (cmd.rollout < 0 || cmd.rollout > 100)) {
      return Failure(RuleErrors.invalidRollout(cmd.rollout));
    };

    return Success(new Rule({
      id: crypto.randomUUID(),
      flagId: cmd.flagId,
      segmentId: cmd.segmentId,
      priority: cmd.priority,
      outcome: cmd.outcome,
      rollout: cmd.rollout ?? 100,
    }));
  };
};
