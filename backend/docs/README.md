# Backend Documentation

This directory contains technical documentation for the Sarcasm Detection backend.

## Lock Ordering Validation

Documentation for the lock ordering validation system that prevents deadlock bugs:

### 📖 [LOCK_ORDERING.md](LOCK_ORDERING.md)

Comprehensive guide covering:

- The deadlock problem and solution
- Lock hierarchy and ordering rules
- Valid and invalid lock acquisition patterns
- Implementation details
- Debugging and troubleshooting
- Best practices
- Testing guidelines

### 📊 [LOCK_ORDERING_SUMMARY.md](LOCK_ORDERING_SUMMARY.md)

Quick reference summary:

- Problem statement
- Solution overview
- Key components
- Files modified/created
- Test results
- Example usage
- Benefits and technical details

### 🎮 [lock_ordering_demo.py](lock_ordering_demo.py)

Interactive demonstration script:

```bash
python docs/lock_ordering_demo.py
```

Shows:

- ✅ Correct lock ordering (prosodic → onnx)
- ❌ Incorrect lock ordering with error message
- ⚙️ Validation disabled in production mode
- 🔄 Thread isolation

## Quick Start

### Understanding Lock Ordering

The system enforces this lock acquisition order:

```
1. _lexical_model_lock (order=1)
2. _prosodic_model_lock (order=2)
3. _onnx_session_lock (order=3)
```

**Always acquire locks in increasing order (lower numbers first).**

### Valid Pattern ✅

```python
with _prosodic_model_lock:  # order=2
    with _onnx_session_lock:  # order=3
        # Safe - increasing order
        pass
```

### Invalid Pattern ❌

```python
with _onnx_session_lock:  # order=3
    with _prosodic_model_lock:  # order=2
        # ERROR - decreasing order causes deadlock risk!
        pass
```

## Running Tests

### Lock Ordering Tests

```bash
cd backend
pytest tests/test_lock_ordering.py -v
```

### All Model Loading Tests

```bash
cd backend
pytest tests/test_lexical.py tests/test_prosodic.py tests/test_lock_ordering.py -v
```

## Key Features

- **Automatic Detection**: Catches lock ordering violations at runtime (dev mode)
- **Zero Overhead**: Validation disabled in production for performance
- **Clear Errors**: Detailed error messages explain violations
- **Thread Safe**: Per-thread tracking prevents interference
- **Well Tested**: 19 comprehensive tests covering all scenarios

## Development Workflow

1. **Write code** using locks as normal
2. **Run tests** - violations caught automatically
3. **Fix ordering** if LockOrderingError raised
4. **Deploy** - validation automatically disabled in production

## When to Read These Docs

- 📖 **Adding new locks**: Read LOCK_ORDERING.md to understand hierarchy
- 🐛 **Debugging LockOrderingError**: Check error message, refer to guide
- 🔍 **Understanding the system**: Run lock_ordering_demo.py
- 📊 **Quick reference**: Check LOCK_ORDERING_SUMMARY.md

## Additional Resources

- Python threading: https://docs.python.org/3/library/threading.html
- Deadlock prevention: https://en.wikipedia.org/wiki/Deadlock
- Flask thread safety: https://flask.palletsprojects.com/en/2.3.x/design/

## Questions?

See the comprehensive documentation in [LOCK_ORDERING.md](LOCK_ORDERING.md) or run the demo script for an interactive explanation.
