#!/usr/bin/env python3
"""
Lock Ordering Validation Demo

This script demonstrates how the lock ordering validation system prevents
deadlock bugs by catching incorrect lock acquisition patterns.

Run this script to see:
1. Correct lock ordering (prosodic -> onnx) - succeeds
2. Incorrect lock ordering (onnx -> prosodic) - raises LockOrderingError
"""

import sys
from pathlib import Path

# Add parent directory to path to import models.loader
sys.path.insert(0, str(Path(__file__).parent.parent))

from models.loader import (
    LockOrderingError,
    _onnx_session_lock,
    _prosodic_model_lock,
    enable_lock_ordering_validation,
    get_held_locks,
)


def demo_correct_ordering():
    """Demonstrate correct lock ordering (prosodic -> onnx)."""
    print('=' * 70)
    print('DEMO 1: Correct Lock Ordering (prosodic -> onnx)')
    print('=' * 70)

    with enable_lock_ordering_validation(True):
        print('\n✅ Acquiring _prosodic_model_lock (order=2)...')
        with _prosodic_model_lock:
            print(f'   Held locks: {get_held_locks()}')

            print('\n✅ Acquiring _onnx_session_lock (order=3)...')
            with _onnx_session_lock:
                print(f'   Held locks: {get_held_locks()}')
                print('\n✅ SUCCESS: Both locks acquired in correct order!')
                print('   This is the pattern used by load_prosodic_models()')

            print('\n✅ Released _onnx_session_lock')
            print(f'   Held locks: {get_held_locks()}')

        print('\n✅ Released _prosodic_model_lock')
        print(f'   Held locks: {get_held_locks()}')


def demo_incorrect_ordering():
    """Demonstrate incorrect lock ordering (onnx -> prosodic)."""
    print('\n\n')
    print('=' * 70)
    print('DEMO 2: Incorrect Lock Ordering (onnx -> prosodic)')
    print('=' * 70)

    with enable_lock_ordering_validation(True):
        print('\n⚠️  Acquiring _onnx_session_lock (order=3)...')
        with _onnx_session_lock:
            print(f'   Held locks: {get_held_locks()}')

            print('\n❌ Attempting to acquire _prosodic_model_lock (order=2)...')
            print('   This violates lock ordering (trying to go from 3 -> 2)!')

            try:
                with _prosodic_model_lock:
                    print('   This line should never execute!')
            except LockOrderingError as e:
                print('\n❌ LockOrderingError raised (as expected)!')
                print('\nError details:')
                print('-' * 70)
                print(str(e))
                print('-' * 70)


def demo_validation_disabled():
    """Demonstrate that validation can be disabled (production mode)."""
    print('\n\n')
    print('=' * 70)
    print('DEMO 3: Validation Disabled (Production Mode)')
    print('=' * 70)

    with enable_lock_ordering_validation(False):
        print('\n⚠️  Lock ordering validation is DISABLED')
        print('   (This is how it works in production: FLASK_DEBUG=0)')

        print('\n⚠️  Acquiring _onnx_session_lock (order=3)...')
        with _onnx_session_lock:
            print(f'   Held locks: {get_held_locks()} (empty - tracking disabled)')

            print('\n⚠️  Acquiring _prosodic_model_lock (order=2)...')
            with _prosodic_model_lock:
                print(f'   Held locks: {get_held_locks()} (empty - tracking disabled)')
                print('\n⚠️  No error raised - but this is still dangerous in real code!')
                print('   Validation is disabled for performance in production.')
                print('   Tests must ensure correct ordering to prevent deadlocks.')


def demo_thread_isolation():
    """Demonstrate that lock tracking is isolated per thread."""
    import threading

    print('\n\n')
    print('=' * 70)
    print('DEMO 4: Thread Isolation')
    print('=' * 70)

    results = {}

    def thread1_work():
        """Thread 1 acquires prosodic lock."""
        with enable_lock_ordering_validation(True):
            with _prosodic_model_lock:
                results['thread1'] = get_held_locks()

    def thread2_work():
        """Thread 2 acquires onnx lock."""
        with enable_lock_ordering_validation(True):
            with _onnx_session_lock:
                results['thread2'] = get_held_locks()

    print('\n🔄 Starting Thread 1 (acquires _prosodic_model_lock)...')
    t1 = threading.Thread(target=thread1_work)
    t1.start()

    print('🔄 Starting Thread 2 (acquires _onnx_session_lock)...')
    t2 = threading.Thread(target=thread2_work)
    t2.start()

    t1.join()
    t2.join()

    print('\n✅ Both threads completed successfully!')
    print(f'\n   Thread 1 held: {results["thread1"]}')
    print(f'   Thread 2 held: {results["thread2"]}')
    print('\n✅ Lock tracking is properly isolated per thread')


def main():
    """Run all demonstrations."""
    print('\n\n')
    print('*' * 70)
    print('*' + ' ' * 68 + '*')
    print('*' + '  LOCK ORDERING VALIDATION DEMONSTRATION'.center(68) + '*')
    print('*' + ' ' * 68 + '*')
    print('*' * 70)

    # Run demos
    demo_correct_ordering()
    demo_incorrect_ordering()
    demo_validation_disabled()
    demo_thread_isolation()

    # Summary
    print('\n\n')
    print('=' * 70)
    print('SUMMARY')
    print('=' * 70)
    print("""
Key Takeaways:

1. ✅ Lock ordering validation catches incorrect lock acquisition patterns
2. ✅ Correct pattern (prosodic -> onnx) always works
3. ❌ Incorrect patterns (onnx -> prosodic) raise LockOrderingError
4. ⚠️  Validation is disabled in production for performance
5. 🔄 Lock tracking is isolated per thread (no interference)

Best Practices:

- Always acquire locks in increasing order (1 -> 2 -> 3)
- Use context managers (with statements) for automatic release
- Test your lock ordering in unit tests
- Keep lock scope minimal

For more information, see: docs/LOCK_ORDERING.md
""")


if __name__ == '__main__':
    main()
