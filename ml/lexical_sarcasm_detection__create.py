import urllib.request
import json
import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf
from tensorflow import keras

training_size = 20000
vocab_size = 10000
truncating_type = 'post'
padding_type = 'post'
max_length = 100
embedding_dim = 16

url = "https://storage.googleapis.com/learning-datasets/sarcasm.json"
output_path = "/tmp/sarcasm.json"
urllib.request.urlretrieve(url, output_path)

with open("/tmp/sarcasm.json", 'r') as f:
    datastore = json.load(f)

sentences = [] 
labels = []
for item in datastore:
    sentences.append(item['headline'])
    labels.append(item['is_sarcastic'])

# Split data once
training_sentences = sentences[0:training_size]
testing_sentences = sentences[training_size:]
training_labels = np.array(labels[0:training_size])
testing_labels = np.array(labels[training_size:])

# Tokenize
vectorize_layer = keras.layers.TextVectorization(max_tokens=vocab_size, output_sequence_length=max_length)
vectorize_layer.adapt(training_sentences)

model = keras.Sequential([
    vectorize_layer,
    keras.layers.Embedding(vocab_size, embedding_dim),
    keras.layers.GlobalAveragePooling1D(),
    keras.layers.Dense(24, activation='relu'),
    keras.layers.Dense(1, activation='sigmoid')
])

model.compile(loss='binary_crossentropy',optimizer='adam',metrics=['accuracy'])

num_epochs = 30
training_sentences = tf.constant(training_sentences)
testing_sentences = tf.constant(testing_sentences)

history = model.fit(
    training_sentences,
    training_labels,
    epochs=num_epochs,
    validation_data=(testing_sentences, testing_labels),
    verbose=2
)

model.save('sarcasm_model.keras')

sentences = ["granny starting to fear spiders in the garden might be real", "the dog has really soft fur and is very friendly"]
sentences_tensor = tf.constant(sentences)
predictions = model.predict(sentences_tensor)
print("\nPredictions:")
for i, pred in enumerate(predictions):
    print(f"'{sentences[i]}' -> {pred[0]:.4f} ({'Sarcastic' if pred[0] > 0.5 else 'Not Sarcastic'})")