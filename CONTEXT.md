# Pailer Context

## Domain Terms

### Operation

A long-running Scoop-related task tracked by Pailer, such as installing,
updating, uninstalling, scanning, or updating all packages. An Operation has a
stable id, output lines, status, optional package metadata, and optional UI
follow-up behaviour.

### Operation Presentation

The UI surface used to show an Operation. Pailer has two intended presentation
forms: a full Operation modal for focused tasks and a minimized operation tray
item for background tasks.

### Operation Completion Follow-Up

Page-specific work that should happen when an Operation reaches a terminal
status, such as refreshing the selected package details or bucket manifests.
This is tied to Operation completion, not to closing the Operation modal.
