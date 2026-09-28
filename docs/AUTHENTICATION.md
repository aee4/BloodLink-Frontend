# Authentication

Sign-in posts credentials to the backend and keeps the returned bearer access token in `SessionStore`, which lives only for the current WebAssembly application lifetime. `BearerHandler` attaches it to API calls. A 401 clears account and token state and routes to `/account/login` with a validated root-relative return path. External URLs, protocol-relative URLs, backslashes and control characters are rejected.

Logout calls the backend before clearing local state. Password change calls the backend and then clears the session because the backend invalidates the security stamp. Login credentials and access tokens are not written to browser storage, logs or error messages. Reloading or restarting the frontend clears the in-memory session; the user signs in again. Backend authorization is authoritative; role claims only tailor navigation.

Password recovery/reset delivery is intentionally unavailable. The UI says: “Password recovery is currently unavailable. Contact your facility administrator.” There are no reset links or reset-token controls. Staff credentials are supplied through a masked form during creation and are not shown after submission; delivery is not claimed.
