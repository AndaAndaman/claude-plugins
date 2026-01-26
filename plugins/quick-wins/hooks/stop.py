#!/usr/bin/env python3
"""Stop hook for quick-wins plugin."""
import json
import sys

def main():
    try:
        # Read hook input
        input_data = json.load(sys.stdin)

        # Check if we should skip scanning
        # For now, just allow stop (no scan)
        # TODO: Add logic to detect code changes from transcript

        result = {"ok": True}
        print(json.dumps(result))
        sys.exit(0)

    except Exception as e:
        # On error, allow stop
        print(json.dumps({"ok": True}))
        sys.exit(0)

if __name__ == '__main__':
    main()
