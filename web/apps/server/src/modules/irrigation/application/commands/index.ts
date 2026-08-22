import { resetTotalWater } from "./reset-total-water";
import { selectOutput } from "./select-output";
import { selectValve } from "./select-valve";
import { setCycleMode } from "./set-cycle-mode";
import { setCycleTarget } from "./set-cycle-target";
import { setFlushDuration } from "./set-flush-duration";
import { setMinFlow } from "./set-min-flow";
import { setPreWetPercent } from "./set-pre-wet-percent";
import { startIrrigation } from "./start-irrigation";
import { stopIrrigation } from "./stop-irrigation";
import { togglePump } from "./toggle-pump";

export const irrigationHandlers = {
  "start-irrigation": startIrrigation,
  "stop-irrigation": stopIrrigation,
  "toggle-pump": togglePump,
  "select-valve": selectValve,
  "select-output": selectOutput,
  "set-cycle-mode": setCycleMode,
  "set-pre-wet-percent": setPreWetPercent,
  "set-cycle-target": setCycleTarget,
  "set-flush-duration": setFlushDuration,
  "set-min-flow": setMinFlow,
  "reset-total-water": resetTotalWater,
};
