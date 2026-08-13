# JWT auth and single role per user

Authentication uses JWT (Bearer access token) and password hashing. Refresh tokens are out of scope for the first release; clients re-authenticate when the access token expires. Authorization is a cascading role on each User (`agent` < `supervisor` < `admin`) stored as a single enum/check on `users.role`, not a roles/permissions table. One role per user matches how the support team is organized today; a finer permission matrix can replace the enum later without changing the identity model.
