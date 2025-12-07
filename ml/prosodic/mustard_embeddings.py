"""
Wav2Vec2 Embedding Extraction Script

Extracts embeddings from audio files using facebook/wav2vec2-base-960h.
These embeddings serve as input features for the classical ML classifier.

Usage:
    python mustard_embeddings.py

Prerequisites:
    - mustard_prepare.py must be run first to extract audio
    - torch, torchaudio, transformers installed
"""

import numpy as np
import pandas as pd
import torch
import torchaudio
from pathlib import Path
from transformers import Wav2Vec2Processor, Wav2Vec2Model
from tqdm import tqdm

# Paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "data"
PROCESSED_DIR = DATA_DIR / "processed"
EMBEDDINGS_DIR = PROCESSED_DIR / "embeddings"
INDEX_PATH = PROCESSED_DIR / "mustard_index.csv"

# Model configuration
MODEL_NAME = "facebook/wav2vec2-base-960h"
TARGET_SAMPLE_RATE = 16000
EMBEDDING_DIM = 768  # Wav2Vec2-base hidden size


def load_model():
    """Load Wav2Vec2 processor and model."""
    print(f"Loading {MODEL_NAME}...")
    processor = Wav2Vec2Processor.from_pretrained(MODEL_NAME)
    model = Wav2Vec2Model.from_pretrained(MODEL_NAME)
    model.eval()
    
    # Use GPU if available
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
    print(f"✓ Model loaded on {device}")
    
    return processor, model, device


def load_audio(audio_path: str, target_sr: int = TARGET_SAMPLE_RATE) -> torch.Tensor:
    """
    Load and preprocess audio file.
    
    Args:
        audio_path: Path to audio file
        target_sr: Target sample rate (16kHz for Wav2Vec2)
    
    Returns:
        Normalized waveform tensor of shape (samples,)
    """
    # Load audio
    waveform, sr = torchaudio.load(audio_path)
    
    # Convert to mono if stereo
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    
    # Resample if necessary
    if sr != target_sr:
        resampler = torchaudio.transforms.Resample(sr, target_sr)
        waveform = resampler(waveform)
    
    # Squeeze to 1D
    waveform = waveform.squeeze(0)
    
    # Normalize (zero mean, unit variance)
    waveform = (waveform - waveform.mean()) / (waveform.std() + 1e-9)
    
    return waveform


def extract_embedding(
    waveform: torch.Tensor,
    processor: Wav2Vec2Processor,
    model: Wav2Vec2Model,
    device: torch.device
) -> np.ndarray:
    """
    Extract Wav2Vec2 embedding from waveform.
    
    Uses mean pooling over the time dimension of the last hidden state
    to get a fixed-size 768-dimensional embedding.
    
    Args:
        waveform: Audio waveform tensor of shape (samples,)
        processor: Wav2Vec2 processor
        model: Wav2Vec2 model
        device: Torch device
    
    Returns:
        Embedding array of shape (768,)
    """
    # Prepare input
    inputs = processor(
        waveform.numpy(),
        sampling_rate=TARGET_SAMPLE_RATE,
        return_tensors="pt",
        padding=True
    )
    
    # Move to device
    input_values = inputs.input_values.to(device)
    
    # Extract features
    with torch.no_grad():
        outputs = model(input_values)
        # last_hidden_state shape: (1, frames, 768)
        hidden_states = outputs.last_hidden_state
        
        # Mean pool over time dimension to get fixed-size embedding
        embedding = hidden_states.mean(dim=1).squeeze(0)
    
    return embedding.cpu().numpy()


def resolve_path(path_str: str, base_dir: Path) -> Path:
    """
    Resolve a path that may be relative or absolute.
    
    Args:
        path_str: Path string (relative or absolute)
        base_dir: Base directory for resolving relative paths
    
    Returns:
        Resolved absolute Path
    """
    path = Path(path_str)
    if path.is_absolute():
        return path
    return base_dir / path


def process_dataset(df: pd.DataFrame, processor, model, device) -> pd.DataFrame:
    """
    Process all audio files and extract embeddings.
    
    Args:
        df: DataFrame with 'id' and 'audio_path' columns
        processor: Wav2Vec2 processor
        model: Wav2Vec2 model
        device: Torch device
    
    Returns:
        Updated DataFrame with 'embedding_path' column (relative paths)
    """
    EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)
    
    embedding_paths = []
    failed_ids = []
    
    print(f"\nExtracting embeddings for {len(df)} audio files...")
    
    for _, row in tqdm(df.iterrows(), total=len(df), desc="Extracting embeddings"):
        item_id = row['id']
        # Resolve audio_path (handles both relative and legacy absolute paths)
        audio_path = resolve_path(row['audio_path'], PROCESSED_DIR)
        embedding_path = EMBEDDINGS_DIR / f"{item_id}.npy"
        # Store relative path for portability
        relative_embedding_path = embedding_path.relative_to(PROCESSED_DIR)
        
        # Skip if already processed
        if embedding_path.exists():
            embedding_paths.append(str(relative_embedding_path))
            continue
        
        try:
            # Load audio
            waveform = load_audio(str(audio_path))
            
            # Skip very short audio (< 0.1 seconds)
            if len(waveform) < TARGET_SAMPLE_RATE * 0.1:
                print(f"\n  ⚠ Skipping {item_id}: audio too short")
                embedding_paths.append(None)
                failed_ids.append(item_id)
                continue
            
            # Extract embedding
            embedding = extract_embedding(waveform, processor, model, device)
            
            # Save embedding
            np.save(embedding_path, embedding)
            embedding_paths.append(str(relative_embedding_path))
            
        except Exception as e:
            print(f"\n  ✗ Failed to process {item_id}: {e}")
            embedding_paths.append(None)
            failed_ids.append(item_id)
    
    df['embedding_path'] = embedding_paths
    
    # Report results
    successful = df['embedding_path'].notna().sum()
    print(f"\n✓ Successfully extracted {successful}/{len(df)} embeddings")
    
    if failed_ids:
        print(f"✗ Failed IDs: {failed_ids}")
    
    return df


def main():
    print("=" * 60)
    print("Wav2Vec2 Embedding Extraction")
    print("=" * 60)
    
    # Check if index exists
    if not INDEX_PATH.exists():
        print(f"✗ Index file not found: {INDEX_PATH}")
        print("  Please run mustard_prepare.py first")
        return
    
    # Load index
    print(f"\nLoading index from {INDEX_PATH}...")
    df = pd.read_csv(INDEX_PATH)
    print(f"✓ Loaded {len(df)} samples")
    
    # Check for audio files (resolving relative paths)
    existing_audio = df['audio_path'].apply(
        lambda p: resolve_path(p, PROCESSED_DIR).exists()
    ).sum()
    print(f"✓ Found {existing_audio}/{len(df)} audio files")
    
    if existing_audio == 0:
        print("✗ No audio files found. Please run mustard_prepare.py first")
        return
    
    # Filter to only samples with audio (resolving relative paths)
    df = df[df['audio_path'].apply(lambda p: resolve_path(p, PROCESSED_DIR).exists())]
    
    # Load model
    processor, model, device = load_model()
    
    # Extract embeddings
    df = process_dataset(df, processor, model, device)
    
    # Filter out failed extractions
    df_valid = df[df['embedding_path'].notna()]
    
    # Save updated index
    output_path = PROCESSED_DIR / "mustard_index_with_embeddings.csv"
    df_valid.to_csv(output_path, index=False)
    print(f"\n✓ Saved updated index to {output_path}")
    
    # Print summary
    print("\n" + "=" * 60)
    print("Embedding extraction complete!")
    print("=" * 60)
    print(f"\nSummary:")
    print(f"  Total embeddings: {len(df_valid)}")
    print(f"  Embedding dimension: {EMBEDDING_DIM}")
    print(f"  Sarcastic samples: {(df_valid['label'] == 1).sum()}")
    print(f"  Non-sarcastic samples: {(df_valid['label'] == 0).sum()}")
    print(f"\nNext step: Run train_prosodic.py to train the classifier")


if __name__ == "__main__":
    main()

