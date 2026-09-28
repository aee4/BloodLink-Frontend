# Contributing

Keep the frontend independent of backend implementation projects. UI workflows call the configured versioned HTTP API through typed clients; do not add project references to Domain, Application, or Infrastructure and do not add database access or secrets. Keep tokens in the in-memory session store and keep authorization enforcement on the API.

Before submitting changes, run the Release build, solution tests, format verification, and package vulnerability check described in `README.md`. Add isolated UI/client tests and exercise changed workflows against the disposable Development API when the backend contract is affected.
