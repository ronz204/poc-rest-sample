import { FlagErrors, type FlagError } from "./flags.exceptions";
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
  private constructor(private props: Props) {};

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


  public update(changes: {
    name?: string;
    short?: string;
    default?: boolean;
  }): Result<void, FlagError> {
    if (changes.name !== undefined) {
      const isValidName = changes.name.trim().length > 0;
      if (!isValidName) return Failure(FlagErrors.invalidName(changes.name));
      this.props.name = changes.name;
    };

    if (changes.short !== undefined) {
      if (changes.short.trim().length === 0) return Failure(FlagErrors.invalidShort(changes.short));
      this.props.short = changes.short;
    };

    if (changes.default !== undefined) this.props.default = changes.default;
    return Success(undefined);
  };


  public static build(input: {
    key: string;
    name: string;
    short: string;
  }): Result<Flag, FlagError> {
    const isValidKey = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.key);
    if (!isValidKey) return Failure(FlagErrors.invalidKey(input.key));

    const isValidName = input.name.trim().length > 0;
    if (!isValidName) return Failure(FlagErrors.invalidName(input.name));

    const isValidShort = input.short.trim().length > 0;
    if (!isValidShort) return Failure(FlagErrors.invalidShort(input.short));

    return Success(new Flag({
      id: crypto.randomUUID(),
      key: input.key,
      name: input.name,
      short: input.short,
      enabled: false,
      default: false,
    }));
  };
};
