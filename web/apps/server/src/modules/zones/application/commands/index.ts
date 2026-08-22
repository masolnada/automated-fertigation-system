import { archiveZone } from "./archive-zone";
import { createZone } from "./create-zone";
import { renameZone } from "./rename-zone";
import { setAssignments } from "./set-assignments";
import { unarchiveZone } from "./unarchive-zone";

export const zoneHandlers = {
  "create-zone": createZone,
  "rename-zone": renameZone,
  "archive-zone": archiveZone,
  "unarchive-zone": unarchiveZone,
  "set-assignments": setAssignments,
};
