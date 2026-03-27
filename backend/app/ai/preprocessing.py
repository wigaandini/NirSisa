import re
from Sastrawi.Stemmer.StemmerFactory import StemmerFactory

factory = StemmerFactory()
stemmer = factory.create_stemmer()

def preprocess_text(text: str) -> str:
    # Lowercasing
    text = text.lower()
    # Menghapus karakter non-huruf
    text = re.sub(r'[^a-zA-Z\s]', '', text)
    # Stemming
    return stemmer.stem(text)

def preprocess_ingredient(ingredient_name: str) -> str:
    # Digunakan untuk membersihkan input satuan jika diperlukan
    return preprocess_text(ingredient_name)