# Instance administration

All administration endpoints require an authenticated user session. API keys
cannot administer an instance. Permissions are read from the database for every
request; cached session roles do not grant access after a role is revoked.

The built-in `admin` role grants every permission. Custom roles are assigned
separately from the authentication role, so a custom administrator remains an
ordinary user to Better Auth. Only built-in administrators can create, edit,
delete or assign instance roles, create administrators, or manage privileged
accounts. The last active built-in administrator cannot be removed.

`GET /api/admin/access` returns the caller's current permissions.
`GET/POST /api/admin/roles`, `PUT/DELETE /api/admin/roles/:roleId`, and
`PUT /api/admin/users/:userId/instance-role` manage custom roles and assignments.
The assignment body is `{ "roleId": "..." }`; use `null` to remove it.
Roles with assignments cannot be deleted. Management permissions automatically
include the read permission needed to reach their administration screen.

## Signed audit webhooks

Configure `NOTIFICATION_SECRET_ENCRYPTION_KEY` before creating a webhook.
Signing secrets are encrypted at rest with the existing AES-256-GCM secret
store. Keep this environment key stable and back it up securely: changing it
prevents decryption of existing secrets. Creating a webhook or rotating its
secret returns the plaintext secret once; list, update and history responses
never expose it. Do not place credentials in the destination URL.

Use the Instance webhooks administration page or these endpoints:

- `GET/POST /api/admin/webhooks`
- `PUT/DELETE /api/admin/webhooks/:webhookId`
- `POST /api/admin/webhooks/:webhookId/test`
- `POST /api/admin/webhooks/:webhookId/rotate-secret`
- `GET /api/admin/webhooks/:webhookId/deliveries`

Configuration bodies contain `name`, `url`, `enabled` and `categories`.
Supported audit categories are `user`, `session`, `api_key`, `workspace`,
`role`, `instance`, `email` and `webhook`. These are administration audit events,
not task/project events. URLs must resolve to public HTTP(S) destinations;
production requires HTTPS. DNS is checked again when opening a socket and
redirects are never followed. Webhook responses are discarded without reading
their bodies. Delivery history contains status codes and fixed error codes,
never payloads, credentials, response bodies or error text from the destination.

Audit events and queued deliveries commit in the same database transaction.
Workers use row locks and a lease across instances. Network errors, HTTP 408,
429 and 5xx responses retry up to three attempts; other non-2xx responses fail
without retries. Each request times out after five seconds. Changing webhook
configuration or rotating its secret cancels pending deliveries. Retention keeps
the latest 100 completed deliveries per webhook; the UI shows the latest 20.

The request headers are:

- `x-kaneo-delivery`: stable delivery ID, reused for retries.
- `x-kaneo-timestamp`: Unix timestamp in seconds for this attempt.
- `x-kaneo-signature`: `sha256=<hex HMAC-SHA256>`.

Compute the expected HMAC over the timestamp, a literal period, then the exact
UTF-8 body bytes. Verify it with a constant-time comparison **before parsing or
processing the body**. Reject timestamps older than your chosen replay window
(for example, five minutes), and deduplicate by `x-kaneo-delivery`. A receiver can
accept a request even when its response is lost, so retries may deliver the same
event again. Example signature calculation in Node.js:

```ts
const expected = createHmac("sha256", signingSecret)
  .update(timestamp)
  .update(".")
  .update(rawBody)
  .digest();
```
