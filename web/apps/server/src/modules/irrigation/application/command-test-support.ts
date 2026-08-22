import { ControllerSnapshotProjection } from "../../../infrastructure/projections/controller-snapshot-projection";
import type { IrrigationContext } from "./context";

export function createIrrigationCommandHarness() {
  const controller = new ControllerSnapshotProjection();
  const published: Array<{ topic: string; payload: string; retain: boolean }> = [];
  let resetListener: (result: string) => void = () => {};
  const ctx: IrrigationContext = {
    controller,
    device: {
      prefix: "kc868-a8",
      publish: (topic, payload, options) => { published.push({ topic, payload, retain: options?.retain ?? false }); },
      onResetResult: (listener) => { resetListener = listener; return () => { resetListener = () => {}; }; },
      onWateringLog: () => () => {},
    },
  };
  return {
    ctx,
    controller,
    published,
    respondToReset: (result: string) => resetListener(result),
    makeResetEligible: () => {
      controller.connected();
      controller.message("kc868-a8", "kc868-a8/status", "online");
      controller.message("kc868-a8", "kc868-a8/switch/pump/state", "OFF");
      controller.message("kc868-a8", "kc868-a8/sensor/flow_rate/state", "0");
      controller.message("kc868-a8", "kc868-a8/sensor/total_water/state", "12.3");
    },
  };
}
