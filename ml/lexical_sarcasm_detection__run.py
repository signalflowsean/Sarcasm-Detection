import json
from tensorflow import keras

# Load model
model = keras.models.load_model('sarcasm_model.keras')

# Recreate vectorizer
with open('vectorizer_config.json', 'r') as f:
    vectorizer_config = json.load(f)

with open('vocabulary.json', 'r') as f:
    vocab = json.load(f)

# Recreate and set vocabulary
vectorize_layer = keras.layers.TextVectorization.from_config(vectorizer_config)
vectorize_layer.set_vocabulary(vocab)

# Now use for predictions
sentences = ["granny starting to fear spiders in the garden might be real"]
sequences = vectorize_layer(sentences)
padded = keras.utils.pad_sequences(sequences, maxlen=100, padding='post', truncating='post')
predictions = model.predict(padded)

print("Predictions:")
for i, pred in enumerate(predictions):
    print(f"'{sentences[i]}' -> {pred[0]:.4f} ({'Sarcastic' if pred[0] > 0.5 else 'Not Sarcastic'})")