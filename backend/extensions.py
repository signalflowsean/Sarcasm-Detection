"""
Flask extensions initialization.
Separates extension instantiation from app creation to avoid circular imports.
"""

import logging
import re

from flask import request
from flask_limiter import Limiter

from config import (
    RATE_LIMIT_DEFAULT,
    RATE_LIMIT_ENABLED,
    RATE_LIMIT_STORAGE,
)

logger = logging.getLogger(__name__)

# ============================================================================
# Rate Limiting Key Function
# ============================================================================


def _is_valid_ip(ip: str) -> bool:
    """
    Basic IP address validation.
    Checks if string looks like a valid IPv4 or IPv6 address.

    Args:
        ip: IP address string to validate

    Returns:
        True if IP appears valid, False otherwise
    """
    if not ip or not isinstance(ip, str):
        return False

    # IPv4 pattern: 1-3 digits per octet, 4 octets separated by dots
    ipv4_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
    # IPv6 pattern: simplified check (allows compressed notation)
    ipv6_pattern = r'^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$'

    if re.match(ipv4_pattern, ip):
        # Validate each octet is 0-255
        try:
            octets = ip.split('.')
            return all(0 <= int(octet) <= 255 for octet in octets)
        except ValueError:
            return False
    elif re.match(ipv6_pattern, ip) or ip == '::1':  # Allow localhost IPv6
        return True

    return False


def get_rate_limit_key():
    """
    Get rate limiting key (client IP) accounting for proxy environments.

    Security: When behind a trusted proxy (Railway, nginx), the proxy sets
    X-Forwarded-For with the original client IP as the first entry. We use
    the first IP in the chain to prevent spoofing attacks.

    Priority:
    1. X-Forwarded-For header (first IP in chain) - for trusted proxies
    2. X-Real-IP header - alternative proxy header (nginx)
    3. request.remote_addr - direct connection (development)

    Returns:
        str: Client IP address for rate limiting
    """
    # Check X-Forwarded-For header (used by Railway, nginx, and other proxies)
    forwarded_for = request.headers.get('X-Forwarded-For')
    if forwarded_for:
        # X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
        # The first IP is the original client (trusted proxy adds its own IP)
        first_ip = forwarded_for.split(',')[0].strip()
        if _is_valid_ip(first_ip):
            logger.debug(f'[RATE LIMIT] Using X-Forwarded-For IP: {first_ip}')
            return first_ip
        else:
            logger.warning(f'[RATE LIMIT] Invalid IP in X-Forwarded-For: {first_ip}')

    # Check X-Real-IP header (alternative proxy header, used by nginx)
    real_ip = request.headers.get('X-Real-IP')
    if real_ip:
        real_ip = real_ip.strip()
        if _is_valid_ip(real_ip):
            logger.debug(f'[RATE LIMIT] Using X-Real-IP: {real_ip}')
            return real_ip
        else:
            logger.warning(f'[RATE LIMIT] Invalid IP in X-Real-IP: {real_ip}')

    # Fallback to direct connection IP (development or no proxy)
    remote_addr = request.remote_addr or 'unknown'
    logger.debug(f'[RATE LIMIT] Using remote_addr: {remote_addr}')
    return remote_addr


# ============================================================================
# Rate Limiter
# ============================================================================
# Protects against abuse - ML inference is computationally expensive.
# Initialized without app, will be attached in create_app() via init_app().

limiter = Limiter(
    key_func=get_rate_limit_key,
    default_limits=[RATE_LIMIT_DEFAULT] if RATE_LIMIT_ENABLED else [],
    storage_uri=RATE_LIMIT_STORAGE,
    strategy='moving-window',  # Prevents burst attacks at window boundaries
)
