"""
MUStARD Dataset Preparation Script

Downloads MUStARD dataset annotations and videos, extracts audio,
and builds an index CSV for training prosodic sarcasm detection.

Usage:
    python mustard_prepare.py

Prerequisites:
    - ffmpeg installed (brew install ffmpeg / apt install ffmpeg)
    - huggingface_hub installed (pip install huggingface_hub)
"""

import json
import pickle
import subprocess
import pandas as pd
from pathlib import Path
from huggingface_hub import snapshot_download

# Paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
AUDIO_DIR = PROCESSED_DIR / "audio_wav"
MUSTARD_DIR = RAW_DIR / "MUStARD"
VIDEOS_DIR = RAW_DIR / "videos"

# MUStARD repo files we need
MUSTARD_REPO = "https://raw.githubusercontent.com/soujanyaporia/MUStARD/master"
ANNOTATIONS_FILE = "data/sarcasm_data.json"
SPLITS_FILE = "data/split_indices.p"


def ensure_directories():
    """Create all necessary directories."""
    for dir_path in [RAW_DIR, PROCESSED_DIR, AUDIO_DIR, MUSTARD_DIR, VIDEOS_DIR]:
        dir_path.mkdir(parents=True, exist_ok=True)
    print(f"✓ Directories created")


def download_mustard_annotations():
    """Download MUStARD annotations from GitHub."""
    import urllib.request
    
    annotations_path = MUSTARD_DIR / "sarcasm_data.json"
    splits_path = MUSTARD_DIR / "split_indices.p"
    
    if not annotations_path.exists():
        print("Downloading sarcasm_data.json...")
        url = f"{MUSTARD_REPO}/{ANNOTATIONS_FILE}"
        urllib.request.urlretrieve(url, annotations_path)
        print(f"✓ Downloaded annotations to {annotations_path}")
    else:
        print(f"✓ Annotations already exist at {annotations_path}")
    
    if not splits_path.exists():
        print("Downloading split_indices.p...")
        url = f"{MUSTARD_REPO}/{SPLITS_FILE}"
        urllib.request.urlretrieve(url, splits_path)
        print(f"✓ Downloaded splits to {splits_path}")
    else:
        print(f"✓ Splits already exist at {splits_path}")
    
    return annotations_path, splits_path


def download_videos():
    """
    Download MUStARD videos from HuggingFace.
    The dataset is hosted at: huggingface.co/datasets/MichiganNLP/MUStARD
    """
    print("\nDownloading MUStARD videos from HuggingFace...")
    print("This may take a while (several GB of video data)...")
    
    try:
        # Download the utterance videos from HuggingFace
        # MUStARD is available at MichiganNLP/MUStARD
        snapshot_download(
            repo_id="MichiganNLP/MUStARD",
            repo_type="dataset",
            local_dir=str(VIDEOS_DIR),
            allow_patterns=["utterances_final/*"],  # Only utterance videos
        )
        print(f"✓ Videos downloaded to {VIDEOS_DIR}")
        return True
    except Exception as e:
        print(f"✗ Error downloading videos: {e}")
        print("\nManual download instructions:")
        print("1. Go to https://huggingface.co/datasets/MichiganNLP/MUStARD")
        print("2. Download the 'utterances_final' folder")
        print(f"3. Place videos in: {VIDEOS_DIR}/utterances_final/")
        return False


def find_video_files():
    """Find all video files in the videos directory."""
    video_extensions = {'.mp4', '.mkv', '.avi', '.webm'}
    video_files = {}
    
    # Check multiple possible locations
    search_paths = [
        VIDEOS_DIR / "utterances_final",
        VIDEOS_DIR / "data" / "utterances_final",
        VIDEOS_DIR,
    ]
    
    for search_path in search_paths:
        if search_path.exists():
            for f in search_path.iterdir():
                if f.suffix.lower() in video_extensions:
                    # Extract ID from filename (e.g., "1_60.mp4" -> "1_60")
                    video_id = f.stem
                    video_files[video_id] = f
    
    print(f"Found {len(video_files)} video files")
    return video_files


def extract_audio(video_path: Path, output_path: Path) -> bool:
    """
    Extract audio from video using ffmpeg.
    Converts to mono 16kHz WAV for Wav2Vec2 compatibility.
    """
    if output_path.exists():
        return True
    
    try:
        cmd = [
            'ffmpeg',
            '-y',  # Overwrite output
            '-i', str(video_path),
            '-ac', '1',  # Mono
            '-ar', '16000',  # 16kHz sample rate
            '-vn',  # No video
            str(output_path)
        ]
        subprocess.run(cmd, capture_output=True, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"  ✗ Failed to extract audio from {video_path.name}: {e}")
        return False
    except FileNotFoundError:
        print("✗ ffmpeg not found. Please install ffmpeg:")
        print("  macOS: brew install ffmpeg")
        print("  Ubuntu: sudo apt install ffmpeg")
        return False


def build_index(annotations_path: Path, splits_path: Path) -> pd.DataFrame:
    """
    Build the dataset index CSV from annotations.
    
    Returns DataFrame with columns:
        - id: unique identifier (e.g., "1_60")
        - audio_path: relative path to extracted WAV file (relative to processed dir)
        - label: 1 for sarcastic, 0 for non-sarcastic
        - speaker: character name
        - show: TV show name
        - utterance: the text of what was said
    """
    # Load annotations
    with open(annotations_path, 'r') as f:
        annotations = json.load(f)
    
    # Load official splits (Python 2 pickle, needs latin1 encoding)
    with open(splits_path, 'rb') as f:
        splits = pickle.load(f, encoding='latin1')
    
    print(f"\nLoaded {len(annotations)} annotations")
    print(f"Loaded {len(splits)} cross-validation folds")
    
    # Find available video files
    video_files = find_video_files()
    
    # Build index
    records = []
    extracted_count = 0
    missing_count = 0
    
    for item_id, item_data in annotations.items():
        audio_path = AUDIO_DIR / f"{item_id}.wav"
        
        # Try to find and extract audio
        if item_id in video_files:
            if extract_audio(video_files[item_id], audio_path):
                extracted_count += 1
            else:
                continue
        elif not audio_path.exists():
            missing_count += 1
            continue
        
        # Store path relative to PROCESSED_DIR for portability
        relative_audio_path = audio_path.relative_to(PROCESSED_DIR)
        
        record = {
            'id': item_id,
            'audio_path': str(relative_audio_path),
            'label': 1 if item_data.get('sarcasm', False) else 0,
            'speaker': item_data.get('speaker', 'UNKNOWN'),
            'show': item_data.get('show', 'UNKNOWN'),
            'utterance': item_data.get('utterance', ''),
        }
        records.append(record)
    
    df = pd.DataFrame(records)
    
    print(f"\n✓ Extracted audio for {extracted_count} videos")
    if missing_count > 0:
        print(f"✗ Missing {missing_count} videos (not in download)")
    
    print(f"\nDataset statistics:")
    print(f"  Total samples: {len(df)}")
    print(f"  Sarcastic: {(df['label'] == 1).sum()}")
    print(f"  Non-sarcastic: {(df['label'] == 0).sum()}")
    print(f"  Shows: {df['show'].nunique()}")
    
    return df


def main():
    print("=" * 60)
    print("MUStARD Dataset Preparation")
    print("=" * 60)
    
    # Step 1: Create directories
    print("\n[1/4] Creating directories...")
    ensure_directories()
    
    # Step 2: Download annotations
    print("\n[2/4] Downloading MUStARD annotations...")
    annotations_path, splits_path = download_mustard_annotations()
    
    # Step 3: Download videos
    print("\n[3/4] Downloading videos from HuggingFace...")
    download_videos()
    
    # Step 4: Build index and extract audio
    print("\n[4/4] Building dataset index and extracting audio...")
    df = build_index(annotations_path, splits_path)
    
    # Save index
    index_path = PROCESSED_DIR / "mustard_index.csv"
    df.to_csv(index_path, index=False)
    print(f"\n✓ Saved index to {index_path}")
    
    print("\n" + "=" * 60)
    print("Dataset preparation complete!")
    print("=" * 60)
    print(f"\nNext step: Run mustard_embeddings.py to extract Wav2Vec2 embeddings")
    
    return df


if __name__ == "__main__":
    main()

