// The application depends on this port, never on `mqtt` directly.
export interface DevicePort {
  readonly prefix: string;
  publish(topic: string, payload: string, options?: { retain?: boolean }): void;
  /** Register a one-shot-style listener for `flow/reset_total/result`; returns an unsubscribe. */
  onResetResult(callback: (result: string) => void): () => void;
}
