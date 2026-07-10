#!/bin/sh
# Render the dashboard config from environment variables at startup.
set -e
: "${MQTT_URL:?MQTT_URL is required (e.g. ws://10.0.20.20:9001)}"
: "${MQTT_USERNAME:?MQTT_USERNAME is required}"
: "${MQTT_PASSWORD:?MQTT_PASSWORD is required}"
: "${MQTT_PREFIX:=kc868-a8}"
export MQTT_URL MQTT_USERNAME MQTT_PASSWORD MQTT_PREFIX

envsubst '${MQTT_URL} ${MQTT_USERNAME} ${MQTT_PASSWORD} ${MQTT_PREFIX}' \
  < /usr/share/nginx/html/config.js.template \
  > /usr/share/nginx/html/config.js
