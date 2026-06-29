# Data

The data store for this app. The runtime (`src/db.ts`) reads `driver` and `path`
from this file. The environment variable `SLOPPY_DB` overrides the path.

- driver: sqlite
- path: data/sloppy.db

Only the `sqlite` driver is implemented — lightweight, local,
zero-setup. Other stores (e.g. a hosted Postgres/Supabase) are future work; the
runtime errors clearly if an unimplemented driver is selected.
