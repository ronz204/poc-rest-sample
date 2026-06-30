import { FlagErrors, type FlagError } from "./flag.exceptions";
import type { CreateAction, UpdateAction } from "./flag.interfaces";
import { Success, Failure, type Result } from "@shared/helpers/result.helper";

interface Row {
  id: string;
  key: string;
  name: string;
  short: string;
  enabled: boolean;
  default: boolean;
};

export class Flag {
  private constructor(private row: Row) { };

  public enable(): void {
    this.row.enabled = true;
  };

  public disable(): void {
    this.row.enabled = false;
  };

  public primitives(): Row {
    return structuredClone(this.row);
  };

  public static hydrate(props: Row): Flag {
    return new Flag(props)
  };

  get id() { return this.row.id; }
  get key() { return this.row.key; }
  get name() { return this.row.name; }
  get short() { return this.row.short; }
  get enabled() { return this.row.enabled; }
  get default() { return this.row.default; }


  public refresh(cmd: UpdateAction): Result<void, FlagError> {
    if (cmd.name !== undefined && cmd.name.trim().length === 0) {
      return Failure(FlagErrors.invalidName(cmd.name));
    };

    if (cmd.short !== undefined && cmd.short.trim().length === 0) {
      return Failure(FlagErrors.invalidShort(cmd.short));
    };

    if (cmd.name !== undefined) this.row.name = cmd.name;
    if (cmd.short !== undefined) this.row.short = cmd.short;
    if (cmd.default !== undefined) this.row.default = cmd.default;

    return Success(undefined);
  };


  public static factory(cmd: CreateAction): Result<Flag, FlagError> {
    const isValidKey = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(cmd.key);
    if (!isValidKey) return Failure(FlagErrors.invalidKey(cmd.key));

    const isValidName = cmd.name.trim().length > 0;
    if (!isValidName) return Failure(FlagErrors.invalidName(cmd.name));

    const isValidShort = cmd.short.trim().length > 0;
    if (!isValidShort) return Failure(FlagErrors.invalidShort(cmd.short));

    return Success(new Flag({
      id: crypto.randomUUID(),
      key: cmd.key,
      name: cmd.name,
      short: cmd.short,
      enabled: false,
      default: false,
    }));
  };
};
