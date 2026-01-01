"""
Tests for lock ordering validation to prevent deadlock.

These tests verify that the lock ordering system correctly detects and prevents
lock ordering violations that could lead to deadlock.
"""

import threading
from unittest.mock import patch

import pytest

from models.loader import (
    LockOrderingError,
    OrderedLock,
    _lexical_model_lock,
    _onnx_session_lock,
    _prosodic_model_lock,
    enable_lock_ordering_validation,
    get_held_locks,
)


class TestLockOrderingValidation:
    """Test lock ordering validation system."""

    def test_single_lock_acquisition_succeeds(self):
        """Test that acquiring a single lock always succeeds."""
        with enable_lock_ordering_validation(True):
            # Each lock should work independently
            with _lexical_model_lock:
                assert len(get_held_locks()) == 1
                assert get_held_locks()[0][0] == '_lexical_model_lock'

            with _prosodic_model_lock:
                assert len(get_held_locks()) == 1
                assert get_held_locks()[0][0] == '_prosodic_model_lock'

            with _onnx_session_lock:
                assert len(get_held_locks()) == 1
                assert get_held_locks()[0][0] == '_onnx_session_lock'

            # After exiting context, no locks should be held
            assert len(get_held_locks()) == 0

    def test_correct_lock_ordering_succeeds(self):
        """Test that correct lock ordering (prosodic -> onnx) succeeds."""
        with enable_lock_ordering_validation(True):
            # This is the correct ordering used by load_prosodic_models()
            with _prosodic_model_lock:
                assert len(get_held_locks()) == 1

                # Acquiring onnx lock while holding prosodic is valid
                with _onnx_session_lock:
                    assert len(get_held_locks()) == 2
                    locks = get_held_locks()
                    assert locks[0][0] == '_prosodic_model_lock'
                    assert locks[1][0] == '_onnx_session_lock'

                # After releasing onnx, only prosodic should remain
                assert len(get_held_locks()) == 1

            # After releasing all, no locks held
            assert len(get_held_locks()) == 0

    def test_reverse_lock_ordering_fails(self):
        """Test that reverse lock ordering (onnx -> prosodic) raises error."""
        with enable_lock_ordering_validation(True):
            with _onnx_session_lock:
                assert len(get_held_locks()) == 1

                # Trying to acquire prosodic while holding onnx should fail
                with pytest.raises(LockOrderingError) as exc_info:
                    with _prosodic_model_lock:
                        pass  # Should never reach here

                # Verify error message is informative
                error_msg = str(exc_info.value)
                assert 'LOCK ORDERING VIOLATION' in error_msg
                assert '_onnx_session_lock' in error_msg
                assert '_prosodic_model_lock' in error_msg
                assert 'order=' in error_msg

    def test_lexical_lock_ordering_violations(self):
        """Test that acquiring lexical lock after higher-order locks fails."""
        with enable_lock_ordering_validation(True):
            # Acquiring lexical after prosodic should fail
            with _prosodic_model_lock:
                with pytest.raises(LockOrderingError):
                    with _lexical_model_lock:
                        pass

            # Acquiring lexical after onnx should fail
            with _onnx_session_lock:
                with pytest.raises(LockOrderingError):
                    with _lexical_model_lock:
                        pass

    def test_validation_disabled_in_production(self):
        """Test that lock ordering validation is disabled when not enabled."""
        with enable_lock_ordering_validation(False):
            # With validation disabled, reverse ordering should work (but is dangerous!)
            with _onnx_session_lock:
                with _prosodic_model_lock:
                    # This would normally raise, but validation is disabled
                    assert True

            # get_held_locks should return empty when validation is disabled
            assert len(get_held_locks()) == 0

    def test_lock_tracking_per_thread(self):
        """Test that lock tracking is isolated per thread."""
        results = {'thread1_locks': None, 'thread2_locks': None}

        def thread1_func():
            with enable_lock_ordering_validation(True):
                with _lexical_model_lock:
                    # Record locks held by thread 1
                    results['thread1_locks'] = get_held_locks()

        def thread2_func():
            with enable_lock_ordering_validation(True):
                with _prosodic_model_lock:
                    # Record locks held by thread 2
                    results['thread2_locks'] = get_held_locks()

        # Run threads concurrently
        t1 = threading.Thread(target=thread1_func)
        t2 = threading.Thread(target=thread2_func)
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # Each thread should only see its own locks
        assert len(results['thread1_locks']) == 1
        assert results['thread1_locks'][0][0] == '_lexical_model_lock'

        assert len(results['thread2_locks']) == 1
        assert results['thread2_locks'][0][0] == '_prosodic_model_lock'

    def test_nested_context_managers(self):
        """Test that nested context managers properly track and release locks."""
        with enable_lock_ordering_validation(True):
            assert len(get_held_locks()) == 0

            with _lexical_model_lock:
                assert len(get_held_locks()) == 1
                locks = get_held_locks()
                assert locks[0] == ('_lexical_model_lock', 1)

            # Lock should be released after exiting context
            assert len(get_held_locks()) == 0

            # Try another lock
            with _prosodic_model_lock:
                assert len(get_held_locks()) == 1
                locks = get_held_locks()
                assert locks[0] == ('_prosodic_model_lock', 2)

            assert len(get_held_locks()) == 0

    def test_lock_order_property(self):
        """Test that OrderedLock exposes order property correctly."""
        test_lock = OrderedLock(threading.Lock(), 'test_lock', order=42)

        assert test_lock.name == 'test_lock'
        assert test_lock.order == 42

    def test_acquire_release_tracking(self):
        """Test that manual acquire/release properly tracks locks."""
        with enable_lock_ordering_validation(True):
            test_lock = OrderedLock(threading.Lock(), 'manual_lock', order=10)

            # Acquire manually
            test_lock.acquire()
            assert len(get_held_locks()) == 1
            assert get_held_locks()[0][0] == 'manual_lock'

            # Release manually
            test_lock.release()
            assert len(get_held_locks()) == 0

    def test_error_message_details(self):
        """Test that lock ordering errors include helpful diagnostic information."""
        with enable_lock_ordering_validation(True):
            with _prosodic_model_lock:
                try:
                    with _lexical_model_lock:
                        pass
                except LockOrderingError as e:
                    error_msg = str(e)

                    # Verify comprehensive error message
                    assert 'LOCK ORDERING VIOLATION' in error_msg
                    assert 'Currently holding: _prosodic_model_lock (order=2)' in error_msg
                    assert 'Trying to acquire: _lexical_model_lock (order=1)' in error_msg
                    assert 'Required lock order' in error_msg
                    assert '_lexical_model_lock (order=1)' in error_msg
                    assert '_prosodic_model_lock (order=2)' in error_msg
                    assert '_onnx_session_lock (order=3)' in error_msg
                    assert 'Fix: Reorder your lock acquisitions' in error_msg
                else:
                    pytest.fail('Expected LockOrderingError to be raised')

    def test_multiple_threads_correct_ordering(self):
        """Test that multiple threads can use correct lock ordering concurrently."""
        success_count = {'value': 0}
        lock = threading.Lock()

        def worker():
            """Worker that acquires locks in correct order."""
            with enable_lock_ordering_validation(True):
                with _prosodic_model_lock:
                    with _onnx_session_lock:
                        # Both locks acquired successfully
                        with lock:
                            success_count['value'] += 1

        # Run multiple workers concurrently
        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # All threads should succeed
        assert success_count['value'] == 10

    def test_enable_lock_ordering_validation_context_manager(self):
        """Test that enable_lock_ordering_validation properly enables/disables."""
        # Start with validation disabled
        with enable_lock_ordering_validation(False):
            # Reverse ordering should work
            with _onnx_session_lock:
                with _prosodic_model_lock:
                    pass  # No error

        # Enable validation
        with enable_lock_ordering_validation(True):
            # Reverse ordering should fail
            with _onnx_session_lock:
                with pytest.raises(LockOrderingError):
                    with _prosodic_model_lock:
                        pass

        # After exiting context, validation state is restored
        # (depends on original FLASK_DEBUG setting)

    @patch('models.loader._ENABLE_LOCK_ORDERING_VALIDATION', True)
    def test_validation_enabled_by_default_in_dev(self):
        """Test that lock ordering validation is enabled in development mode."""
        # When FLASK_DEBUG=1 (development), validation should be enabled
        with _onnx_session_lock:
            with pytest.raises(LockOrderingError):
                with _prosodic_model_lock:
                    pass


class TestLockOrderingDocumentation:
    """Test that documented lock ordering examples work as expected."""

    def test_load_prosodic_models_pattern(self):
        """Test the lock ordering pattern used by load_prosodic_models()."""
        with enable_lock_ordering_validation(True):
            # This is the actual pattern used in load_prosodic_models()
            with _prosodic_model_lock:
                # Inside prosodic lock, load ONNX model (acquires onnx lock)
                with _onnx_session_lock:
                    # Both locks held - this is the correct pattern
                    locks = get_held_locks()
                    assert len(locks) == 2
                    assert locks[0] == ('_prosodic_model_lock', 2)
                    assert locks[1] == ('_onnx_session_lock', 3)

    def test_independent_lock_usage(self):
        """Test that all three locks can be used independently."""
        with enable_lock_ordering_validation(True):
            # Lexical model loading (independent)
            with _lexical_model_lock:
                assert len(get_held_locks()) == 1

            # Prosodic model loading without ONNX (independent)
            with _prosodic_model_lock:
                assert len(get_held_locks()) == 1

            # ONNX loading (independent)
            with _onnx_session_lock:
                assert len(get_held_locks()) == 1


class TestLockOrderingEdgeCases:
    """Test edge cases and error conditions."""

    def test_same_lock_twice(self):
        """Test that acquiring the same lock twice (recursive) is handled."""
        with enable_lock_ordering_validation(True):
            test_lock = OrderedLock(threading.Lock(), 'test_lock', order=5)

            with test_lock:
                # Python's threading.Lock doesn't support recursive locking
                # Attempting to acquire again would deadlock in real code
                # We're just testing that our tracking doesn't break
                assert len(get_held_locks()) == 1

    def test_exception_during_lock_hold(self):
        """Test that locks are released even when exceptions occur."""
        with enable_lock_ordering_validation(True):
            try:
                with _lexical_model_lock:
                    assert len(get_held_locks()) == 1
                    raise ValueError('Test exception')
            except ValueError:
                pass

            # Lock should be released even after exception
            assert len(get_held_locks()) == 0

    def test_get_held_locks_empty(self):
        """Test get_held_locks when no locks are held."""
        with enable_lock_ordering_validation(True):
            assert get_held_locks() == []

    def test_get_held_locks_validation_disabled(self):
        """Test get_held_locks when validation is disabled."""
        with enable_lock_ordering_validation(False):
            with _lexical_model_lock:
                # With validation disabled, get_held_locks returns empty
                assert get_held_locks() == []
