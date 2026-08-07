# ESP-IDF framework, not Arduino

The firmware builds on ESP-IDF because the Arduino framework caused a confirmed
BLE boot loop on this board once SmartShunt listening was added. Switching to
ESP-IDF restored reliable booting and reduced the OTA image size. A future reader
should not "simplify" back to Arduino without re-testing BLE startup.
