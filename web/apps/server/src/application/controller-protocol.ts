export const topics = (prefix: string) => ({
  subscribe: `${prefix}/#`,
  resetRequest: `${prefix}/flow/reset_total/request`,
  switchCommand: (id: string) => `${prefix}/switch/${id}/command`,
  numberCommand: (id: string) => `${prefix}/number/${id}/command`,
  selectCommand: (id: string) => `${prefix}/select/${id}/command`,
  irrigationStart: `${prefix}/irrigation/start`,
  irrigationStop: `${prefix}/irrigation/stop`,
  scheduleSet: `${prefix}/schedule/set`,
});
