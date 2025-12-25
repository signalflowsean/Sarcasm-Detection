"""
Flask extensions initialization.
Separates extension instantiation from app creation to avoid circular imports.
"""

import ipaddress
import logging
import re

from flask import request
from flask_limiter import Limiter

from config import (
    RATE_LIMIT_DEFAULT,
    RATE_LIMIT_ENABLED,
    RATE_LIMIT_STORAGE,
    TRUSTED_PROXY_IPS,
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


def _is_trusted_proxy(ip: str) -> bool:
    """
    Check if an IP address is from a trusted proxy.

    Security: Only trust X-Forwarded-For headers if the request comes from
    a trusted proxy IP. This prevents header spoofing attacks.

    Args:
        ip: IP address to check

    Returns:
        True if IP is from a trusted proxy, False otherwise
    """
    if not ip:
        return False

    try:
        client_ip = ipaddress.ip_address(ip)
    except ValueError:
        return False

    for trusted_range in TRUSTED_PROXY_IPS:
        trusted_range = trusted_range.strip()
        if not trusted_range:
            continue

        try:
            # Try as CIDR range first
            if '/' in trusted_range:
                network = ipaddress.ip_network(trusted_range, strict=False)
                if client_ip in network:
                    return True
            else:
                # Single IP address
                trusted_ip = ipaddress.ip_address(trusted_range)
                if client_ip == trusted_ip:
                    return True
        except ValueError:
            # Invalid IP/CIDR in config - log and continue
            logger.warning(f'[RATE LIMIT] Invalid trusted proxy IP/CIDR in config: {trusted_range}')

    return False


def get_rate_limit_key():
    """
    Get rate limiting key (client IP) accounting for proxy environments.

    Security: When behind a trusted proxy (Railway, nginx), the proxy sets
    X-Forwarded-For with the original client IP as the first entry. We only
    trust these headers if the request comes from a trusted proxy IP to prevent
    spoofing attacks.

    Priority:
    1. X-Forwarded-For header (first IP in chain) - ONLY if from trusted proxy
    2. X-Real-IP header - ONLY if from trusted proxy
    3. request.remote_addr - direct connection (fallback)

    Returns:
        str: Client IP address for rate limiting
    """
    remote_addr = request.remote_addr
    # SECURITY: Never use 'unknown' as fallback - this allows rate limit bypass
    # If remote_addr is None/empty, use a shared rate limit key based on endpoint
    # This prevents unlimited requests by generating unique UUIDs per request
    # Instead, group by endpoint path to apply rate limits even without IP
    if not remote_addr:
        # Use endpoint path as rate limit key (all requests to same endpoint share limit)
        # This prevents rate limit bypass while still applying limits to requests without IP
        endpoint_key = f'no-ip-{request.path}'
        logger.warning(
            f'[RATE LIMIT SECURITY] Request has no remote_addr, using endpoint-based key: {endpoint_key}'
        )
        return endpoint_key

    is_from_trusted_proxy = _is_trusted_proxy(remote_addr)

    # Only trust X-Forwarded-For if request comes from trusted proxy
    # This prevents attackers from spoofing the header to bypass rate limits
    if is_from_trusted_proxy:
        # Check X-Forwarded-For header (used by Railway, nginx, and other proxies)
        forwarded_for = request.headers.get('X-Forwarded-For')
        if forwarded_for:
            # X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
            # The first IP is the original client (trusted proxy adds its own IP)
            first_ip = forwarded_for.split(',')[0].strip()
            if _is_valid_ip(first_ip):
                logger.debug(
                    f'[RATE LIMIT] Using X-Forwarded-For IP: {first_ip} (from trusted proxy: {remote_addr})'
                )
                return first_ip
            else:
                logger.warning(f'[RATE LIMIT] Invalid IP in X-Forwarded-For: {first_ip}')

        # Check X-Real-IP header (alternative proxy header, used by nginx)
        real_ip = request.headers.get('X-Real-IP')
        if real_ip:
            real_ip = real_ip.strip()
            if _is_valid_ip(real_ip):
                logger.debug(
                    f'[RATE LIMIT] Using X-Real-IP: {real_ip} (from trusted proxy: {remote_addr})'
                )
                return real_ip
            else:
                logger.warning(f'[RATE LIMIT] Invalid IP in X-Real-IP: {real_ip}')
    else:
        # Request not from trusted proxy - ignore X-Forwarded-For to prevent spoofing
        if request.headers.get('X-Forwarded-For') or request.headers.get('X-Real-IP'):
            logger.warning(
                f'[RATE LIMIT SECURITY] Ignoring X-Forwarded-For/X-Real-IP headers from untrusted source: {remote_addr}. '
                'Set TRUSTED_PROXY_IPS environment variable to trust proxy headers.'
            )

    # Fallback to direct connection IP (development or no proxy)
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
