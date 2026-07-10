(() => {
  const cfg = window.FERTIGATION_CONFIG;
  const P = cfg.prefix;

  const $ = (id) => document.getElementById(id);
  const brokerBadge = $("broker-status");
  const deviceBadge = $("device-status");

  // ---- event log -------------------------------------------------------
  const LOG_MAX = 50;
  const logEl = $("event-log");
  function log(msg) {
    const li = document.createElement("li");
    const t = document.createElement("time");
    t.textContent = new Date().toLocaleTimeString();
    li.appendChild(t);
    li.appendChild(document.createTextNode(msg));
    logEl.prepend(li);
    while (logEl.children.length > LOG_MAX) logEl.lastChild.remove();
  }

  // ---- rendering -------------------------------------------------------
  const NUMERIC = {
    battery_voltage: 2,
    battery_current: 2,
    battery_state_of_charge: 1,
    battery_consumed_ah: 1,
    battery_time_remaining: 0,
    "ds18b20-1": 1,
  };

  function setSensor(objectId, payload) {
    const el = $(`val-${objectId}`);
    if (!el) return;
    const n = parseFloat(payload);
    el.textContent = isNaN(n) ? "–" : n.toFixed(NUMERIC[objectId] ?? 1);
  }

  // Sequence bar: each phase segment grows with its configured minutes.
  function setPhase(objectId, minutes) {
    const seg = document.querySelector(`.phase[data-phase="${objectId}"]`);
    if (!seg || isNaN(minutes)) return;
    seg.style.flexGrow = Math.max(minutes, 0.4); // a sliver stays visible at 0
    seg.querySelector("b").textContent = minutes;
    seg.classList.toggle("narrow", minutes < 8);
    seg.title = `${seg.querySelector("span").textContent} — ${minutes} min`;
  }

  function setRelay(objectId, payload) {
    const li = document.querySelector(`#relay-list li[data-relay="${objectId}"]`);
    if (!li) return;
    li.querySelector(".dot").classList.toggle("on", payload === "ON");
    li.dataset.state = payload;
  }

  function setBadge(el, on, onText, offText) {
    el.classList.toggle("on", on);
    el.classList.toggle("off", !on);
    el.textContent = on ? onText : offText;
  }

  // ---- MQTT ------------------------------------------------------------
  const client = mqtt.connect(cfg.brokerUrl, {
    username: cfg.username,
    password: cfg.password,
    reconnectPeriod: 3000,
  });

  client.on("connect", () => {
    brokerBadge.textContent = "broker: connected";
    brokerBadge.classList.replace("offline", "online");
    client.subscribe(`${P}/#`);
    log("connected to broker");
  });

  client.on("close", () => {
    brokerBadge.textContent = "broker: disconnected";
    brokerBadge.classList.replace("online", "offline");
  });

  client.on("error", (e) => log(`broker error: ${e.message}`));

  client.on("message", (topic, buf) => {
    const payload = buf.toString();
    const rel = topic.slice(P.length + 1); // strip "<prefix>/"

    if (rel === "status") {
      setBadge(deviceBadge, payload === "online", "online", "offline");
      deviceBadge.classList.toggle("online", payload === "online");
      deviceBadge.classList.toggle("offline", payload !== "online");
      log(`device ${payload}`);
      return;
    }
    if (rel === "debug") return; // device log stream — too noisy for the UI

    const m = rel.match(/^(sensor|binary_sensor|switch|number)\/([^/]+)\/state$/);
    if (!m) return;
    const [, kind, objectId] = m;

    if (kind === "sensor") {
      setSensor(objectId, payload);
      return; // throttled on-device; not worth logging
    }
    if (kind === "number") {
      const input = $(`num-${objectId}`);
      if (input && document.activeElement !== input) input.value = parseFloat(payload);
      setPhase(objectId, parseFloat(payload));
      return;
    }
    if (kind === "switch") {
      setRelay(objectId, payload);
      log(`${objectId} → ${payload}`);
      return;
    }
    if (kind === "binary_sensor") {
      if (objectId === "irrigation_running") {
        setBadge($("irrigation-running"), payload === "ON", "running", "idle");
        $("card-irrigation").classList.toggle("running", payload === "ON");
        log(`irrigation ${payload === "ON" ? "started" : "stopped"}`);
      } else if (objectId === "battery_charged") {
        $("battery-charged").classList.toggle("hidden", payload !== "ON");
        $("battery-charged").classList.toggle("on", payload === "ON");
        if (payload === "ON") log("battery charge complete");
      }
    }
  });

  function publish(topic, payload) {
    client.publish(topic, payload);
    log(`sent ${topic.slice(P.length + 1)} ${payload}`);
  }

  // ---- controls --------------------------------------------------------
  $("btn-start").addEventListener("click", () => {
    if (confirm("Start the irrigation sequence?"))
      publish(`${P}/irrigation/start`, "ON");
  });
  $("btn-stop").addEventListener("click", () => publish(`${P}/irrigation/stop`, "ON"));

  for (const id of ["pre-wet_minutes", "fertigation_minutes", "flush_minutes"]) {
    $(`num-${id}`).addEventListener("change", (e) =>
      publish(`${P}/number/${id}/command`, e.target.value));
  }

  document.querySelectorAll("#relay-list li").forEach((li) => {
    li.querySelector("button").addEventListener("click", () => {
      const target = li.dataset.state === "ON" ? "OFF" : "ON";
      if (li.dataset.relay === "pump" && target === "ON" &&
          !confirm("Manually run the pump? Make sure a valve is open."))
        return;
      publish(`${P}/switch/${li.dataset.relay}/command`, target);
    });
  });
})();
