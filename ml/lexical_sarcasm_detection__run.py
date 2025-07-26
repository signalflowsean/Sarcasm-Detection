import json
import tensorflow as tf
from tensorflow import keras

# Load model
model = keras.models.load_model('sarcasm_model.keras')

# Now use for predictions
sentences = ["and he has got rainbows coming out of his butt",]
sentences_tensor = tf.constant(sentences)
predictions = model.predict(sentences_tensor)

print("Predictions:")
for i, pred in enumerate(predictions):
    print(f"'{sentences[i]}' -> {pred[0]:.4f} ({'Sarcastic' if pred[0] > 0.5 else 'Not Sarcastic'})")