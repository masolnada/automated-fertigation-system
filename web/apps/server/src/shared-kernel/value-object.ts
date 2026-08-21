export abstract class ValueObject {
  protected abstract equalityComponents(): readonly unknown[];

  equals(other: this | null | undefined): boolean {
    if (!other || this.constructor !== other.constructor) return false;
    const left = this.equalityComponents();
    const right = other.equalityComponents();
    return left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  }
}
