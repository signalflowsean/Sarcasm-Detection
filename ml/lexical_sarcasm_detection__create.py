import urllib.request
import json
import sys
import io
import matplotlib.pyplot as plt
import numpy as np
from tensorflow import keras

# TODO: add vectorization layer to the model so we can use it directly with raw text
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

training_sentences = sentences[0:training_size]
testing_sentences = sentences[training_size:]
training_labels = labels[0:training_size]
testing_labels = labels[training_size:]

# Tokenize
vectorize_layer = keras.layers.TextVectorization(max_tokens=vocab_size)
vectorize_layer.adapt(training_sentences)

vocab = vectorize_layer.get_vocabulary()
word_index = {word: i for i, word in enumerate(vocab)}

training_sequences = vectorize_layer(training_sentences)
training_padded = keras.utils.pad_sequences(training_sequences, padding=padding_type, truncating=truncating_type, maxlen=max_length)

testing_sequences = vectorize_layer(testing_sentences)
testing_padded = keras.utils.pad_sequences(testing_sequences, padding=padding_type, truncating=truncating_type, maxlen=max_length)

training_padded = np.array(training_padded)
training_labels = np.array(training_labels)
testing_padded = np.array(testing_padded)
testing_labels = np.array(testing_labels)

model = keras.Sequential([
    keras.layers.Embedding(vocab_size, embedding_dim, input_length=max_length),
    keras.layers.GlobalAveragePooling1D(),
    keras.layers.Dense(24, activation='relu'),
    keras.layers.Dense(1, activation='sigmoid')
])
model.compile(loss='binary_crossentropy',optimizer='adam',metrics=['accuracy'])

num_epochs = 30
history = model.fit(training_padded, training_labels, epochs=num_epochs, validation_data=(testing_padded, testing_labels), verbose=2)
model.save('sarcasm_model.keras')  

def plot_graphs(history, string):
  plt.plot(history.history[string])
  plt.plot(history.history['val_'+string])
  plt.xlabel("Epochs")
  plt.ylabel(string)
  plt.legend([string, 'val_'+string])
  plt.show()
  
plot_graphs(history, "accuracy")
plot_graphs(history, "loss")

reverse_word_index = {v: k for k, v in word_index.items()}

def decode_sentence(text):
    return ' '.join([reverse_word_index.get(i, '?') for i in text])

print(decode_sentence(training_padded[0]))
print(training_sentences[2])
print(labels[2])

e = model.layers[0]
weights = e.get_weights()[0]
print(weights.shape) # shape: (vocab_size, embedding_dim)

out_v = io.open('vecs.tsv', 'w', encoding='utf-8')
out_m = io.open('meta.tsv', 'w', encoding='utf-8')
for word_num in range(1, min(vocab_size, len(reverse_word_index))):
    if word_num in reverse_word_index:
        word = reverse_word_index[word_num]
        embeddings = weights[word_num]
        out_m.write(word + "\n")
        out_v.write('\t'.join([str(x) for x in embeddings]) + "\n")
out_v.close()
out_m.close()

sentences = ["granny starting to fear spiders in the garden might be real", "the dog has really soft fur and is very friendly"]

# Use the vectorize layer directly
sequences = vectorize_layer(sentences)
padded = keras.utils.pad_sequences(sequences, maxlen=max_length, padding=padding_type, truncating=truncating_type)

predictions = model.predict(padded)
print("Predictions:")
for i, pred in enumerate(predictions):
    print(f"'{sentences[i]}' -> {pred[0]:.4f} ({'Sarcastic' if pred[0] > 0.5 else 'Not Sarcastic'})")