"""
Tests for text sanitization utilities.
"""

from text.sanitization import is_text_safe, sanitize_text


def test_sanitize_text_preserves_normal_text():
    """Sanitization should preserve normal text."""
    text = "This is a normal text with punctuation! And quotes: 'hello'"
    sanitized = sanitize_text(text)

    assert sanitized == text
    assert len(sanitized) == len(text)


def test_sanitize_text_preserves_emojis():
    """Sanitization should preserve emojis and special Unicode characters."""
    text = 'Hello 😀 world! 🌍 This is great 👍'
    sanitized = sanitize_text(text)

    assert sanitized == text
    assert '😀' in sanitized
    assert '🌍' in sanitized
    assert '👍' in sanitized


def test_sanitize_text_preserves_international_characters():
    """Sanitization should preserve international characters."""
    text = 'Café résumé naïve 北京 Москва'
    sanitized = sanitize_text(text)

    assert sanitized == text
    assert 'é' in sanitized
    assert '北京' in sanitized
    assert 'Москва' in sanitized


def test_sanitize_text_preserves_common_whitespace():
    """Sanitization should preserve common whitespace characters."""
    text = 'Line 1\nLine 2\tTabbed\r\nWindows'
    sanitized = sanitize_text(text)

    assert sanitized == text
    assert '\n' in sanitized
    assert '\t' in sanitized
    assert '\r' in sanitized


def test_sanitize_text_removes_null_bytes():
    """Sanitization should remove null bytes."""
    text = 'Hello\x00World'
    sanitized = sanitize_text(text)

    assert '\x00' not in sanitized
    assert sanitized == 'HelloWorld'


def test_sanitize_text_removes_control_characters():
    """Sanitization should remove control characters (except safe ones)."""
    # Bell character (not safe)
    text = 'Hello\x07World'
    sanitized = sanitize_text(text)

    assert '\x07' not in sanitized
    assert sanitized == 'HelloWorld'

    # Escape character (not safe)
    text = 'Hello\x1bWorld'
    sanitized = sanitize_text(text)

    assert '\x1b' not in sanitized
    assert sanitized == 'HelloWorld'


def test_sanitize_text_removes_zero_width_characters():
    """Sanitization should remove zero-width characters."""
    # Zero-width space
    text = 'Hello\u200bWorld'
    sanitized = sanitize_text(text)

    assert '\u200b' not in sanitized
    assert sanitized == 'HelloWorld'

    # Zero-width non-joiner
    text = 'Hello\u200cWorld'
    sanitized = sanitize_text(text)

    assert '\u200c' not in sanitized
    assert sanitized == 'HelloWorld'

    # Zero-width joiner
    text = 'Hello\u200dWorld'
    sanitized = sanitize_text(text)

    assert '\u200d' not in sanitized
    assert sanitized == 'HelloWorld'

    # BOM (zero-width no-break space)
    text = 'Hello\ufeffWorld'
    sanitized = sanitize_text(text)

    assert '\ufeff' not in sanitized
    assert sanitized == 'HelloWorld'


def test_sanitize_text_normalizes_unicode():
    """Sanitization should normalize Unicode to NFC."""
    # Create text with decomposed Unicode (e.g., é as e + combining accent)
    # U+0065 (e) + U+0301 (combining acute accent) = é
    decomposed = 'Cafe\u0301'  # é decomposed
    sanitized = sanitize_text(decomposed, normalize_unicode=True)

    # Should be normalized to NFC (é as single character)
    # U+00E9 = é (precomposed)
    assert '\u00e9' in sanitized or 'é' in sanitized
    # Length should be shorter (4 chars instead of 5)
    assert len(sanitized) == 4


def test_sanitize_text_without_normalization():
    """Sanitization should work without Unicode normalization if disabled."""
    decomposed = 'Cafe\u0301'
    sanitized = sanitize_text(decomposed, normalize_unicode=False)

    # Should preserve decomposed form
    assert '\u0301' in sanitized
    assert len(sanitized) == 5


def test_sanitize_text_handles_empty_string():
    """Sanitization should handle empty strings."""
    assert sanitize_text('') == ''
    assert sanitize_text('   ') == '   '  # Whitespace preserved


def test_sanitize_text_handles_non_string():
    """Sanitization should handle non-string input gracefully."""
    # Should return as-is for non-strings
    assert sanitize_text(None) is None
    assert sanitize_text(123) == 123


def test_is_text_safe_validates_safe_text():
    """is_text_safe should return True for safe text."""
    assert is_text_safe('Hello world') is True
    assert is_text_safe('Café 😀') is True
    assert is_text_safe('Line 1\nLine 2') is True


def test_is_text_safe_rejects_null_bytes():
    """is_text_safe should return False for text with null bytes."""
    assert is_text_safe('Hello\x00World') is False


def test_is_text_safe_rejects_excessive_control_chars():
    """is_text_safe should return False for excessive control characters."""
    # Create text with >10% control characters
    text = 'Hello' + '\x07' * 10  # 5 normal + 10 control = 15 total, 10/15 = 66%
    assert is_text_safe(text) is False


def test_is_text_safe_accepts_reasonable_control_chars():
    """is_text_safe should accept text with reasonable control characters."""
    # Text with <10% control characters should be fine
    text = 'Hello' * 10 + '\x07'  # 50 normal + 1 control = 51 total, 1/51 = 2%
    assert is_text_safe(text) is True


def test_sanitize_text_complex_example():
    """Sanitization should handle complex real-world examples."""
    # Text with various problematic characters
    text = 'Hello\x00World\x07Test\u200b\u200c\u200d\ufeff'
    sanitized = sanitize_text(text)

    # Should remove all problematic characters
    assert '\x00' not in sanitized
    assert '\x07' not in sanitized
    assert '\u200b' not in sanitized
    assert '\u200c' not in sanitized
    assert '\u200d' not in sanitized
    assert '\ufeff' not in sanitized

    # Should preserve legitimate text
    assert 'Hello' in sanitized
    assert 'World' in sanitized
    assert 'Test' in sanitized


def test_sanitize_text_preserves_quotes():
    """Sanitization should preserve quotes and punctuation."""
    text = '"Hello" \'world\' — dash'
    sanitized = sanitize_text(text)

    assert '"' in sanitized
    assert "'" in sanitized
    assert '—' in sanitized
    assert sanitized == text
