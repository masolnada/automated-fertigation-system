#!/bin/sh
set -e
: "${MQTT_PREFIX:=kc868-a8}"
export MQTT_URL MQTT_USERNAME MQTT_PASSWORD MQTT_PREFIX
envsubst '${MQTT_URL} ${MQTT_USERNAME} ${MQTT_PASSWORD} ${MQTT_PREFIX}' < /usr/share/nginx/html/config.json.template > /usr/share/nginx/html/config.json
