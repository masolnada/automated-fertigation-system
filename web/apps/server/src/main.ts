import { parseConfig } from "./config";
import { Controller } from "./domain/controller";
import { MqttDevice } from "./infrastructure/mqtt/adapter";
import { createApp } from "./infrastructure/http/app";

// Composition root: validate env, wire adapters, start listening.
const config = parseConfig(process.env);
const controller = new Controller();
const device = new MqttDevice(config, controller);
const app = createApp({ device, controller });
app.listen(config.port, () => console.log(`Fertigation server listening on :${config.port}`));
