"""
Text sanitization utilities for input validation.

Security: Sanitizes user input to prevent issues with:
- Control characters that could cause problems
- Unicode normalization issues
- Potentially dangerous characters

Note: We preserve legitimate text including emojis, quotes, and special characters
that are part of natural language. We only remove truly problematic characters.
"""

import logging
import unicodedata

logger = logging.getLogger(__name__)

# Control characters to preserve (common whitespace)
PRESERVED_CONTROL_CHARS = {
    '\t',  # Tab
    '\n',  # Newline
    '\r',  # Carriage return
    ' ',  # Space (not a control char, but included for clarity)
}

# Control characters that are safe to preserve in text
# These are formatting characters that might appear in legitimate text
SAFE_CONTROL_CHARS = {
    '\x09',  # Tab
    '\x0a',  # Line feed
    '\x0d',  # Carriage return
}


def sanitize_text(
    text: str, normalize_unicode: bool = True, remove_control_chars: bool = True
) -> str:
    """
    Sanitize text input for safe processing.

    Performs:
    1. Unicode normalization (NFC) to ensure consistent representation
    2. Removal of control characters (except common whitespace)
    3. Removal of null bytes and other dangerous characters

    Args:
        text: Input text to sanitize.
        normalize_unicode: Whether to normalize Unicode (default: True).
        remove_control_chars: Whether to remove control characters (default: True).

    Returns:
        str: Sanitized text.

    Note:
        This function preserves legitimate text including:
        - Emojis and special Unicode characters
        - Quotes and punctuation
        - Common whitespace (space, tab, newline)
        - International characters

        It removes:
        - Null bytes (\x00)
        - Most control characters (except tab, newline, carriage return)
        - Zero-width characters that could be used for obfuscation
    """
    if not isinstance(text, str):
        return text

    # Step 1: Unicode normalization (NFC - Canonical Composition)
    # This ensures consistent representation of characters (e.g., é can be e+◌́ or é)
    if normalize_unicode:
        text = unicodedata.normalize('NFC', text)
        logger.debug('[SANITIZATION] Applied Unicode normalization (NFC)')

    # Step 2: Remove null bytes (always dangerous)
    if '\x00' in text:
        text = text.replace('\x00', '')
        logger.debug('[SANITIZATION] Removed null bytes')

    # Step 3: Remove control characters (except preserved ones)
    if remove_control_chars:
        sanitized_chars = []
        removed_count = 0

        for char in text:
            # Check if it's a control character
            if unicodedata.category(char).startswith('C'):
                # Control character - check if it should be preserved
                if char in SAFE_CONTROL_CHARS:
                    sanitized_chars.append(char)
                else:
                    # Remove this control character
                    removed_count += 1
                    logger.debug(f'[SANITIZATION] Removed control character: {repr(char)}')
            else:
                # Not a control character - keep it
                sanitized_chars.append(char)

        if removed_count > 0:
            logger.debug(f'[SANITIZATION] Removed {removed_count} control character(s)')
            text = ''.join(sanitized_chars)

    # Step 4: Remove zero-width characters that could be used for obfuscation
    # These are invisible characters that could hide malicious content
    zero_width_chars = [
        '\u200b',  # Zero-width space
        '\u200c',  # Zero-width non-joiner
        '\u200d',  # Zero-width joiner
        '\ufeff',  # Zero-width no-break space (BOM)
    ]
    for zw_char in zero_width_chars:
        if zw_char in text:
            text = text.replace(zw_char, '')
            logger.debug(f'[SANITIZATION] Removed zero-width character: {repr(zw_char)}')

    return text


def is_text_safe(text: str) -> bool:
    """
    Check if text contains potentially problematic characters.

    Args:
        text: Text to check.

    Returns:
        bool: True if text appears safe, False if it contains problematic characters.
    """
    if not isinstance(text, str):
        return False

    # Check for null bytes
    if '\x00' in text:
        return False

    # Check for excessive control characters (more than 10% of text)
    control_char_count = sum(
        1 for c in text if unicodedata.category(c).startswith('C') and c not in SAFE_CONTROL_CHARS
    )
    if len(text) > 0 and control_char_count / len(text) > 0.1:
        logger.warning(
            f'[SANITIZATION] Text contains excessive control characters: {control_char_count}/{len(text)}'
        )
        return False

    return True
