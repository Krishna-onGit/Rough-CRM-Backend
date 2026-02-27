# LeadFlow AI — Changelog Contribution Guide

## How to Update the Changelog

Every time a phase or feature is completed, update CHANGELOG.md at the
project root. Follow these rules strictly.

---

## Section Structure

Each version block follows this format:

## [VERSION] — YYYY-MM-DD

### Phase Name

### Added
- New files, features, endpoints, models created

### Changed  
- Modifications to existing implementations

### Fixed
- Bug fixes, error resolutions, config corrections

### Removed
- Deleted files or deprecated features

### Infrastructure Decisions & Notes
- Any architectural decisions made and why

### File Manifest
- List of all files created/modified in this phase

---

## Version Numbering

| Phase | Version |
|---|---|
| Phase 1 — Foundation | 0.1.0 |
| Phase 2 — Auth & RBAC | 0.2.0 |
| Phase 3 — Full Schema | 0.3.0 |
| Phase 4 — Projects & Units | 0.4.0 |
| Phase 5 — Inventory Engine | 0.5.0 |
| Phase 6 — Pre-Sales | 0.6.0 |
| Phase 7 — Post-Sales | 0.7.0 |
| Phase 8 — Customer 360 | 0.8.0 |
| Phase 9 — Approvals | 0.9.0 |
| Phase 10 — Analytics | 0.10.0 |
| Phase 11 — Production | 1.0.0 |

## Rules

- NEVER delete old version entries
- ALWAYS add new versions at the TOP (below [Unreleased])
- Move items from [Unreleased] into a versioned block when a phase completes
- Keep entries human-readable — write for a developer reading 6 months later
- Every infrastructure decision must be documented with its rationale
- File manifests must list every file touched in that phase
