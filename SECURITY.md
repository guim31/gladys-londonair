# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- **No secret.** The London Air API is open: no account, no key, nothing to
  store.
- **`/data`** holds `londonair.json`: the public list of the London boroughs
  and monitoring sites (names and coordinates) from the last bulletin, and for
  each configured area its last indices and the last band the scene triggers
  saw. Nothing personal.
- **The house location** (Gladys `location` authorization) is read only when
  the user clicks "Find an area" without a name, to sort the areas by
  distance, locally; it is never sent, stored nor logged.
- **Network**: HTTPS requests to `api.erg.ic.ac.uk` only. Nothing listens.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the London Air services.
