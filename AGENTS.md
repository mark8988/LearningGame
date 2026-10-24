# Repository Guidelines

## Project Structure & Module Organization

This checkout contains development documentation and task records; application source, dependency manifests, tests, and assets are absent. Existing records describe a Flutter voice application and a Python voice server. Treat referenced application paths as external to this checkout until source is available.

- `cc-workspace/docs/`: specifications, research, project notes, database documentation, and project rules.
- `cc-workspace/task/`: work organized into `todo/`, `done/`, `issue/`, and `feedback/`.
- `cc-workspace/sd-review/`: architecture decisions and review records.
- `cc-workspace/dev-sop/`: reusable workflow templates and setup scripts.
- `.claude/commands/`: project command definitions.
- `CLAUDE.md`, `WORKFLOW.md`, and `NEW_PROJECT_SETUP.md`: contributor workflow and setup references.

## Build, Test, and Development Commands

There is no runnable build or test target in this checkout. Do not treat the commented npm examples in `CLAUDE.md` as configured commands.

When working in the corresponding application checkout, the records specify:

- `flutter analyze`: static analysis; acceptance requires zero warnings.
- `flutter test`: Flutter unit and widget tests.
- `flutter test integration_test -d <device> --no-uninstall`: device integration tests while preserving application data.
- `pytest`: server automated tests, from the server environment.

Confirm dependencies and working directories before running these commands.

## Coding Style & Naming Conventions

Use UTF-8 Markdown, descriptive headings, and concise, actionable text. Preserve existing Traditional Chinese terminology when editing records. Follow surrounding list indentation and fenced-code formatting; no formatter or linter configuration is present.

Specifications use `yyyyMMdd_topic.md`; task records use `yyyyMMddHHmmss_PG_topic.md`. Preserve status prefixes such as `[CONFIRM]`. For future source changes, follow adjacent code conventions and use meaningful names with minimal comments.

## Testing Guidelines

No coverage threshold or executable test suite is included here. Application records require Flutter unit/widget tests, server pytest tests, and recorded device smoke verification. Follow the latest specification's acceptance criteria and report commands, results, and limitations. For documentation changes, verify paths, links, and consistency with current decisions.

## Commit & Pull Request Guidelines

No `.git` directory or commit history is available, so commit-message conventions cannot be verified. Use concise, descriptive messages. PR descriptions should link relevant specifications or task records, summarize changes, and record validation; include screenshots or demo recordings for UI changes. The documented workflow requires PG confirmation before commit or push.

## Project Knowledge & Configuration

Read `cc-workspace/docs/PROJECT_NOTES.md`, `SD_RULES.md`, and the relevant specification before implementation. Append discoveries to project notes and keep completed work traceable. Keep credentials and device tokens out of documentation and screenshots.
