# Testing

Run `dotnet test BloodLink.Frontend.sln --configuration Release`. Unit tests cover compiled route ownership, local return-path validation, in-memory role/session clearing and safe API error mapping. Run `dotnet format BloodLink.Frontend.sln --verify-no-changes` and `dotnet list BloodLink.Frontend.sln package --vulnerable --include-transitive` as repository gates.

Cross-repository browser verification requires the backend running with a disposable database, a browser, and the frontend origin in backend CORS. Exercise registration, administrator/staff workflows, inventory, needs, internal/external requests, notifications, persistence after refresh/restart and role boundaries. Record API responses and database state for every mutation. Do not run live email delivery; password recovery remains disabled.
