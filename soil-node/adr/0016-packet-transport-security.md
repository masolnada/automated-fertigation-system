# ADR-0016 — Encryption and rolling code on the LoRa link

**Status:** Accepted

## Context

LoRa is a broadcast radio medium. Anything transmitted can be received by anyone
within several kilometres with a €10 module, and anything received can be
replayed. There is no TLS, no session, and no network-layer security
whatsoever — [ADR-0002](0002-lora-only-topology.md) removed the IP stack that
would normally provide it.

ESPHome's `packet_transport` offers three optional protections: XXTEA encryption
with a shared 256-bit key, a rolling code against replay, and a ping-pong
challenge-response.

The realistic threat model is modest. The data is soil moisture readings from an
agricultural field: not sensitive, and of no value to anyone. But two concerns
are real:

1. **Accidental interference.** Another LoRa device nearby — a neighbour's
   sensor, a Meshtastic node, anything on 868 MHz — transmitting on the same
   parameters. Without authentication, the gateway could accept a foreign packet.
2. **Future actuation.** [ADR-0001](0001-logging-only-scope.md) keeps this
   logging-only *for now*, but the explicit intention is MQTT automations that
   trigger irrigation. At that point, spoofed data opens a valve. Retrofitting
   security to a deployed node with no OTA
   ([ADR-0002](0002-lora-only-topology.md)) means a field visit.

## Options considered

### A. No security

- **Pro:** Simplest; marginally smaller packets.
- **Con:** Any 868 MHz transmitter using the same sync word could inject
  readings. Accidental collision is more likely than malice, and equally
  damaging.
- **Con:** Would have to be retrofitted before automation, by hand, in a field.

### B. Encryption only

- **Pro:** Data is unreadable in transit and cannot be forged without the key.
- **Con:** **Does not prevent replay.** A recorded packet can be retransmitted
  later and will be accepted as fresh. For soil moisture this means replaying a
  "wet soil" reading to suppress irrigation, or a "dry" one to trigger it — the
  exact attack that matters once automation exists.

### C. Encryption + rolling code (chosen)

- **Pro:** Encryption prevents reading and forging; the rolling code prevents
  replay. Each packet carries a monotonically increasing 64-bit value, and the
  consumer rejects any code it has already seen.
- **Pro:** The rolling code also guarantees **every packet's plaintext differs**,
  which substantially hardens the cipher against brute-force analysis of
  repetitive sensor data.
- **Pro:** Set entirely on the provider side; one line of YAML.
- **Con:** Minor packet overhead, irrelevant at 0.005 % duty cycle
  ([ADR-0011](0011-lora-radio-parameters.md)).
- **Con:** The upper 32 bits are written to flash once per reboot. On a node
  that deep-sleeps rather than reboots, this is infrequent and harmless — but
  worth knowing, since a node that rebooted constantly would wear flash.

### D. Encryption + rolling code + ping-pong

Ping-pong has the consumer periodically broadcast a nonce that providers must
echo in subsequent packets.

- **Pro:** The strongest replay protection available, plus a connection-status
  binary sensor for free.
- **Con:** **Requires a two-way link.** The node would need a receive window to
  hear the nonce, which means keeping the radio and MCU awake and listening —
  directly contradicting [ADR-0002](0002-lora-only-topology.md), whose entire
  argument is that the node transmits and immediately sleeps.
- **Con:** The gateway would have to broadcast nonces on a schedule the sleeping
  node cannot reliably observe.
- The energy cost is disqualifying, and the rolling code already covers the
  threat that matters.

### On XXTEA specifically

`packet_transport` uses XXTEA with a 256-bit key. XXTEA is known to be
susceptible to a chosen-plaintext attack, and ESPHome's documentation says so
plainly. That attack is not available here: an adversary cannot choose the soil
moisture readings the node transmits. It otherwise has no published practical
weakness. For this threat model it is entirely adequate, and its compactness
suits a device counting microamps.

## Decision

**Encryption with a shared key, plus rolling code.** No ping-pong.

The key lives in `secrets.yaml` as `lora_encryption_key`, referenced by both
`soil-node.yaml` and `controller/kc868-a8.yaml`, and committed only in the age-encrypted
`secrets.enc.yaml` ([ADR-0014](0014-monorepo-layout.md)).

## Consequences

- **Both ends must carry the same key.** A mismatch produces total silence with
  no diagnostic — the gateway simply discards everything. When debugging a dead
  link, verify the key before suspecting the radio.
- The key must be added to `secrets.yaml` and the file re-encrypted:
  `age --encrypt -R .age-recipients -o secrets.enc.yaml secrets.yaml`.
- **Node names are transmitted in clear**, by design — this is how the consumer
  identifies the provider. It leaks nothing that mDNS would not.
- The rolling code is stored per-provider on the consumer **in RAM, not flash**.
  After a gateway reboot it re-syncs from the next packet received; there is no
  lockout.
- **Connection status is not available** without ping-pong, which is precisely
  why [ADR-0003](0003-a8-as-gateway.md) specifies a separate stale/last-seen
  binary sensor built on the timestamp of the last received packet.
- Security is in place *before* automation is built, so no field visit is needed
  when [ADR-0001](0001-logging-only-scope.md)'s deferred automation arrives.
