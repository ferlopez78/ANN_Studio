# ANN Studio Review Checklist

## Correctness and Behavior
- [ ] New behavior matches stated requirement.
- [ ] No obvious regression in existing user flows.
- [ ] Edge cases and invalid inputs are handled.

## Contracts and State
- [ ] API contracts remain backward-compatible or are versioned.
- [ ] Run status semantics are consistent (queued/running/completed/failed/review).
- [ ] Error payloads are deterministic and actionable.

## Architecture and Layering
- [ ] Feature-first boundaries are preserved.
- [ ] UI code does not embed low-level persistence/network logic.
- [ ] Domain/application/infrastructure concerns are not mixed.

## Data Integrity and Lineage
- [ ] Dataset/model/run references remain valid.
- [ ] Immutable historical records are not mutated.
- [ ] Artifact references use URI-style links instead of duplicated binary blobs.

## Security and Operations
- [ ] Sensitive fields are not logged or persisted in plaintext.
- [ ] Failure paths provide useful diagnostics.
- [ ] Observability fields (IDs/timestamps) are present where needed.

## Verification
- [ ] Build/lint/tests relevant to the change were executed.
- [ ] Known limitations and residual risks are documented.
