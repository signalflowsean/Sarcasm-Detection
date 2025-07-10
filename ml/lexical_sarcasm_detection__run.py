# Load the complete model with vectorizer
from tensorflow import keras

vocab_size = 10000
truncating_type = 'post'
padding_type = 'post'
max_length = 100

# DONT USE THIS RIGHT NOW - BROKEN 
complete_model = keras.models.load_model('sarcasm_model.keras')

# Use directly with raw text - no preprocessing needed!
sentences = ["granny starting to fear spiders in the garden might be real", "the dog has really soft fur and is very friendly"]
predictions = complete_model.predict(sentences)

print("Predictions:")
for i, pred in enumerate(predictions):
    print(f"'{sentences[i]}' -> {pred[0]:.4f} ({'Sarcastic' if pred[0] > 0.5 else 'Not Sarcastic'})")