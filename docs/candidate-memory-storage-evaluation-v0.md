# Candidate Memory Storage Evaluation v0

## Scope

Evaluate the local persistence mechanism for `FreeboxMemoryRepository` without changing TBZ runtime wiring and without closing the still-open 1B Memory/Evidence contract.

## Decision

**SQLite is the recommended local storage mechanism for the first real Freebox adapter.**

JSON remains useful for export/debug snapshots, but should not be the authoritative transactional store.

## Comparison

| Criterion | JSON file(s) | SQLite | Other local DB |
|---|---|---|---|
| Atomicity | Possible with temp-file + rename, but must be implemented carefully | Native transactional model | Depends on engine |
| Corruption handling | File-level corruption can invalidate the state | Journaling/WAL options provide stronger crash recovery | Depends on engine |
| Concurrency | Requires explicit locking protocol | Built-in transactional locking/concurrency controls | Depends on engine |
| Version check | Application-level | Application-level conditional update/transaction | Application-level |
| Transactions | Manual | Native | Usually native |
| Backup | Simple file copy, but consistency must be considered during writes | Single database file can be backed up with SQLite-aware procedure | Depends on engine |
| Recovery | Manual recovery strategy | Mature rollback/journal mechanisms | Depends on engine |
| Cloud migration | Straightforward export, but schema/consistency is application-defined | Structured relational export/migration path | Depends on engine |
| Operational simplicity | Very high | High | Usually lower |
| Dependency footprint | Minimal | Small and mature | Usually larger |
| USB suitability | Good | Good | Usually unnecessary |

## Why SQLite wins

Candidate Memory now requires three properties that are awkward to guarantee with plain JSON once concurrent requests exist:

1. atomic read/modify/write;
2. optimistic version checking;
3. crash-safe commit.

SQLite provides these primitives without introducing a server process. This makes it a better fit for a Freebox/USB prototype that should behave like a real backend while remaining portable to a future cloud implementation.

## Proposed local layout

```text
/tbz-memory/
    candidate-memory.sqlite
    exports/
        <candidate_id>/
            ... optional snapshots ...
```

The SQLite file is authoritative. `exports/` is optional and non-authoritative.

## Proposed logical record

The exact internal schema remains deliberately provisional because 1B has not finalized Memory/Evidence semantics.

At minimum the persistence layer needs to represent:

```text
candidate_id
state_version
candidate_state
updated_at
```

The complete canonical Candidate Memory state should remain opaque to the repository implementation except for the fields required by the repository contract (`candidate_id` and version).

## Atomic save model

Conceptually:

```text
BEGIN
  read current version
  verify expected_version
  write new state
  advance state version
COMMIT
```

If any operation fails:

```text
ROLLBACK
```

The previous committed state remains authoritative.

## Concurrency model

Use optimistic concurrency:

```text
GET -> version N
MODIFY
SAVE(expected_version=N)
```

A second writer that has already committed version `N+1` causes the first writer's conditional save to fail instead of silently overwriting it.

The repository must expose a stable conflict error/result; the exact error type is intentionally deferred until runtime integration.

## JSON position

JSON should remain available for:

- human-readable exports;
- diagnostics;
- snapshots;
- migration tooling;
- fixture generation.

It should not be the authoritative concurrent store for Candidate Memory.

## Security / operational minimum

- Store the database outside the web-served directory.
- Do not log candidate state or sensitive fields.
- Restrict filesystem permissions to the TBZ service account.
- Do not expose the SQLite file through the Freebox web/public share.
- Back up the database independently from the application output directory.
- Keep secrets out of the database unless a later contract explicitly requires them.

## Explicit non-decisions

This document does **not** decide:

- the final Memory/Evidence schema;
- `memory_item_id` identity semantics;
- Evidence duplicate semantics;
- semantic idempotence;
- cloud vendor;
- PostgreSQL schema;
- runtime repository injection;
- migration code.

Those remain dependent on the 1B closure and later integration work.

## Verdict

**GREEN for storage choice:** SQLite is the recommended authoritative local persistence mechanism.

**ORANGE for implementation:** do not implement the adapter until the 1B Memory/Evidence contract and repository integration boundary are formally closed.
