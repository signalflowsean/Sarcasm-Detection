# Ruff Formatting Consistency Fix

## Problem

The CI pipeline was failing with formatting errors for `tests/test_rate_limiting.py`:

```
Run ruff check .
All checks passed!
Would reformat: tests/test_rate_limiting.py
1 file would be reformatted, 28 files already formatted
Error: Process completed with exit code 1.
```

## Root Cause

Version mismatches between different environments:

1. **Local ruff version**: 0.14.8
2. **CI ruff version**: Installed from `requirements-dev.txt` with loose constraint `ruff>=0.5.0`
3. **Pre-commit hook**: Using `ruff-pre-commit v0.8.2` (outdated)

Different versions of ruff format code differently, causing:

- Pre-commit hook formats files one way
- CI checks formatting with a different version
- Formatting inconsistencies cause CI failures

## Solution

1. **Pinned ruff version** in `backend/requirements-dev.txt`:

   - Changed from `ruff>=0.5.0` to `ruff==0.14.8`
   - Ensures CI uses the same version as local development

2. **Updated pre-commit hook** in `.pre-commit-config.yaml`:

   - Updated from `v0.8.2` to `v0.8.4`
   - Better compatibility with ruff 0.14.8

3. **Fixed formatting** in `tests/test_rate_limiting.py`:

   - Applied consistent formatting that matches ruff 0.14.8 expectations

4. **Added diagnostic script** (`backend/scripts/check-formatting.sh`):
   - Helps diagnose formatting issues in the future
   - Checks versions, formatting status, and uncommitted changes

## Prevention

To prevent this issue in the future:

1. **Always pin tool versions** in requirements files (avoid `>=` for critical tools)
2. **Run formatting checks before committing**:
   ```bash
   cd backend
   ruff format --check .
   ```
3. **Use the diagnostic script** if formatting issues occur:
   ```bash
   ./backend/scripts/check-formatting.sh
   ```
4. **Keep pre-commit hooks updated** to match tool versions

## Verification

After these changes:

- ✅ All files pass `ruff format --check .`
- ✅ Ruff version is pinned to 0.14.8
- ✅ Pre-commit hook updated to v0.8.4
- ✅ Diagnostic script available for future troubleshooting
