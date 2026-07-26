(() => {
  const cfg = window.FERTIGATION_CONFIG;
  const P = cfg.prefix;
  const $ = (id) => document.getElementById(id);
  const brokerBadge = $("broker-status");
  const deviceBadge = $("device-status");

  // ---- event log -------------------------------------------------------
  const LOG_MAX = 50;
  const logEl = $("event-log");
  function log(msg, severity = "normal") {
    const li = document.createElement("li");
    li.classList.toggle("danger", severity === "danger");
    const t = document.createElement("time");
    t.textContent = new Date().toLocaleTimeString();
    li.append(t, document.createTextNode(msg));
    logEl.prepend(li);
    while (logEl.children.length > LOG_MAX) logEl.lastChild.remove();
  }

  // ---- reset eligibility ------------------------------------------------
  const resetState = {
    brokerConnected: false,
    deviceOnline: false,
    pumpKnown: false,
    pumpOn: false,
    flowKnown: false,
    flow: NaN,
    totalKnown: false,
    total: NaN,
    pending: false,
  };
  function resetIneligibleReason() {
    if (!resetState.brokerConnected || !resetState.deviceOnline) return "Device or broker offline";
    if (!resetState.pumpKnown || !resetState.flowKnown || !resetState.totalKnown) return "Waiting for state";
    if (resetState.pumpOn) return "Pump running";
    if (!Number.isFinite(resetState.flow)) return "Flow unknown";
    if (resetState.flow >= 0.1) return "Flow active";
    if (!Number.isFinite(resetState.total)) return "Total unknown";
    if (resetState.total <= 0) return "Already zero";
    if (resetState.pending) return "Waiting for device";
    return "";
  }
  function canReset() { return resetIneligibleReason() === ""; }

  // ---- rendering -------------------------------------------------------
  const NUMERIC = {
    battery_voltage: 2, battery_current: 2, battery_state_of_charge: 1,
    battery_consumed_ah: 1, battery_time_remaining: 0, "ds18b20-1": 1,
    flow_rate: 1, total_water: 1,
  };
  function setSensor(objectId, payload) {
    const el = $(`val-${objectId}`);
    const n = parseFloat(payload);
    if (el) el.textContent = Number.isFinite(n) ? n.toFixed(NUMERIC[objectId] ?? 1) : "–";
    if (objectId === "flow_rate") {
      resetState.flowKnown = true;
      resetState.flow = n;
    }
    if (objectId === "total_water") {
      resetState.totalKnown = true;
      resetState.total = n;
    }
    updateResetUi();
  }
  function setPhase(objectId, minutes) {
    const seg = document.querySelector(`.phase[data-phase="${objectId}"]`);
    if (!seg || isNaN(minutes)) return;
    seg.style.flexGrow = Math.max(minutes, 0.4);
    seg.querySelector("b").textContent = minutes;
    seg.classList.toggle("narrow", minutes < 8);
    seg.title = `${seg.querySelector("span").textContent} — ${minutes} min`;
  }
  function setRelay(objectId, payload) {
    const li = document.querySelector(`#relay-list li[data-relay="${objectId}"]`);
    if (!li) return;
    li.querySelector(".dot").classList.toggle("on", payload === "ON");
    li.dataset.state = payload;
    if (objectId === "pump") {
      resetState.pumpKnown = payload === "ON" || payload === "OFF";
      resetState.pumpOn = payload === "ON";
      updateResetUi();
    }
  }

  const valves = { clean_water_valve: false, fertigation_valve: false };
  const valveStatus = $("valve-status");
  let pending = null;
  let pendingTimer = 0;
  const pumpOn = () => resetState.pumpOn;
  function openValve() { return valves.fertigation_valve ? "fertigation_valve" : valves.clean_water_valve ? "clean_water_valve" : ""; }
  function setPending(target) {
    pending = target;
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = null; renderValves(); }, 5000);
    renderValves();
  }
  function renderValves() {
    const active = openValve();
    if (pending === active) { pending = null; clearTimeout(pendingTimer); }
    for (const btn of document.querySelectorAll("#valve-select button")) {
      btn.classList.toggle("active", btn.dataset.valve === active);
      btn.classList.toggle("pending", pending !== null && btn.dataset.valve === pending);
    }
    valveStatus.textContent = pending === null ? "" : pumpOn() ? "Switching… both valves close for a moment, so the pump stops" : "Switching… both valves close for a moment";
  }
  function setBadge(el, on, onText, offText) {
    el.classList.toggle("on", on); el.classList.toggle("off", !on); el.textContent = on ? onText : offText;
  }

  // ---- card menu -------------------------------------------------------
  const menuTrigger = $("flow-menu-trigger");
  const flowMenu = $("flow-menu");
  const resetMenuButton = $("btn-reset-total");
  const resetMenuReason = $("reset-menu-reason");
  function closeMenu(restoreFocus = false) {
    if (flowMenu.hidden) return;
    flowMenu.hidden = true;
    menuTrigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) menuTrigger.focus();
  }
  function updateResetUi() {
    const reason = resetIneligibleReason();
    resetMenuButton.disabled = Boolean(reason);
    resetMenuButton.setAttribute("aria-disabled", String(Boolean(reason)));
    resetMenuReason.textContent = reason;
    if (dialog.kind === "reset" && !resetState.pending) {
      // Re-evaluate on every MQTT state update so a temporarily unsafe reset can retry.
      dialogConfirm.disabled = !canReset();
      if (!canReset() && !dialog.errorStatus)
        setDialogStatus(`Reset unavailable: ${reason}.`, true);
      else if (!dialog.errorStatus)
        setDialogStatus();
    }
  }
  menuTrigger.addEventListener("click", () => {
    const open = flowMenu.hidden;
    if (open) {
      flowMenu.hidden = false;
      menuTrigger.setAttribute("aria-expanded", "true");
      updateResetUi();
      resetMenuButton.focus();
    } else closeMenu(true);
  });
  document.addEventListener("click", (event) => {
    if (!flowMenu.hidden && !event.target.closest(".card-menu-wrap")) closeMenu(true);
  });

  // ---- reusable confirmation dialog -----------------------------------
  const dialogEl = $("confirm-dialog");
  const dialogTitle = $("dialog-title");
  const dialogMessage = $("dialog-message");
  const dialogStatus = $("dialog-status");
  const dialogCancel = $("dialog-cancel");
  const dialogConfirm = $("dialog-confirm");
  const dialog = { open: false, kind: "", opener: null, onConfirm: null, timeout: 0, errorStatus: false };
  function setDialogStatus(message = "", danger = false) {
    dialogStatus.textContent = message;
    dialogStatus.classList.toggle("danger", danger);
  }
  function closeDialog(force = false) {
    // A submitted reset cannot be cancelled: only its resolved result may close it.
    if (!force && dialog.kind === "reset" && resetState.pending) return;
    clearTimeout(dialog.timeout);
    dialog.timeout = 0;
    resetState.pending = false;
    const opener = dialog.opener;
    dialog.open = false; dialog.kind = ""; dialog.onConfirm = null; dialog.opener = null; dialog.errorStatus = false;
    dialogEl.hidden = true;
    updateResetUi();
    if (opener) opener.focus();
  }
  function openDialog({ kind, title, message, confirmText, danger = false, opener, onConfirm }) {
    closeMenu(false);
    dialog.open = true; dialog.kind = kind; dialog.opener = opener; dialog.onConfirm = onConfirm; dialog.errorStatus = false;
    dialogTitle.textContent = title;
    dialogMessage.textContent = message;
    dialogConfirm.textContent = confirmText;
    dialogConfirm.classList.toggle("danger", danger);
    dialogConfirm.disabled = false;
    dialogCancel.disabled = false;
    setDialogStatus();
    dialogEl.hidden = false;
    dialogConfirm.focus();
  }
  dialogCancel.addEventListener("click", closeDialog);
  dialogConfirm.addEventListener("click", () => dialog.onConfirm?.());
  dialogEl.addEventListener("click", (event) => { if (event.target === dialogEl) closeDialog(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!flowMenu.hidden) closeMenu(true);
      else if (dialog.open) closeDialog();
      return;
    }
    if (event.key !== "Tab" || !dialog.open) return;
    const focusable = [...dialogEl.querySelectorAll("button:not([disabled])")];
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  function askReset() {
    if (!canReset()) return;
    openDialog({
      kind: "reset", title: "Reset total water?",
      message: `This will reset the total from ${resetState.total.toFixed(1)} L to 0 L. This action cannot be undone.`,
      confirmText: "Reset total", danger: true, opener: menuTrigger,
      onConfirm: () => {
        if (!canReset()) { setDialogStatus(`Reset unavailable: ${resetIneligibleReason()}.`, true); return; }
        resetState.pending = true;
        dialog.errorStatus = false;
        dialogConfirm.disabled = true; dialogCancel.disabled = true;
        setDialogStatus("Waiting for device…");
        updateResetUi();
        client.publish(`${P}/flow/reset_total/request`, "ON", { retain: false });
        dialog.timeout = setTimeout(() => {
          if (!dialog.open || dialog.kind !== "reset" || !resetState.pending) return;
          resetState.pending = false;
          dialog.errorStatus = true;
          dialogConfirm.disabled = !canReset(); dialogCancel.disabled = false;
          setDialogStatus("No response from device. Check its connection and current total before retrying.", true);
          updateResetUi();
        }, 10000);
      },
    });
  }
  resetMenuButton.addEventListener("click", askReset);

  // ---- MQTT ------------------------------------------------------------
  const KEEPALIVE = 30;
  const client = mqtt.connect(cfg.brokerUrl, { username: cfg.username, password: cfg.password, reconnectPeriod: 3000, keepalive: KEEPALIVE });
  function invalidateResetSafety() {
    // Fresh retained MQTT states are required after every connection transition.
    resetState.deviceOnline = false;
    resetState.pumpKnown = false;
    resetState.flowKnown = false;
    resetState.totalKnown = false;
    setBadge(deviceBadge, false, "online", "offline");
    deviceBadge.classList.remove("online");
    deviceBadge.classList.add("offline");
  }
  client.on("connect", () => {
    invalidateResetSafety();
    resetState.brokerConnected = true;
    brokerBadge.textContent = "broker: connected";
    brokerBadge.classList.replace("offline", "online");
    client.subscribe(`${P}/#`);
    log("connected to broker"); updateResetUi();
  });
  client.on("close", () => {
    resetState.brokerConnected = false;
    invalidateResetSafety();
    brokerBadge.textContent = "broker: disconnected";
    brokerBadge.classList.replace("online", "offline");
    log("broker disconnected", "danger"); updateResetUi();
  });
  client.on("error", (e) => log(`broker error: ${e.message}`, "danger"));
  let hiddenSince = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenSince = Date.now(); return; }
    if (client.connected && Date.now() - hiddenSince < KEEPALIVE * 1000) return;
    client.end(true, () => client.reconnect());
  });
  function handleResetResult(payload) {
    const reasons = {
      rejected_pump_running: "Device rejected reset: pump is running.",
      rejected_flow_active: "Device rejected reset: flow is active.",
      rejected_flow_unknown: "Device rejected reset: flow is unavailable.",
      error_persistence: "Device could not persist zero. The reset may not survive reboot.",
    };
    const isSuccess = payload === "success";
    const isAlreadyZero = payload === "already_zero";
    const reason = reasons[payload] || `Unexpected reset response: ${payload}.`;
    // Native-web resets use this same MQTT result topic, so always show the event.
    log(isSuccess ? "total water reset" : isAlreadyZero ? "total water already zero" : reason,
      isSuccess || isAlreadyZero ? "normal" : "danger");

    const awaitingReset = dialog.open && dialog.kind === "reset" && resetState.pending;
    if (!awaitingReset) return;
    clearTimeout(dialog.timeout); dialog.timeout = 0; resetState.pending = false;
    dialogCancel.disabled = false;
    if (isSuccess || isAlreadyZero) { closeDialog(true); return; }
    dialog.errorStatus = true;
    dialogConfirm.disabled = !canReset();
    setDialogStatus(reason, true); updateResetUi();
  }
  client.on("message", (topic, buf) => {
    const payload = buf.toString();
    const rel = topic.slice(P.length + 1);
    if (rel === "status") {
      resetState.deviceOnline = payload === "online";
      // An offline transition makes all previously received entity states stale.
      if (!resetState.deviceOnline) {
        resetState.pumpKnown = false;
        resetState.flowKnown = false;
        resetState.totalKnown = false;
      }
      setBadge(deviceBadge, resetState.deviceOnline, "online", "offline");
      deviceBadge.classList.toggle("online", resetState.deviceOnline);
      deviceBadge.classList.toggle("offline", !resetState.deviceOnline);
      log(`device ${payload}`, resetState.deviceOnline ? "normal" : "danger"); updateResetUi(); return;
    }
    if (rel === "flow/dry_run") { log("dry-run shutdown reported by device", "danger"); return; }
    if (rel === "flow/reset_total/result") { handleResetResult(payload); return; }
    if (rel === "debug") return;
    const m = rel.match(/^(sensor|binary_sensor|switch|number)\/([^/]+)\/state$/);
    if (!m) return;
    const [, kind, objectId] = m;
    if (kind === "sensor") { setSensor(objectId, payload); return; }
    if (kind === "number") {
      const input = $(`num-${objectId}`);
      if (input && document.activeElement !== input) input.value = parseFloat(payload);
      setPhase(objectId, parseFloat(payload)); return;
    }
    if (kind === "switch") {
      if (objectId in valves) valves[objectId] = payload === "ON"; else setRelay(objectId, payload);
      renderValves(); log(`${objectId} → ${payload}`); return;
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
  function publish(topic, payload) { client.publish(topic, payload); log(`sent ${topic.slice(P.length + 1)} ${payload}`); }

  // ---- controls --------------------------------------------------------
  $("btn-start").addEventListener("click", (event) => openDialog({
    kind: "start", title: "Start irrigation?", message: "Start the irrigation sequence?", confirmText: "Start irrigation", opener: event.currentTarget,
    onConfirm: () => { publish(`${P}/irrigation/start`, "ON"); closeDialog(); },
  }));
  $("btn-stop").addEventListener("click", () => publish(`${P}/irrigation/stop`, "ON"));
  for (const id of ["pre-wet_minutes", "fertigation_minutes", "flush_minutes"])
    $(`num-${id}`).addEventListener("change", (e) => publish(`${P}/number/${id}/command`, e.target.value));
  for (const btn of document.querySelectorAll("#valve-select button")) btn.addEventListener("click", () => {
    const target = btn.dataset.valve; setPending(target);
    if (target) publish(`${P}/switch/${target}/command`, "ON");
    else for (const valve of Object.keys(valves)) publish(`${P}/switch/${valve}/command`, "OFF");
  });
  document.querySelectorAll("#relay-list li").forEach((li) => li.querySelector("button").addEventListener("click", (event) => {
    const relay = li.dataset.relay;
    if (relay !== "pump") { publish(`${P}/switch/${relay}/command`, "TOGGLE"); return; }
    openDialog({
      kind: "pump", title: "Toggle pump?", message: "If it starts, make sure a valve is open.", confirmText: "Toggle pump", opener: event.currentTarget,
      onConfirm: () => { publish(`${P}/switch/${relay}/command`, "TOGGLE"); closeDialog(); },
    });
  }));
})();
