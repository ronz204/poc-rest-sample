import { FlagErrors, type FlagError } from "./flags.exceptions";
import type { CreateAction, UpdateAction } from "./flags.interfaces";
import { Success, Failure, type Result } from "@shared/helpers/result.helper";

interface Props {
  id: string;
  key: string;
  name: string;
  short: string;
  enabled: boolean;
  default: boolean;
};

export class Flag {
  private constructor(private props: Props) { };

  public enable(): void {
    this.props.enabled = true;
  };

  public disable(): void {
    this.props.enabled = false;
  };

  public primitives(): Props {
    return structuredClone(this.props);
  };

  public static hydrate(props: Props): Flag {
    return new Flag(props)
  };

  get id() { return this.props.id; }
  get key() { return this.props.key; }
  get name() { return this.props.name; }
  get short() { return this.props.short; }
  get enabled() { return this.props.enabled; }
  get default() { return this.props.default; }


  public update(cmd: UpdateAction): Result<void, FlagError> {
    if (cmd.name !== undefined && cmd.name.trim().length === 0) {
      return Failure(FlagErrors.invalidName(cmd.name));
    };

    if (cmd.short !== undefined && cmd.short.trim().length === 0) {
      return Failure(FlagErrors.invalidShort(cmd.short));
    };

    if (cmd.name !== undefined) this.props.name = cmd.name;
    if (cmd.short !== undefined) this.props.short = cmd.short;
    if (cmd.default !== undefined) this.props.default = cmd.default;

    return Success(undefined);
  };


  public static create(cmd: CreateAction): Result<Flag, FlagError> {
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
