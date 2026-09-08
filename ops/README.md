# Operations

Operational source is separate from the Next.js application. Each subsystem has
its own directory; [token usage](token-usage/README.md) collects and publishes
aggregate usage data.

Keep device inventories, SSH destinations, login paths, credentials, raw captures,
and deployment incident notes outside this public repository. Use a private operator runbook supplied through the local working environment.
Its location and contents should not be committed. Verify the authorized host before changing a deployment. Do not paste
private values into issues, PRs, logs, or public documentation.

Public docs should explain the contracts, example installation layout, security
boundaries, and recovery procedure. They should not describe a live fleet or
publish account identifiers. Removing a value from the current tree does not
remove it from Git history; exposed credentials require revocation or rotation.
