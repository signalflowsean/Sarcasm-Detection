"""
Audio mock utilities for Python tests.
Generates valid WAV/MP3 files for testing audio processing.
"""

import io
import math
from pathlib import Path


def create_mock_wav(
    sample_rate: int = 16000,
    duration: float = 0.1,
    frequency: float = 440,
    amplitude: float = 0.3,
) -> io.BytesIO:
    """
    Create a valid WAV file for testing.

    Args:
        sample_rate: Sample rate in Hz (default: 16000 for Wav2Vec2)
        duration: Duration in seconds
        frequency: Tone frequency in Hz (0 for silence)
        amplitude: Volume from 0-1

    Returns:
        BytesIO containing the WAV file
    """
    num_samples = int(sample_rate * duration)
    bits_per_sample = 16
    num_channels = 1

    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8
    data_size = num_samples * block_align

    # Build header
    header = bytearray()

    # RIFF header
    header.extend(b"RIFF")
    header.extend((36 + data_size).to_bytes(4, "little"))
    header.extend(b"WAVE")

    # fmt subchunk
    header.extend(b"fmt ")
    header.extend((16).to_bytes(4, "little"))  # Subchunk size
    header.extend((1).to_bytes(2, "little"))  # Audio format (PCM)
    header.extend(num_channels.to_bytes(2, "little"))
    header.extend(sample_rate.to_bytes(4, "little"))
    header.extend(byte_rate.to_bytes(4, "little"))
    header.extend(block_align.to_bytes(2, "little"))
    header.extend(bits_per_sample.to_bytes(2, "little"))

    # data subchunk
    header.extend(b"data")
    header.extend(data_size.to_bytes(4, "little"))

    # Generate audio samples
    audio_data = bytearray()
    for i in range(num_samples):
        if frequency > 0:
            t = i / sample_rate
            sample = int(math.sin(2 * math.pi * frequency * t) * amplitude * 32767)
        else:
            sample = 0
        audio_data.extend(sample.to_bytes(2, "little", signed=True))

    return io.BytesIO(bytes(header) + bytes(audio_data))


def create_mock_mp3() -> io.BytesIO:
    """
    Create a minimal MP3-like file with ID3 header for testing.
    Note: This isn't a valid playable MP3, but passes magic byte validation.
    """
    header = b"ID3"
    header += b"\x04\x00"  # Version 2.4
    header += b"\x00"  # Flags
    header += b"\x00\x00\x00\x00"  # Size (0)

    # Add padding
    return io.BytesIO(header + b"\x00" * 1000)


def create_invalid_audio() -> io.BytesIO:
    """Create invalid audio file (just random bytes)."""
    return io.BytesIO(b"not audio data at all")


def create_empty_file() -> io.BytesIO:
    """Create empty file."""
    return io.BytesIO(b"")


def load_test_audio_fixture() -> io.BytesIO:
    """
    Load the shared test audio fixture from disk.
    Falls back to generating audio if fixture doesn't exist.
    """
    fixture_path = Path(__file__).parent.parent / "fixtures" / "test-audio.wav"
    if fixture_path.exists():
        return io.BytesIO(fixture_path.read_bytes())
    return create_mock_wav(duration=1.0)
