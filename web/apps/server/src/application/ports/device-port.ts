export interface DevicePort {
  readonly prefix: string;
  publish(topic: string, payload: string, options?: { retain?: boolean }): void;
  onResetResult(callback: (result: string) => void): () => void;
  onWateringLog(callback: (payload: string) => void): () => void;
}
