# ADR-0014 — Node firmware and hardware live in this repository

**Status:** Accepted

## Context

The project so far describes one device: the KC868-A8 fertigation controller,
with its firmware in `controller/`, an age-encrypted secrets scheme, a dashboard
and observability configuration.

The soil node adds a second device with its own firmware, its own PCB design and
its own documentation. It could live here or in its own repository.

## Options considered

### A. This repository, as a monorepo (chosen)

```
automated-fertigation-system/
├── controller/
│   ├── kc868-a8.yaml        # controller + LoRa gateway
│   ├── secrets.yaml         # gitignored
│   ├── secrets.enc.yaml     # age-encrypted
│   └── .age-recipients      # age recipient
└── soil-node/
    ├── README.md            # hardware documentation, BOM, netlist
    ├── plan.md              # implementation plan
    ├── adr/                 # architecture decision records
    ├── soil-node.yaml       # node firmware (to be written)
    └── hardware/            # KiCad project (to be created)
```

(When the node firmware is written it will need the shared LoRa key; how the two
firmwares share one secrets store is deferred to that point.)

- **Pro:** **The two firmwares are tightly coupled.** They must agree on
  frequency, spreading factor, sync word, encryption key and sensor names.
  Changing one without the other silently breaks the link — and silently is the
  operative word, because the failure looks like a radio problem. Keeping them
  in one commit makes coordinated changes atomic and reviewable together.
- **Pro:** **One secrets store.** The existing `secrets.yaml` /
  `secrets.enc.yaml` / `.age-recipients` scheme already works. Both devices need
  the shared LoRa encryption key; a second repository would mean a second
  encrypted secrets file holding the same value, kept in sync by hand — a
  reliable source of future confusion.
- **Pro:** The gateway change lives in `controller/kc868-a8.yaml` regardless, so
  the work touches this repository whatever is decided.
- **Pro:** One clone, one history, one place to look in three years.
- **Con:** Widens the repository's scope from "one controller" to "a fertigation
  system with multiple devices". The README's framing needs updating.
- **Con:** Mixes firmware and hardware (KiCad) artefacts in one tree.

### B. Separate repository

- **Pro:** Clean separation; the node could be published or reused independently.
- **Pro:** Hardware design files stay out of a firmware repository.
- **Con:** The shared secrets problem above, which is the decisive objection.
- **Con:** Coordinated changes across two repositories cannot be atomic. Someone
  will change the sync word in one and not the other.
- **Con:** The node has no independent existence — it serves this system's
  irrigation decisions and nothing else.

### C. Git submodule

- **Con:** All of B's coupling problems, plus submodules' well-earned reputation
  for surprising people who have not touched the repository in a year.

## Decision

**Monorepo.** The node lives under `soil-node/` in this repository, sharing the
secrets scheme and the ESPHome toolchain (`../my-esphome/.venv/bin/esphome`).

## Consequences

- Shared configuration values live in `secrets.yaml` and are referenced by both
  YAML files: `lora_encryption_key` at minimum. Both must be added to
  `secrets.enc.yaml` and re-encrypted.
- Coordinated radio changes are one commit touching both files. **Enforce this
  by convention:** never change a radio parameter in one file alone.
- The root `README.md` needs a section introducing the node and pointing here,
  so the repository's scope is not misleading.
- KiCad project files are committed under `soil-node/hardware/`. Binary artefacts
  in git are not ideal, but the board must be reorderable years later without
  reverse-engineering it, which outweighs the tidiness objection.
- Both devices are flashed with the same toolchain, from the same directory,
  with the same secrets decrypted — one workflow rather than two.
- If a second or third node is ever built, they share `soil-node.yaml` with
  substitutions rather than becoming separate projects.
