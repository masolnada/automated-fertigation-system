import { DomainError, err, ok, type Result } from "./result";
import { ValueObject } from "./value-object";

export class OutputChannel extends ValueObject {
  private constructor(readonly value: 1 | 2 | 3 | 4) { super(); }

  static create(value: unknown): Result<OutputChannel> {
    return Number.isInteger(value) && typeof value === "number" && value >= 1 && value <= 4
      ? ok(new OutputChannel(value as 1 | 2 | 3 | 4))
      : err(new DomainError("invalid_output_channel", "invalid output channel"));
  }

  static rehydrate(value: unknown): OutputChannel {
    const result = OutputChannel.create(value);
    if (!result.ok) throw result.error;
    return result.value;
  }

  toNumber(): 1 | 2 | 3 | 4 { return this.value; }
  protected equalityComponents(): readonly unknown[] { return [this.value]; }
}

export const outputChannels: readonly OutputChannel[] = Object.freeze([1, 2, 3, 4].map(OutputChannel.rehydrate));
