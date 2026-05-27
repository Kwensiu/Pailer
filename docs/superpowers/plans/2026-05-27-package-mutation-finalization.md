# Package Mutation Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Scoop package mutations leave installed package state consistent after install, update, uninstall, and update-all.

**Architecture:** Quick stage adds a small internal finalization Module for cache invalidation, final package-state lookup, and single-package mutation events. Complete stage can later add an explicit batch mutation event and unify streamed/headless update execution.

**Tech Stack:** Rust, Tauri commands, existing Scoop command Modules, existing `package-mutation-finished` event.

---

## Stage 1: Quick, Stable Route

### Task 1: Deepen package mutation finalization

**Files:**
- Modify: `src-tauri/src/commands/package_mutation.rs`
- Modify: `src-tauri/src/commands/install.rs`
- Modify: `src-tauri/src/commands/update.rs`
- Modify: `src-tauri/src/commands/uninstall.rs`

- [ ] Add a `PackageMutationKind` enum and helper functions in `package_mutation.rs`.
- [ ] Move repeated cache invalidation, final package-state lookup, and `package-mutation-finished` emission behind that helper.
- [ ] Keep `trigger_auto_cleanup` in the command modules for now.
- [ ] Keep `update-all` from emitting `package-mutation-finished`; only invalidate installed cache after success.

### Task 2: Validate quick route

**Files:**
- Test existing Rust command compilation and focused helper tests if practical.

- [ ] Run `cd src-tauri && cargo test`.
- [ ] If full tests are too slow or blocked by environment, run `cd src-tauri && cargo test package_mutation`.

## Stage 2: Complete Route

### Task 3: Add batch package mutation event

**Files:**
- Modify: `src-tauri/src/commands/package_mutation.rs`
- Modify: `src/stores/operations.ts` or installed package store area after frontend review.

- [ ] Add a dedicated event such as `installed-packages-changed` for update-all.
- [ ] Make frontend refresh installed packages when that event is received.
- [ ] Do not overload `package-mutation-finished`, because its Interface is single-package oriented.

### Task 4: Unify update execution shape

**Files:**
- Modify: `src-tauri/src/commands/update.rs`
- Modify: `src-tauri/src/commands/scoop.rs`
- Modify: `src-tauri/src/commands/powershell.rs`

- [ ] Make manual and headless update-all share one operation result shape.
- [ ] Keep UI streaming and headless output as different Adapters.
- [ ] Add tests for success, failure, warning output, and cancellation semantics.

---

## Self-Review

- Spec coverage: quick stage covers the stable route requested and fixes update-all cache consistency.
- Placeholder scan: no implementation placeholders are required before Stage 1; Stage 2 is intentionally scoped as future architecture work.
- Type consistency: quick stage uses existing `CommandResult`, `ScoopPackage`, and `package-mutation-finished` event semantics.
