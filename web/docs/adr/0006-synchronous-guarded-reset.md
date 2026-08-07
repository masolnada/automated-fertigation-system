# Total Water reset is a synchronous HTTP command

Unlike the publish-and-ack (202) commands, `reset-total-water` holds the HTTP
request open: the server runs the eligibility guard first (409 if ineligible),
publishes the request, and awaits the device's `flow/reset_total/result` within a
10 s timeout, resolving the request with success, the rejection, or a timeout.
This makes an irreversible action's outcome unambiguous to the operator and
removes the client-side timer dance the browser used to run. Concurrent resets
would need a correlation id the device does not support, so that is intentionally
not built.
