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

  // The valves are mutually exclusive on the device (a gpio interlock), so the
  // UI shows one selector with a single active segment instead of two toggles
  // that could imply an impossible both-open state.
  const valves = { clean_water_valve: false, fertigation_valve: false };
  const valveStatus = $("valve-status");

  // A swap is not instant: the device closes the open valve, waits out the
  // interlock, then opens the other — passing through both-closed, which stops
  // the pump. `pending` holds the segment asked for until the device confirms,
  // so the wait is visible rather than looking like a dropped click.
  let pending = null;
  let pendingTimer = 0;

  const pumpOn = () =>
    document.querySelector('#relay-list li[data-relay="pump"]').dataset.state === "ON";

  function openValve() {
    return valves.fertigation_valve
      ? "fertigation_valve"
      : valves.clean_water_valve
        ? "clean_water_valve"
        : ""; // neither open — the "Closed" segment
  }

  function setPending(target) {
    pending = target;
    clearTimeout(pendingTimer);
    // A command can be lost; never strand the notice waiting for a confirm
    // that is not coming. The device normally answers well inside this.
    pendingTimer = setTimeout(() => {
      pending = null;
      renderValves();
    }, 5000);
    renderValves();
  }

  function renderValves() {
    const active = openValve();
    if (pending === active) {
      pending = null; // the device arrived where we asked
      clearTimeout(pendingTimer);
    }
    for (const btn of document.querySelectorAll("#valve-select button")) {
      btn.classList.toggle("active", btn.dataset.valve === active);
      // Dashed = asked for but not settled, the same signal .badge.offline uses.
      btn.classList.toggle("pending", pending !== null && btn.dataset.valve === pending);
    }
    valveStatus.textContent =
      pending === null
        ? ""
        : pumpOn()
          ? "Switching… both valves close for a moment, so the pump stops"
          : "Switching… both valves close for a moment";
  }

  function setBadge(el, on, onText, offText) {
    el.classList.toggle("on", on);
    el.classList.toggle("off", !on);
    el.textContent = on ? onText : offText;
  }

  // ---- MQTT ------------------------------------------------------------
  // keepalive 30s, not the 60s default: mqtt.js only gives up on a silent
  // socket after keepalive + pingTimeout (1.5x keepalive), so the default
  // leaves a dead connection undetected for up to 150s.
  const KEEPALIVE = 30;

  const client = mqtt.connect(cfg.brokerUrl, {
    username: cfg.username,
    password: cfg.password,
    reconnectPeriod: 3000,
    keepalive: KEEPALIVE,
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

  // A backgrounded tab has its timers frozen, so the keepalive stops and the
  // broker drops us; a laptop sleep can also leave the socket half-open, with
  // the client still reporting "connected" while nothing arrives. Neither is
  // visible from here, so after the page has been hidden long enough for
  // either to have happened, force a fresh connection rather than trust the
  // one we have. Reconnecting resubscribes, and every state topic is
  // published retained, so the UI resyncs itself without a page reload.
  let hiddenSince = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenSince = Date.now();
      return;
    }
    if (client.connected && Date.now() - hiddenSince < KEEPALIVE * 1000) return;
    client.end(true, () => client.reconnect());
  });

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
      if (objectId in valves) valves[objectId] = payload === "ON";
      else setRelay(objectId, payload);
      renderValves(); // pump state feeds the switching notice, so render on both
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

  // Absolute targets rather than TOGGLE: a segment names where to go, so a
  // stale view cannot invert the intent, and re-picking the active one is a
  // harmless no-op. Opening a valve takes a single ON — the device's interlock
  // closes the other one, which also avoids racing two commands whose order
  // the broker and device need not preserve.
  for (const btn of document.querySelectorAll("#valve-select button")) {
    btn.addEventListener("click", () => {
      const target = btn.dataset.valve;
      setPending(target);
      if (target) {
        publish(`${P}/switch/${target}/command`, "ON");
        return;
      }
      for (const valve of Object.keys(valves))
        publish(`${P}/switch/${valve}/command`, "OFF");
    });
  }

  // TOGGLE rather than an ON/OFF computed from dataset.state: the device
  // flips from the state it actually holds, so the button stays correct even
  // if this page missed an update and thinks the relay is the other way round.
  // The trade-off is that the direction is no longer ours to predict, so the
  // pump has to be confirmed in both directions — Stop is the unprompted way
  // to shut it off.
  document.querySelectorAll("#relay-list li").forEach((li) => {
    li.querySelector("button").addEventListener("click", () => {
      if (li.dataset.relay === "pump" &&
          !confirm("Toggle the pump? If it starts, make sure a valve is open."))
        return;
      publish(`${P}/switch/${li.dataset.relay}/command`, "TOGGLE");
    });
  });
})();
