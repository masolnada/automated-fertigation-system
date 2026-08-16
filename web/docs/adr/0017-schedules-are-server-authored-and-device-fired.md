# Schedule entries are authored here, stored here, and fired by the controller

The dashboard is where a scheduled irrigation is created and deleted, and SQLite
is where the set lives — it is operator-authored durable data, like a Zone. But
the server does **not** fire it. It publishes the whole set retained to
`schedule/set` and the controller executes from its own clock
(controller ADR-0018), because the device spends weeks in the field with no
network and a scheduler that only ran while the server could reach it would
contradict the deployment.

An entry is **immutable**: created and deleted, never updated. It is a whole
instruction rather than a record with fields, so changing the time is stating a
new instruction. This also keeps the device's copy trivial — the retained topic
carries a complete set that replaces whatever was held, with no per-entry
reconciliation.

## Considered options

**Echoing the device's held set back, and marking entries it has not picked up
(rejected).** An edit made while the controller is offline reaches it on
reconnect and not before, so a deleted entry can still water once or twice. A
`schedule/state` topic would let the dashboard mark exactly which entries are
live. Rejected because schedules are edited at home, on WiFi, and the machinery
would exist for a case that is rare in practice. The retained topic still
guarantees eventual delivery; the dashboard simply does not visualise the gap.

**Storing a zone id rather than a channel (rejected).** It reads better and
survives re-plumbing — the dashboard would push updated channels to the device
whenever the assignation table changed. Rejected because the re-sync only lands
when the device is reachable, so after three weeks in the field the entry fires
on the old channel anyway. That is the worst of both: a model that claims a
guarantee the deployment cannot keep. A channel is what the controller can honour
offline, so a channel is what is stored.

**Full editing of an entry (rejected).** Nudging a time or a volume is the most
likely real change, and delete-and-recreate makes it the most tedious operation
in the feature. Rejected anyway: immutability is what makes whole-set replacement
safe, and one write path is worth more than the saved clicks.

## Consequences

- An entry names a channel on the wire and a zone on screen, resolved at the edge
  of the UI exactly as everything else is (ADR-0016).
- **Re-plumbing redirects the schedules standing on a channel.** The assignation
  editor says so before the save, naming the count and both zones. The table
  itself is fully visible before committing, so it needs no Confirmation; this
  one consequence is invisible in the click, which is the test ADR-0012 sets.
- **Archiving a zone deletes the entries on its channel.** An archived zone is
  out of service; entries left behind would keep watering it with nothing on
  screen naming them. This is a deliberate exception to archiving being pure
  bookkeeping — the schedules are not history, they are future acts.
- Deleting is confirmed and carries `danger`, because there is nothing to restore:
  recreating means walking the wizard again.
- The wizard's final step **is** the Confirmation; no dialog is stacked on it. The
  step band restates each step's answer as it is left, so the operator sees every
  consequential input at the moment of committing — which is what ADR-0012's rule
  is for. A dialog repeating what they had just typed two inches above would be
  the speed bump that ADR explicitly names as the failure mode. The step being
  *edited* shows only its name, for the same reason.
- The Irrigation card no longer carries cycle controls. Every run carries its own
  recipe (controller ADR-0018), so those controls would be editing something no
  commanded run reads. The device's **default recipe** — what the offline button
  waters with — moved to the flow node's modal, among the device's own settings.
- `Modal` gained a `wide` variant. A surface that builds something needs room to
  lay its steps out; a Confirmation wants to stay small enough to read at a
  glance.
