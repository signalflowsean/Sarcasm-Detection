# Lock Ordering Validation

## Overview

The lock ordering validation system prevents deadlock bugs by ensuring that locks are always acquired in a consistent order. This is critical in multi-threaded environments like Flask/Gunicorn where concurrent requests could trigger simultaneous model loading.

## The Deadlock Problem

**Deadlock** occurs when two threads wait for each other's locks indefinitely:

```
Thread 1:                Thread 2:
- Acquires Lock A        - Acquires Lock B
- Waits for Lock B       - Waits for Lock A
  (blocked forever)        (blocked forever)
```

This is prevented by ensuring all threads acquire locks in the same order.

## Lock Hierarchy

Our system enforces this lock ordering:

```
1. _lexical_model_lock (order=1, lowest priority)
2. _prosodic_model_lock (order=2, medium priority)
3. _onnx_session_lock (order=3, highest priority)
```

### Valid Lock Acquisition Patterns

✅ **Single Lock** (always safe):

```python
with _lexical_model_lock:
    # Load lexical model
    pass
```

✅ **Nested Locks in Correct Order**:

```python
with _prosodic_model_lock:  # Acquire lower-order lock first
    with _onnx_session_lock:  # Then higher-order lock
        # Both prosodic and onnx resources
        pass
```

### Invalid Patterns (Will Raise LockOrderingError)

❌ **Reverse Order** (deadlock risk):

```python
with _onnx_session_lock:  # Higher-order lock first
    with _prosodic_model_lock:  # Then lower-order lock - ERROR!
        pass
```

❌ **Out of Order Nesting**:

```python
with _prosodic_model_lock:
    with _lexical_model_lock:  # Lower order than prosodic - ERROR!
        pass
```

## Implementation

### OrderedLock Class

Locks are wrapped in `OrderedLock` objects that track acquisitions:

```python
class OrderedLock:
    def __init__(self, lock: threading.Lock, name: str, order: int):
        self._lock = lock
        self._name = name
        self._order = order
```

### Thread-Local Tracking

Each thread maintains its own list of held locks using `threading.local()`:

```python
_thread_local = threading.local()
_thread_local.held_locks = [lock1, lock2, ...]
```

### Validation Logic

When acquiring a lock:

1. Check all currently held locks
2. If any held lock has a higher order number than the lock being acquired, raise `LockOrderingError`
3. Otherwise, acquire the lock and add it to the held locks list

```python
def _validate_lock_order(self):
    held_locks = self._get_held_locks()

    for held_lock in held_locks:
        if held_lock._order > self._order:
            raise LockOrderingError(f"...")
```

## Production vs Development

- **Development** (`FLASK_ENV != 'production'`): Validation is **enabled**
  - Lock ordering violations raise `LockOrderingError` immediately
  - Helps catch bugs during development and testing
- **Production** (`FLASK_ENV == 'production'`): Validation is **disabled**
  - No runtime overhead from tracking and validation
  - Relies on tests to ensure correct ordering

## Debugging Lock Ordering Issues

### Error Message

When a violation is detected, you'll see:

```
============================================================
LOCK ORDERING VIOLATION DETECTED
============================================================
Attempting to acquire locks in wrong order!

Currently holding: _onnx_session_lock (order=3)
Trying to acquire: _prosodic_model_lock (order=2)

This violates the required lock ordering and can cause deadlock.

Required lock order (lowest to highest):
  1. _lexical_model_lock (order=1)
  2. _prosodic_model_lock (order=2)
  3. _onnx_session_lock (order=3)

Fix: Reorder your lock acquisitions to follow this hierarchy.
============================================================
```

### Inspecting Held Locks

Use `get_held_locks()` to see what locks the current thread holds:

```python
from models.loader import get_held_locks

with _prosodic_model_lock:
    print(get_held_locks())
    # Output: [('_prosodic_model_lock', 2)]

    with _onnx_session_lock:
        print(get_held_locks())
        # Output: [('_prosodic_model_lock', 2), ('_onnx_session_lock', 3)]
```

### Testing Lock Ordering

Use the `enable_lock_ordering_validation()` context manager in tests:

```python
from models.loader import enable_lock_ordering_validation

def test_my_lock_ordering():
    with enable_lock_ordering_validation(True):
        # This will raise if locks are acquired in wrong order
        with _prosodic_model_lock:
            with _onnx_session_lock:
                pass  # OK
```

## Common Patterns

### Loading Prosodic Models

The most common nested lock pattern:

```python
def load_prosodic_models() -> bool:
    with _prosodic_model_lock:
        # Load ONNX encoder (acquires _onnx_session_lock internally)
        if not load_onnx_model():
            return False

        # Load prosodic classifier
        model = secure_load_pickle(PROSODIC_MODEL_PATH)
        _prosodic_model = model
        return True
```

This is safe because:

1. We acquire `_prosodic_model_lock` first (order=2)
2. `load_onnx_model()` acquires `_onnx_session_lock` (order=3)
3. Order 2 → 3 is valid (increasing order)

### Loading Models Independently

Each model can be loaded independently without nesting:

```python
# Lexical model (independent)
with _lexical_model_lock:
    _lexical_model = secure_load_pickle(LEXICAL_MODEL_PATH)

# Prosodic model (independent)
with _prosodic_model_lock:
    _prosodic_model = secure_load_pickle(PROSODIC_MODEL_PATH)

# ONNX model (independent)
with _onnx_session_lock:
    _onnx_session = ort.InferenceSession(ONNX_MODEL_PATH)
```

## Adding New Locks

If you need to add a new lock to the system:

1. **Assign an order number** based on where it fits in the hierarchy
2. **Create an OrderedLock**:
   ```python
   _new_lock = OrderedLock(threading.Lock(), '_new_lock', order=4)
   ```
3. **Update documentation** with the new lock order
4. **Add tests** to verify the ordering is enforced

### Choosing an Order Number

- Lower numbers are acquired first
- Higher numbers are acquired after lower numbers
- If lock A must be held when acquiring lock B, then `order(A) < order(B)`

Example: If you need a lock for a model that depends on ONNX:

```python
_dependent_lock = OrderedLock(threading.Lock(), '_dependent_lock', order=4)

# Usage:
with _onnx_session_lock:  # order=3
    with _dependent_lock:  # order=4 - OK!
        pass
```

## Best Practices

1. **Always use context managers** (`with` statements) for automatic release
2. **Minimize lock scope** - hold locks for as short a time as possible
3. **Never call blocking operations** while holding a lock
4. **Test lock ordering** in your unit tests
5. **Document lock dependencies** when adding new locks
6. **Keep the hierarchy simple** - avoid deep nesting

## Performance Impact

### Development Mode

- Minimal overhead from validation (~microseconds per lock operation)
- Tracking held locks uses thread-local storage (no contention between threads)
- Worth the cost for early bug detection

### Production Mode

- **Zero overhead** - validation is completely disabled
- OrderedLock degrades to a simple wrapper around threading.Lock
- No performance difference from raw locks

## Testing

See `tests/test_lock_ordering.py` for comprehensive tests:

- ✅ Single lock acquisition
- ✅ Correct ordering (prosodic → onnx)
- ✅ Reverse ordering detection (onnx → prosodic)
- ✅ Thread isolation
- ✅ Exception handling
- ✅ Production mode (validation disabled)
- ✅ Error message clarity
- ✅ Multiple threads with correct ordering

Run lock ordering tests:

```bash
pytest tests/test_lock_ordering.py -v
```

## References

- [Lock Ordering and Deadlock Prevention](https://en.wikipedia.org/wiki/Deadlock#Deadlock_prevention)
- [Python threading.Lock documentation](https://docs.python.org/3/library/threading.html#lock-objects)
- [Flask Thread Safety](https://flask.palletsprojects.com/en/2.3.x/design/#thread-locals)

## Future Enhancements

Potential improvements to the system:

1. **Lock cycle detection** - Use graph algorithms to detect potential deadlock cycles
2. **Lock hold time tracking** - Measure how long locks are held to identify bottlenecks
3. **Automatic lock ordering** - Infer optimal lock ordering from usage patterns
4. **Lock contention metrics** - Track how often threads wait for locks
