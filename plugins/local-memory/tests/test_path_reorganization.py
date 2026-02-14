"""Tests for local-memory file path reorganization.

Verifies:
1. New state files go into .claude/local-memory-state/{hash}.json
2. New cache files go into .claude/local-memory-cache/{hash}.json
3. Old flat files are auto-migrated on access
4. Cleanup handles both new subdirs and old flat leftovers
"""

import asyncio
import hashlib
import json
import os
import shutil
import sys
import tempfile
import time

import importlib.util

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'hooks'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'server'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from context_builder import _get_cache_path, _load_summary_cache, _save_summary_cache

# Import local-memory_stop.py (hyphenated name needs importlib)
_stop_hook_path = os.path.join(os.path.dirname(__file__), '..', 'hooks', 'local-memory_stop.py')
_spec = importlib.util.spec_from_file_location("local_memory_stop", _stop_hook_path)
_stop_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_stop_mod)

get_session_state_path = _stop_mod.get_session_state_path
cleanup_stale_files = _stop_mod.cleanup_stale_files


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


class TestPathReorganization:

    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp(prefix="lm-paths-test-")
        self.claude_dir = os.path.join(self.tmpdir, '.claude')
        os.makedirs(self.claude_dir)

    def teardown_method(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    # ---- State file tests ----

    def test_state_path_uses_subdirectory(self):
        """New state path should be .claude/local-memory-state/{hash}.json"""
        path = get_session_state_path(self.tmpdir, "/fake/transcript.jsonl")
        # Should be: .claude/local-memory-state/{hash}.json
        parent = os.path.basename(os.path.dirname(path))
        assert parent == 'local-memory-state', f"Expected parent 'local-memory-state', got '{parent}'"
        assert path.endswith('.json')
        # Filename should be just the hash, not prefixed with 'local-memory-state-'
        filename = os.path.basename(path)
        assert not filename.startswith('local-memory-state-'), f"Filename should be hash only, got '{filename}'"
        print(f"  PASS: State path = {os.path.relpath(path, self.tmpdir)}")

    def test_state_migrates_old_flat_file(self):
        """Old flat state file should be auto-migrated to subdirectory."""
        transcript = "/fake/transcript.jsonl"
        h = hashlib.md5(transcript.encode()).hexdigest()[:12]

        # Create old flat file
        old_path = os.path.join(self.claude_dir, f'local-memory-state-{h}.json')
        state_data = {"last_processed_line": 42, "suggested_directories": ["src"]}
        with open(old_path, 'w') as f:
            json.dump(state_data, f)

        # Call get_session_state_path — should trigger migration
        new_path = get_session_state_path(self.tmpdir, transcript)

        assert not os.path.exists(old_path), "Old flat file should be removed after migration"
        assert os.path.exists(new_path), "New file should exist after migration"

        with open(new_path, 'r') as f:
            migrated = json.load(f)
        assert migrated["last_processed_line"] == 42
        print(f"  PASS: State migrated from flat to {os.path.relpath(new_path, self.tmpdir)}")

    # ---- Cache file tests ----

    def test_cache_path_uses_subdirectory(self):
        """New cache path should be .claude/local-memory-cache/{hash}.json"""
        path = _get_cache_path("src/api", self.tmpdir)
        parent = os.path.basename(os.path.dirname(path))
        assert parent == 'local-memory-cache', f"Expected parent 'local-memory-cache', got '{parent}'"
        print(f"  PASS: Cache path = {os.path.relpath(path, self.tmpdir)}")

    def test_cache_migrates_old_flat_file(self):
        """Old flat cache file should be auto-migrated to subdirectory."""
        directory = "src/components"
        h = hashlib.md5(directory.encode()).hexdigest()[:12]

        # Create old flat file
        old_path = os.path.join(self.claude_dir, f'local-memory-cache-{h}.json')
        cache_data = {"directory": directory, "summaries": {"app.ts": {"mtime": 1, "size": 100, "summary": "test"}}}
        with open(old_path, 'w') as f:
            json.dump(cache_data, f)

        # Call _get_cache_path — should trigger migration
        new_path = _get_cache_path(directory, self.tmpdir)

        assert not os.path.exists(old_path), "Old flat file should be removed after migration"
        assert os.path.exists(new_path), "New file should exist after migration"

        with open(new_path, 'r') as f:
            migrated = json.load(f)
        assert migrated["summaries"]["app.ts"]["summary"] == "test"
        print(f"  PASS: Cache migrated from flat to {os.path.relpath(new_path, self.tmpdir)}")

    def test_cache_save_load_roundtrip(self):
        """Save and load cache through the new path structure."""
        directory = "plugins/test"
        cache = {"directory": directory, "summaries": {"index.ts": {"mtime": 99, "size": 50, "summary": "entry point"}}}

        _save_summary_cache(directory, self.tmpdir, cache)
        loaded = _load_summary_cache(directory, self.tmpdir)

        assert loaded["directory"] == directory
        assert loaded["summaries"]["index.ts"]["summary"] == "entry point"
        print(f"  PASS: Cache roundtrip OK in subdirectory")

    # ---- Cleanup tests ----

    def test_cleanup_handles_subdirectories(self):
        """Cleanup should remove stale files from subdirectories."""

        # Create files in new subdirectory layout
        state_dir = os.path.join(self.claude_dir, 'local-memory-state')
        cache_dir = os.path.join(self.claude_dir, 'local-memory-cache')
        os.makedirs(state_dir)
        os.makedirs(cache_dir)

        stale_state = os.path.join(state_dir, 'abc123.json')
        stale_cache = os.path.join(cache_dir, 'def456.json')
        with open(stale_state, 'w') as f:
            json.dump({}, f)
        with open(stale_cache, 'w') as f:
            json.dump({}, f)

        # Make them appear old (10 days ago)
        old_time = time.time() - (10 * 86400)
        os.utime(stale_state, (old_time, old_time))
        os.utime(stale_cache, (old_time, old_time))

        cleanup_stale_files(self.tmpdir, max_age_days=7)

        assert not os.path.exists(stale_state), "Stale state file should be cleaned up"
        assert not os.path.exists(stale_cache), "Stale cache file should be cleaned up"
        print(f"  PASS: Cleanup removes stale files from subdirectories")

    def test_cleanup_removes_old_flat_leftovers(self):
        """Cleanup should also remove any old flat-layout files."""

        old_flat = os.path.join(self.claude_dir, 'local-memory-state-abc123def456.json')
        with open(old_flat, 'w') as f:
            json.dump({}, f)

        cleanup_stale_files(self.tmpdir, max_age_days=7)

        # Old flat files are cleaned up regardless of age (migration cleanup)
        assert not os.path.exists(old_flat), "Old flat-layout file should be removed"
        print(f"  PASS: Cleanup removes old flat-layout leftovers")


def main():
    test = TestPathReorganization()
    tests = [
        ("1. State path uses subdirectory", test.test_state_path_uses_subdirectory),
        ("2. State migrates old flat file", test.test_state_migrates_old_flat_file),
        ("3. Cache path uses subdirectory", test.test_cache_path_uses_subdirectory),
        ("4. Cache migrates old flat file", test.test_cache_migrates_old_flat_file),
        ("5. Cache save/load roundtrip", test.test_cache_save_load_roundtrip),
        ("6. Cleanup handles subdirectories", test.test_cleanup_handles_subdirectories),
        ("7. Cleanup removes old flat leftovers", test.test_cleanup_removes_old_flat_leftovers),
    ]

    passed = 0
    failed = 0
    for name, fn in tests:
        test.setup_method()
        try:
            fn()
            print(f"  OK: {name}")
            passed += 1
        except Exception as e:
            print(f"  FAIL: {name}")
            import traceback
            traceback.print_exc()
            failed += 1
        finally:
            test.teardown_method()

    print(f"\n{'='*50}")
    print(f"Results: {passed} passed, {failed} failed out of {passed + failed}")
    if failed == 0:
        print("All tests PASSED!")
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
