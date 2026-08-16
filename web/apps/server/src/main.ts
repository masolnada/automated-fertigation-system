import { parseConfig } from "./config";
import { Controller } from "./domain/controller";
import { WateringIngester } from "./application/watering-ingester";
import { MqttDevice } from "./infrastructure/mqtt/adapter";
import { openDatabase } from "./infrastructure/db/database";
import { DrizzleWateringEventRepository } from "./infrastructure/db/watering-repository";
import { DrizzleZoneRepository } from "./infrastructure/db/zone-repository";
import { DrizzleScheduleRepository } from "./infrastructure/db/schedule-repository";
import { createApp } from "./infrastructure/http/app";

// Composition root: validate env, wire adapters, start listening.
const config = parseConfig(process.env);
const controller = new Controller();
const device = new MqttDevice(config, controller);
const db = openDatabase(config.dbPath);
const zones = new DrizzleZoneRepository(db);
const wateringEvents = new DrizzleWateringEventRepository(db, zones);
const schedules = new DrizzleScheduleRepository(db);
controller.setZones(zones.all(), zones.currentAssignments());
controller.setSchedules(schedules.all());
new WateringIngester(wateringEvents, device).start();
const app = createApp({ device, controller, wateringEvents, zones, schedules });
app.listen(config.port, () => console.log(`Fertigation server listening on :${config.port}`));
