# MQTT is the integration backbone between contexts

Contexts exchange live data through the MQTT broker, never by calling each other
directly: the controller publishes state and subscribes to command topics, the
web server is the sole device-side MQTT client, Observability consumes the same
topics through Telegraf, and the soil node's readings reach home the same way via
the gateway. This keeps each context replaceable and lets automation be added or
changed broker-side without reflashing a field device.
