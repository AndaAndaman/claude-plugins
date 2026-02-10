---
autoGenerate: true
threshold: 2
cooldownMinutes: 30
debug: true
---

# Local Memory Plugin Settings

This file configures the local-memory plugin behavior for this project.

## Settings

- **autoGenerate**: Enable/disable automatic CLAUDE.md generation suggestions
- **threshold**: Minimum files in a directory to trigger suggestion (default: 2)
- **cooldownMinutes**: Skip directories with CLAUDE.md updated within this time (default: 30)
- **debug**: Enable debug logging to `.claude/local-memory-debug.log`

## Excluded Directories (defaults)

The following directories are excluded by default:
- node_modules, vendor, packages
- .git, .svn, .hg, .bzr
- dist, build, out, target, bin, obj
- test, tests, spec, specs, __tests__, __snapshots__
- coverage, .next, .nuxt, .angular, __pycache__
- temp, tmp, cache

To add custom exclusions:
```yaml
excludedDirectories:
  - my-custom-dir
  - another-dir
```
