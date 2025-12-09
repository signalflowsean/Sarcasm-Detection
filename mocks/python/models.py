"""
Mock ML models for Python tests.
"""

import numpy as np


class MockLexicalModel:
    """Mock lexical model that returns predictable results."""

    def __init__(self, score: float = 0.75):
        """
        Args:
            score: The sarcasm probability to return (0-1)
        """
        self.score = score

    def predict_proba(self, texts):
        """Return mock probability array."""
        return np.array([[1 - self.score, self.score] for _ in texts])


class MockProsodicModel:
    """Mock prosodic model that returns predictable results."""

    def __init__(self, score: float = 0.65):
        """
        Args:
            score: The sarcasm probability to return (0-1)
        """
        self.score = score

    def predict_proba(self, embeddings):
        """Return mock probability array."""
        return np.array([[1 - self.score, self.score] for _ in range(len(embeddings))])


class MockWav2Vec2:
    """Mock Wav2Vec2 ONNX model for testing."""

    def __init__(self, embedding_dim: int = 768):
        """
        Args:
            embedding_dim: Dimension of output embeddings
        """
        self.embedding_dim = embedding_dim

    def run(self, output_names, input_feed):
        """Return mock embeddings."""
        input_values = input_feed.get("input_values", [[]])
        batch_size = len(input_values)
        # Return random embeddings
        embeddings = np.random.randn(batch_size, self.embedding_dim).astype(np.float32)
        return [embeddings]
