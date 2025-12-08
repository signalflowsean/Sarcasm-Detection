"""
Mock objects for testing.
Centralized location for all test mocks to keep tests clean.
"""

import io


def create_mock_wav_audio() -> io.BytesIO:
    """
    Create a minimal valid WAV file for testing.
    This is a tiny but valid WAV header with silence.
    """
    # WAV file format:
    # - RIFF header (4 bytes)
    # - File size minus 8 (4 bytes)
    # - WAVE (4 bytes)
    # - fmt chunk (24 bytes)
    # - data chunk header + data
    
    sample_rate = 16000
    num_samples = 1600  # 0.1 seconds
    bits_per_sample = 16
    num_channels = 1
    
    # Calculate sizes
    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8
    data_size = num_samples * block_align
    
    # Build header
    header = bytearray()
    
    # RIFF header
    header.extend(b'RIFF')
    header.extend((36 + data_size).to_bytes(4, 'little'))
    header.extend(b'WAVE')
    
    # fmt subchunk
    header.extend(b'fmt ')
    header.extend((16).to_bytes(4, 'little'))  # Subchunk size
    header.extend((1).to_bytes(2, 'little'))   # Audio format (PCM)
    header.extend(num_channels.to_bytes(2, 'little'))
    header.extend(sample_rate.to_bytes(4, 'little'))
    header.extend(byte_rate.to_bytes(4, 'little'))
    header.extend(block_align.to_bytes(2, 'little'))
    header.extend(bits_per_sample.to_bytes(2, 'little'))
    
    # data subchunk
    header.extend(b'data')
    header.extend(data_size.to_bytes(4, 'little'))
    
    # Silent audio data
    audio_data = bytes(data_size)
    
    return io.BytesIO(bytes(header) + audio_data)


def create_mock_mp3_audio() -> io.BytesIO:
    """
    Create a minimal MP3-like file with ID3 header for testing.
    Note: This isn't a valid playable MP3, but passes magic byte validation.
    """
    # ID3v2 header
    header = b'ID3'
    header += b'\x04\x00'  # Version 2.4
    header += b'\x00'      # Flags
    header += b'\x00\x00\x00\x00'  # Size (0)
    
    # Add some padding to make it larger
    return io.BytesIO(header + b'\x00' * 1000)


def create_invalid_audio() -> io.BytesIO:
    """Create invalid audio file (just random bytes)."""
    return io.BytesIO(b'not audio data at all')


def create_empty_file() -> io.BytesIO:
    """Create empty file."""
    return io.BytesIO(b'')


class MockLexicalModel:
    """Mock lexical model that returns predictable results."""
    
    def __init__(self, score: float = 0.75):
        self.score = score
    
    def predict_proba(self, texts):
        """Return mock probability array."""
        import numpy as np
        return np.array([[1 - self.score, self.score] for _ in texts])


class MockProsodicModel:
    """Mock prosodic model that returns predictable results."""
    
    def __init__(self, score: float = 0.65):
        self.score = score
    
    def predict_proba(self, embeddings):
        """Return mock probability array."""
        import numpy as np
        return np.array([[1 - self.score, self.score] for _ in range(len(embeddings))])

