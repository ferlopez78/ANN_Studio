## 1. Architecture Baseline

- [ ] 1.1 Define entity-first frontend module boundaries and ownership.
- [ ] 1.2 Define backend domain module boundaries and service contracts.
- [ ] 1.3 Define run telemetry source-of-truth policy (backend only).

## 2. Frontend Decomposition (Slice 1)

- [x] 2.1 Extract Model Design form parsing and payload building to dedicated utility module.
- [x] 2.2 Extract Model Design architecture preview to dedicated UI component.
- [x] 2.3 Extract Model Design wizard tabs to dedicated UI component.
- [x] 2.4 Remove synthetic global run progression interval from store.

## 3. Frontend Decomposition (Next Slices)

- [ ] 3.1 Split current global store into entity-oriented stores/slices.
- [ ] 3.2 Isolate run orchestration state from project/dataset/model state.
- [ ] 3.3 Add selectors to avoid broad rerenders on unrelated entity changes.

## 4. Backend Hardening (Next Slices)

- [ ] 4.1 Move run execution to async worker boundary.
- [ ] 4.2 Implement live telemetry stream endpoint contract.
- [ ] 4.3 Align model-design training options with executable backend runtime profile.

## 5. Verification

- [x] 5.1 Build frontend and verify model-design create/edit/delete flows.
- [x] 5.2 Verify run data changes only via backend sync paths.
- [x] 5.3 Verify no synthetic run epoch mutation remains active in UI store.
