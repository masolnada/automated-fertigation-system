import { createSchedule } from "./create-schedule";
import { deleteSchedule } from "./delete-schedule";

export const schedulingHandlers = {
  "create-schedule": createSchedule,
  "delete-schedule": deleteSchedule,
};
