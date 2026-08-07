import { parseConfig } from "./config";
import { Controller } from "./domain/controller";
import { WateringRecorder } from "./application/watering-recorder";
import { MqttDevice } from "./infrastructure/mqtt/adapter";
import { openDatabase } from "./infrastructure/db/database";
import { DrizzleWateringEventRepository } from "./infrastructure/db/watering-repository";
import { createApp } from "./infrastructure/http/app";

// Composition root: validate env, wire adapters, start listening.
const config = parseConfig(process.env);
const controller = new Controller();
const device = new MqttDevice(config, controller);
const wateringEvents = new DrizzleWateringEventRepository(openDatabase(config.dbPath));
new WateringRecorder(wateringEvents, controller).start();
const app = createApp({ device, controller, wateringEvents });
app.listen(config.port, () => console.log(`Fertigation server listening on :${config.port}`));
