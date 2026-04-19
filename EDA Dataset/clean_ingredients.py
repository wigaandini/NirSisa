"""
clean_ingredients.py
--------------------
Aggressive cleaning of Indonesian recipe ingredient data.
Reads raw "Ingredients" column, outputs fully normalized "Ingredients Cleaned".

Usage:  python clean_ingredients.py
"""

import re
import csv
import unicodedata

# ═══════════════════════════════════════════════════════════════════════════════
# EXPORTABLE CONSTANTS (reusable by normalizer.py)
# ═══════════════════════════════════════════════════════════════════════════════

ALIAS_MAP: dict[str, str] = {
    # chilli
    "cabe rawit merah": "cabai rawit",
    "cabe merah keriting": "cabai merah keriting",
    "cabai merah keriting": "cabai merah keriting",
    "cabai keriting": "cabai merah keriting",
    "cabe merah": "cabai merah",
    "cabe rawit": "cabai rawit",
    "cabe hijau": "cabai hijau",
    "cabe": "cabai",
    "lombok merah": "cabai merah",
    "lombok": "cabai",
    "cabai setan": "cabai rawit",
    # egg
    "telor ayam": "telur ayam",
    "telor bebek": "telur bebek",
    "telor puyuh": "telur puyuh",
    "telor": "telur",
    "putih telor": "putih telur",
    "kuning telor": "kuning telur",
    # spices
    "laos": "lengkuas",
    "sereh": "serai",
    "sere": "serai",
    "jahe merah": "jahe",
    "merica": "lada",
    "merica bubuk": "lada bubuk",
    "lada hitam": "lada hitam",
    # onion
    "brambang": "bawang merah",
    "bawang bombai": "bawang bombay",
    "bawang bombay": "bawang bombay",
    "bawang p": "bawang putih",
    # vegetables
    "pete": "petai",
    "touge": "tauge",
    "toge": "tauge",
    "daun bawang": "daun bawang",
    # coconut
    "santen": "santan",
    "santan kental": "santan",
    "santan encer": "santan",
    "kelapa parut": "kelapa",
    # leaves
    "daun jeruk purut": "daun jeruk",
    "daun jeruk wangi": "daun jeruk",
    "jeruk purut": "daun jeruk",
    "daun salm": "daun salam",
    # sugar
    "gula jawa": "gula merah",
    "gula aren": "gula merah",
    "gula merah": "gula merah",
    # sauce
    "saos sambal": "saus sambal",
    "saos tomat": "saus tomat",
    "saos tiram": "saus tiram",
    "saos teriyaki": "saus teriyaki",
    "saos": "saus",
    "saus teriyaki": "saus teriyaki",
    # misc
    "penyedap rasa": "penyedap",
    "vetsin": "penyedap",
    "micin": "penyedap",
    "air matang": "air",
    "air mentah": "air",
    "air bersih": "air",
}

COMPOUND_WHITELIST: set[str] = {
    "minyak goreng", "bawang goreng", "nasi goreng", "mie goreng",
    "mi goreng", "kentang goreng", "tepung goreng", "tempe goreng",
    "tahu goreng", "ayam goreng", "ikan goreng", "udang goreng",
    "bawang merah goreng", "bawang putih goreng",
    "wortel korek api",  # will be normalized later to "wortel"
}

PREP_WORDS: list[str] = [
    # passive di- forms
    "digoreng", "direbus", "dikukus", "dibakar", "dipotong", "diiris",
    "dicincang", "dihaluskan", "digeprek", "dimemarkan", "dikupas",
    "diulek", "disangrai", "diparut", "dirajang", "diblender",
    "dimixer", "diaduk", "ditabur", "ditumis", "direndam", "diseduh",
    "dimasak", "dichopper", "dioven", "dipanggang", "dimarinasi",
    "dilumuri", "diungkep", "dipresto", "dibuang", "dibersihkan",
    "disuwir", "dipipihkan", "dipenyet", "difillet",
    "dipisah", "disisihkan", "disuir", "dimarinade",
    # menV- active forms
    "menggoreng", "merebus", "menumis", "membakar", "memanggang",
    "mengaduk", "menabur", "menyiram", "menuang", "mengolesi",
    "mengupas", "mencuci", "melumuri", "menghaluskan",
    # -kan / tambahan forms
    "haluskan", "memarkan", "tumiskan", "campurkan", "tambahkan",
    "sisihkan", "olesi", "lumuri", "marinade", "marinasi",
    # base forms
    "sangrai", "bakar", "kukus", "goreng", "rebus",
    "rajang", "cincang", "geprek", "kupas", "cuci",
    "potong", "iris", "serong", "tipis", "kasar", "dadu",
    "halus", "parut", "ulek", "jari", "panggang",
    "tumis", "blender", "mixer", "oven", "presto",
    "suwir", "suir", "cacah", "sobek", "belah",
    "tambah", "campur", "siram", "tabur", "tuang", "aduk", "pisah",
    "rebusan", "tumisan", "gorengan",
    # descriptors
    "kecil", "besar", "sedang", "utuh", "segar", "bersih", "bersihkan",
    "matang", "mentah", "empuk", "lembut", "wangi", "enak",
    "kating",  # bawang putih kating = just bawang putih
    "bersh", "bersiih", "bersihin", "bersihkan", "bersihkn",  # typos
    "pengempuk",  # "pengempuk daging" = tenderizer
    "harum", "wanginya",
    # size/shape descriptors
    "korek api", "ukuran", "ukurang", "berukuran", "berukurang", "seukuran",
    # remnants
    "jumbo", "super", "original", "premium", "deluxe", "royal",
    # buang biji / buang tulang etc.
    "buang biji", "buang tulang", "buang kulit", "buang kepala",
    "buang akar", "buang bagian", "ambil bagian",
    # truncated common
    "ny", "kny", "gny", "kn", "an", "yg",
]

# Abbreviation → expansion (applied as substring replacement)
ABBREV_MAP: dict[str, str] = {
    # multi-char abbreviations (longest first is enforced at runtime)
    "sckpnya": "secukupnya",
    "scukupnya": "secukupnya",
    "scukupx": "secukupnya",
    "scukup": "secukupnya",
    "sckpny": "secukupnya",
    "lmbr": "lembar",
    "btng": "batang",
    "ptng": "potong",
    "bwng": "bawang",
    "bwg": "bawang",
    "bgian": "bagian",
    "russ": "ruas",
    "slera": "selera",
    "ekr": "ekor",
    "negri": "negeri",
    "sdh": "sudah",
    "blm": "belum",
    "smpe": "sampai",
    "tmbh": "tambah",
    "dtmbh": "ditambah",
    "tmbhn": "tambahan",
    "bbrp": "beberapa",
    "diptng": "dipotong",
    "hihihii": "",
    "hihi": "",
    "hehe": "",
    "bwg": "bawang",
    "kya": "seperti",
    # short abbreviations
    "dgn": "dengan",
    "krn": "karena",
    "pke": "pakai",
    "blh": "boleh",
    "trs": "terus",
    "klo": "kalau",
    "utk": "untuk",
    "tdk": "tidak",
    "nggak": "tidak",
}

# Single-letter noise: standalone "m", "n", "d", "g", "p", "q", "x", "uk" before/after spaces
# These are remnants of broken abbreviations
# Match standalone single letters AND "uk" but NOT inside words
# Use lookbehind/ahead for spaces or string boundaries
SINGLE_LETTER_NOISE = re.compile(r"(?:^|\s)[mndgpqx](?:\s|$)")
UK_NOISE = re.compile(r"(?<!\w)uk(?!\w)")

VAGUE_QTY: list[str] = [
    "secukupnya", "sesuai selera", "sejumput", "segenggam",
    "kira-kira", "kira kira", "secukup nya", "kurang lebih", "munjung",
    "sedikit", "sebanyaknya", "secukup ny", "secukupna",
    "secukupny", "secukupnyaa", "secukupnya", "scukupnya", "scukup",
    "sckpny", "sckpnya", "sckp", "secukupx", "secukupa",
    "kurleb", "krg lbh", "krg lbih", "kurleb cc",
    "sesuai keperluan", "sesuai kebutuhan", "sesuai takaran",
    "sesuai rasa", "sesuai serela", "sesuai selerah", "sesuai selera",
    "sesuai serat", "sesuai slra", "seseuai selera", "selerah",
    "ikut selera", "selera", "slera", "sesuaii",
    "kira", "sekitar", "sekitarnya", "kirakira", "kira²", "kira\"",
    "agak banyak", "rada banyakan", "agak", "rada",
    "bila suka", "bila perlu", "boleh tambah", "boleh skip",
    "bisa skip", "bisa di skip", "boleh kurang", "boleh lebih",
    "boleh tidak", "saya skip", "aku skip", "sy skip", "skip",
    "mama suka", "papa suka", "mom",
    "berukurang", "berukuran", "seukuran", "ukurang",
    # secukupnya bare-stem and typos
    "secukup", "secukupy", "secukupx", "secukupmya", "secukupya",
    "secukupnyq", "secukupnua", "secukupnga", "secukupmya",
    "secukupnny", "secukupnyal", "secukup mya", "secukup ny",
    "secukup nya", "secukup rasa", "sckpx", "secukupya",
]

PERSONAL_COMMENT_PHRASES: list[str] = [
    "saya pakai", "saya pake", "aku pakai", "aku pake", "aku suka",
    "suami saya", "anak saya", "kalau saya", "menurut saya",
    "sy pake", "sy pakai", "q pake",
    "bisa diganti", "bisa ditambah", "bisa dikurangi", "bisa di ganti",
    "bisa di tambah", "bisa diskip", "bisa di lewat", "bisa di sesuai",
    "bisa disesuaikan", "bisa pakai", "bisa pake", "boleh pakai",
    "boleh pake", "boleh tidak", "boleh kurang", "boleh lebih",
    "kalo gak ada", "kalau ada", "kalo pengen", "kalau kurang",
    "kalo mau", "kalau mau", "kalo emang", "kalau ga", "kalau tidak",
    "kalo ga", "kalo suka", "kalau suka",
    "jika ingin", "jika suka", "jika mau", "jika tidak", "jika tdak",
    "optional", "opsional", "note:", "nb:", "note ",
    "sesuaikan rasa", "sesuaikan", "disesuaikan",
    "ambil bagian", "ambil bag", "ambil dagingnya", "ambil putihnya",
    "bagian putihnya", "bagian putih",
    "hanya supaya", "supaya", "lumuri", "atau lebih",
    "d fillet", "di fillet",
    "jangan", "lebih enak", "lebih gurih", "lebih nikmat",
    "tergantung", "terserah",
    # bare personal pronouns mid-token (truncate to keep ingredient before)
    " saya", " aku", " aq", " ku ", " sy ", " gw ",
    " mama", " papa", " mom", " ibu",
    " brand", " merk", " merek",
    " tambahan dari", " disini pakai",
]

SECTION_HEADERS: set[str] = {
    "bumbu halus", "bumbu", "bahan", "pelengkap", "bumbu pelengkap",
    "bumbu dihaluskan", "tambahan", "bahan pelengkap",
    "topping", "hiasan", "garnish", "sesuaikan",
    "sambal", "olesan", "cocolan", "adonan", "isian",
    "bumbu penyedap", "bahan saus", "bahan tambahan", "bahan sambal",
    "bahan utama", "bumbu lainnya", "kuah", "saus", "saos",
}

# Whitelist of legit "bumbu X" / "bahan X" / "sambal X" / "saus X" patterns.
# If a token starts with section header word but matches one of these, KEEP it.
SECTION_HEADER_WHITELIST: set[str] = {
    "bumbu kari", "bumbu rendang", "bumbu sate", "bumbu opor",
    "bumbu rujak", "bumbu pecel", "bumbu bali", "bumbu rawon",
    "bumbu soto", "bumbu nasi goreng", "bumbu marinasi",
    "bumbu mie ayam", "bumbu kering", "bumbu instant",
    "bumbu instan", "bumbu ayam", "bumbu sayur", "bumbu tabur",
    "bumbu gulai", "bumbu spaghetti", "bumbu nasi",
    "bumbu spagetti", "bumbu rica", "bumbu ungkep",
    "sambal goreng", "sambal teri", "sambal terasi",
    "sambal kecap", "sambal matah", "sambal hijau",
    "sambal bawang", "sambal rawit", "sambal tomat",
    "sambal cabai", "sambal cabai rawit", "sambal kacang",
    "sambal kecap manis", "sambal bangkok", "sambal pecel",
    "sambal korek", "sambal soto", "sambal balado",
    "sambal bajak", "sambal jeruk nipis", "sambal kecap rawit",
    "sambal cabai garam", "sambal bacang", "sambal ijo",
    "sambal uleg", "sambal asam", "sambal tauco",
    "bumbu ungkep", "bumbu kaldu", "bumbu masak",
    "bumbu jamur", "bumbu opor", "bumbu balado",
    "saus tiram", "saus tomat", "saus sambal", "saus teriyaki",
    "saus cabai", "saus pedas", "saus inggris", "saus bbq",
    "saus mentai", "saus tartar", "saus blackpepper",
    "saus asam manis", "saus padang",
    "kuah santan", "kuah kari", "kuah opor",
    "isian risoles", "adonan kulit",
}

SECTION_HEADER_PATTERNS: list[str] = [
    "bumbu", "bahan", "pelengkap", "tambahan", "topping", "hiasan",
    "olesan", "sambal", "cocolan", "kuah", "saos", "saus",
    "rempah", "toping", "garnish", "isian", "adonan",
    "air untuk", "untuk merebus", "untuk menggoreng",
    "untuk saos", "untuk saus", "untuk olesan", "untuk cocol",
    "untuk makan", "untuk penyajian",
]

BRAND_MAP: dict[str, str] = {
    "santan kara": "santan", "santan instant": "santan",
    "santan instan": "santan",
    "kecap bango": "kecap manis", "kecap abc": "kecap manis",
    "kecap sedap": "kecap manis", "kecap blackbold": "kecap manis",
    "ro*co": "", "m***ko": "", "r*y*o": "",
    "royco": "", "masako": "", "royko": "",
    "kara": "santan", "bango": "kecap manis", "abc": "kecap manis",
    "saori": "saus tiram", "sajiku": "", "ladaku": "lada",
    "sasa": "", "indofood": "", "maggi": "", "maggy": "",
    "sariwangi": "", "tropicana slim": "", "tropicana": "",
    "indomie": "mie instan", "mie indomie": "mie instan",
    "bgks indomie": "mie instan", "indomie rasa": "mie instan",
    "knorr": "kaldu bubuk", "blok knorr": "kaldu bubuk",
    "keju kraft": "keju", "kraft": "keju",
    "saus bbq delmonte": "saus bbq", "delmonte": "",
    "tepung beras rose brand": "tepung beras",
    "rose brand": "", "champ": "", "bernadhi": "",
    "merk": "", "merek": "",
    "minyak samin merk onta": "minyak samin", "onta": "",
    "ezzo": "", "delfi": "", "hokben": "",
    "kewpie": "", "ultra": "", "heinz": "",
    "nestle": "", "nutrijell": "agar-agar",
    "kfc": "", "ayam brand": "", "ayam merk": "",
    "tepung kfc": "tepung serbaguna",
    "mie sedap": "mie instan", "mi sedap": "mie instan",
    "kecap inggris sedap": "kecap inggris",
    "totole": "", "totole kaldu jamur": "kaldu jamur",
    "kaldu jamur totole": "kaldu jamur",
}

UNITS: list[str] = [
    "ekor", "buah", "sdm", "sdt", "siung", "ruas", "lembar", "batang",
    "butir", "gram", "gr", "kg", "ml", "liter", "cm", "bh", "biji",
    "sendok", "bungkus", "papan", "sachet", "bks", "potong", "iris",
    "ikat", "gelas", "cup", "ons", "helai", "tangkai", "genggam",
    "jumput", "lbr", "btg", "btr", "jari", "pcs", "pieces",
    "pasang", "kaleng", "kotak", "sisir", "bonggol",
]

NOISE_ONLY_WORDS: set[str] = {
    "untuk", "dengan", "karena", "terus", "sudah", "yang", "atau",
    "juga", "sedikit", "banyak", "agak", "lebih", "cukup",
    "deh", "sih", "aja", "ajah", "nih", "tuh", "dong", "donk",
    "yaa", "ya", "yah", "bgt", "banget", "kok", "lho", "loh",
    "pcs", "pieces", "pasang", "lagi", "kembali", "lain",
    "sampai", "hingga", "kemudian", "setelah", "sebelum",
    "tidak", "belum", "sudah", "ada", "ini", "itu",
    "boleh", "bisa", "suka", "mau", "pakai", "pake",
    "tambah", "tambahkan", "campur", "campurkan",
    "menjadi", "jadi", "dari", "ke", "di",
    "pedas", "asin", "manis", "gurih", "asam",
    "bumbu", "bahan", "pelengkap", "topping", "hiasan", "olesan",
    "sambal", "kuah", "isian", "adonan", "cocolan", "sambel", "saus",
    "saji", "siap", "instan", "kemasan", "premium", "jadi",
    "rada", "kurleb", "kira", "sekitar", "nya",
}

# Post-cleaning normalizations: ingredient → canonical name
# Applied at the very end to standardize common outputs
POST_NORMALIZE: dict[str, str] = {
    "wortel korek api": "wortel",
    "air matang": "air",
    "air mentah": "air",
    "air panas": "air",
    "air es": "air",
    "air bersih": "air",
    "kepala ayam": "ayam",
    "ceker ayam": "ceker ayam",
    "sayap ayam": "sayap ayam",
    "paha ayam": "paha ayam",
    "dada ayam": "dada ayam",
    "fillet ayam": "dada ayam",
    "fillet dada ayam": "dada ayam",
    "dada ayam fillet": "dada ayam",
    "ayam fillet": "dada ayam",
    "ayam dada fillet": "dada ayam",
    "daging ayam fillet": "dada ayam",
    "daging ayam": "ayam",
    "kulit ayam": "kulit ayam",
    "teh celup sariwangi": "teh celup",
    "teh celup": "teh celup",
    "bubuk pengempuk daging": "pengempuk daging",
    "pengempuk daging": "pengempuk daging",
    "es batu": "es batu",
}

# Prefix abbreviation noise — words that should be stripped when they appear at the
# START of a token (e.g., "bj cabai" -> "cabai"). These are unit/quantity abbrev
# leftovers that the leading-qty regex missed.
PREFIX_NOISE_WORDS: set[str] = {
    "bj", "bh", "btg", "btr", "lbr", "sdm", "sdt", "sdk", "sk",
    "an", "dg", "ekr", "ptg", "kpg", "at", "atw", "ato", "et",
    "sy", "tp", "kn", "yg", "yng", "sm", "bgks", "bks", "bgs",
    "dan", "atau", "untuk",
}

# Trailing words that should be stripped — leftover prepositions/conjunctions
# at end of token (e.g., "serai di" -> "serai", "garam dan" -> "garam").
TRAILING_NOISE_WORDS: set[str] = {
    "di", "dan", "atau", "ke", "dari", "untuk", "utk", "dgn", "dengan",
    "jika", "kalau", "bila", "yg", "yang", "yaitu", "sambil",
    "sampai", "hingga", "sebagai", "bisa", "boleh", "juga", "lagi",
    "an", "ny", "kny", "kn", "nya", "kah", "lah", "tp", "lalu",
    "kemudian", "setelah", "sebelum", "sm", "kya",
}

# Brand modifier words ("siap pakai", "siap saji", "kemasan")
PRODUCT_MODIFIER_WORDS: set[str] = {
    "siap", "pakai", "saji", "instan", "kemasan", "kalengan",
    "botol", "botolan", "sachet", "premium", "jadi", "olahan",
    "murah", "grosir", "cepat", "kalengan", "instant",
}

# ═══════════════════════════════════════════════════════════════════════════════
# COMPILED REGEXES
# ═══════════════════════════════════════════════════════════════════════════════

_RE_PARENS = re.compile(r"\([^)]*\)")
_RE_BRACKETS = re.compile(r"\[[^\]]*\]")
_RE_SPECIAL_CHARS = re.compile(r"[#>*★✿❤♥•·\-–—|/\\&@!~`\+=%\^×《》\"'`“”‘’️\u200d\ufe0f²³¹⁰⁴⁵⁶⁷⁸⁹½¼¾±°§¿¡₀₁₂₃₄₅₆₇₈₉()\[\]{}$è]+")
_RE_DOTS = re.compile(r"\.+")

_UNITS_PATTERN = "|".join(re.escape(u) for u in sorted(UNITS, key=len, reverse=True))
_RE_LEADING_QTY = re.compile(
    r"^[\d\s./,]*"
    r"(?:\d+\s*[/]\s*\d+\s*)?"
    r"(?:" + _UNITS_PATTERN + r")?\s*",
    re.IGNORECASE,
)

def _make_phrase_re(phrases: list[str], flags: int = re.IGNORECASE) -> re.Pattern:
    sorted_phrases = sorted(phrases, key=len, reverse=True)
    escaped = [re.escape(p) for p in sorted_phrases]
    return re.compile(r"\b(?:" + "|".join(escaped) + r")\b", flags)

_RE_VAGUE = _make_phrase_re(VAGUE_QTY)
_RE_PREP = _make_phrase_re(PREP_WORDS)

# Stem-prefix patterns: catches ALL words starting with these (handles long-tail typos
# like "secukupnyaq", "secukupnyag", "seleranya", "kalautok", etc.)
NOISE_STEMS: list[str] = [
    "secukup", "scukup", "sckp",          # secukupnya variants
    "selera", "slera",                     # selera variants
    "sesuai", "seseuai",                   # sesuai variants
    "kira_kira", "kirakira",               # kira-kira (post-special-char-strip)
    "kurleb", "krglbh",                    # kurang lebih
    "munjung",
    "ukurang", "berukur", "seukur",        # ukuran variants
    "jika", "kalau", "kalo", "klo", "bila",  # conditionals
    "boleh", "bisa",                       # boleh skip / bisa diganti
    "saya", "aku", "kami", "mama", "papa", "mom",  # personal
    "skip",
    "jangan", "jgn",
    "agak", "rada",
    "sambil",
    "supaya",
    "menumis", "menggoreng", "merebus", "membakar", "memanggang",
    "marinasi", "marinade", "rebusan", "tumisan", "gorengan",
    "siapkan",                             # siapkan alumunium foil etc
]
_RE_STEM = re.compile(r"\b(?:" + "|".join(re.escape(s) for s in sorted(NOISE_STEMS, key=len, reverse=True)) + r")\w*\b", re.IGNORECASE)

# Unit/quantity modifiers stripped ANYWHERE. Skipped risky ones: "ekor"
# (ekor sapi = oxtail), "bonggol" (bonggol pisang), "blok" (margarin blok).
UNIT_MODIFIERS: list[str] = [
    "buah","bh","biji","butir","btr","lembar","lbr","batang","btg",
    "kotak","sisir","papan","ikat","tangkai","helai","ruas",
    "genggam","jumput","sachet","bks","bungkus","kaleng",
    "cup","ons","pcs","jari","pasang",
    "ptg","kpg","sdm","sdt","sdk","gram","gr","kg","ml","liter","cm","mm",
    "mangkok","piring","panci",
]
_RE_UNITS_ANYWHERE = re.compile(r"\b(?:" + "|".join(re.escape(u) for u in sorted(UNIT_MODIFIERS, key=len, reverse=True)) + r")\b", re.IGNORECASE)

# Filler/vague words. Skipped size/state words ("panjang", "merah", "kecil")
# because they distinguish ingredients (kacang panjang vs kacang merah, etc.)
FILLER_WORDS: list[str] = [
    "beberapa","bbrp","dll","dst","etc","lainnya","tambahan","masing",
    "taburan","siraman","celupan","jumbo","mini","perlu",
    "banyak","sedikit","cukup","kurang","lebih",
]
_RE_FILLER = re.compile(r"\b(?:" + "|".join(re.escape(w) for w in sorted(FILLER_WORDS, key=len, reverse=True)) + r")\b", re.IGNORECASE)

# Sentence triggers: if found after ingredient text, truncate there
_SENTENCE_TRIGGERS = [
    "untuk ", "supaya ", "agar ", "biar ", "karena ",
    "yang sudah", "yang telah", "yang di", "yang ",
    "kalau ", "kalo ", "jika ", "bila ",
    "sampai ", "hingga ", "setelah ", "sebelum ",
    "jangan ", "buat ", "atau bisa", "atau pake",
    "lalu ", "kemudian ", "cuci ", "seperti ",
]

def _remove_emojis(text: str) -> str:
    result = []
    for ch in text:
        if ord(ch) > 0xFFFF:
            continue
        if unicodedata.category(ch).startswith("So"):
            continue
        result.append(ch)
    return "".join(result)


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN CLEANING FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def clean_single_ingredient(raw: str) -> str:
    text = raw

    # 1. Remove parenthetical and bracket content
    text = _RE_PARENS.sub("", text)
    text = _RE_BRACKETS.sub("", text)

    # 2. Remove emojis and special characters
    text = _remove_emojis(text)
    text = _RE_SPECIAL_CHARS.sub(" ", text)
    text = _RE_DOTS.sub(" ", text)

    # 3. Lowercase
    text = text.lower().strip()

    # 4. Truncate at semicolon
    if ";" in text:
        text = text.split(";")[0].strip()

    # 5. Check section headers with colon
    if ":" in text:
        for pattern in SECTION_HEADER_PATTERNS:
            if pattern in text:
                return ""
        text = text.split(":")[0].strip()

    # 6. Truncate at inner comma (keeps only first item)
    if "," in text:
        text = text.split(",")[0].strip()

    # 7. Expand abbreviations (longest first)
    for abbr in sorted(ABBREV_MAP.keys(), key=len, reverse=True):
        if abbr in text:
            text = text.replace(abbr, ABBREV_MAP[abbr])

    # 7b. Fix digits merged with words: "80yg" → "80 yg", "2pasang" → "2 pasang"
    text = re.sub(r"(\d)([a-z])", r"\1 \2", text)
    text = re.sub(r"([a-z])(\d)", r"\1 \2", text)

    # 8. Handle reduplikasi: potong2→potong, kecil2→kecil, sobek2→sobek
    text = re.sub(r"(\w+)2", r"\1", text)

    # 9. Remove ALL single-letter tokens — no exceptions
    text = re.sub(r"\b[a-z]\b", "", text)

    # 9b. Remove short abbreviation noise (2-letter)
    for short in ["yg","uk","jd","dr","dl","bs","sm","aj","sy","tp","lg","dg","kl","ga","gk","bt","cb","hr","tr","ku","aq","gw"]:
        text = re.sub(r"\b" + short + r"\b", "", text)

    # 9c. Remove informal/spoken words
    for slang in ["jgn","aja","ajah","deh","sih","dong","donk","nih","tuh","yaa","yah",
                   "ya","kok","lho","loh","bgt","banget","hgg","ter","kpg"]:
        text = re.sub(r"\b" + re.escape(slang) + r"\b", "", text)

    # 9d. Remove "nya" suffix words (>4 chars): "wanginya"→"", "enaknya"→""
    text = re.sub(r"\b\w{3,}nya\b", "", text)
    # Remove repeated letters: "lembuttttt"→"lembut", "enakkk"→"enak"
    text = re.sub(r"(.)\1{2,}", r"\1", text)

    # 9e. Remove typos/broken fragments
    for typo in ["sebentr","dbersihan","dbersih","bersihkn","bersihin","bersh","negri",
                  "sambl","hgg"]:
        text = re.sub(r"\b" + re.escape(typo) + r"\b", "", text)

    # 10. Remove personal comment phrases (truncate from match to end)
    for phrase in sorted(PERSONAL_COMMENT_PHRASES, key=len, reverse=True):
        idx = text.find(phrase)
        if idx != -1:
            text = text[:idx].strip()

    # 11. Truncate at sentence triggers
    for trigger in _SENTENCE_TRIGGERS:
        idx = text.find(trigger)
        if idx > 0:
            text = text[:idx].strip()

    # 12. Remove vague quantities
    text = _RE_VAGUE.sub("", text)

    # 12b. Remove ANY word starting with a noise stem (catches long-tail typos
    # like "secukupnyaq", "seleranya", "bolehy", "kalautok", "siapkan")
    text = _RE_STEM.sub("", text)

    # 12c. Strip filler words anywhere (beberapa, bbrp, dll, taburan...)
    text = _RE_FILLER.sub("", text)

    # 12d. Strip unit modifiers anywhere (buah, bh, lbr, lembar, butir, kotak...)
    text = _RE_UNITS_ANYWHERE.sub("", text)

    # 13. Remove leading numbers and units
    text = _RE_LEADING_QTY.sub("", text).strip()
    text = re.sub(r"^\d[\d\s./,]*\s*", "", text).strip()
    # Trailing numbers: "sayap ayam 2" → "sayap ayam"
    text = re.sub(r"\s+\d+\s*$", "", text).strip()
    # Numbers embedded in text: "ayam 1 2 kg" → "ayam", "fillet ayam 1 4 kg" → "fillet ayam"
    text = re.sub(r"\s+\d[\d\s./]*\s*(?:" + _UNITS_PATTERN + r")?\s*", " ", text, flags=re.IGNORECASE).strip()
    # Any remaining standalone numbers between words
    text = re.sub(r"\b\d+\b", "", text).strip()

    # 14. Normalise brand names
    for brand in sorted(BRAND_MAP.keys(), key=len, reverse=True):
        replacement = BRAND_MAP[brand]
        text = re.sub(r"\b" + re.escape(brand) + r"\b", replacement, text, flags=re.IGNORECASE)

    # 15. Remove prep/cooking words (protect compound whitelist)
    if text not in COMPOUND_WHITELIST:
        text = _RE_PREP.sub("", text)

    # 16. Normalise spelling via alias map
    for alias in sorted(ALIAS_MAP.keys(), key=len, reverse=True):
        canonical = ALIAS_MAP[alias]
        text = re.sub(r"\b" + re.escape(alias) + r"\b", canonical, text, flags=re.IGNORECASE)

    # 16b. Multi-ingredient split — keep first item before " atau "
    if " atau " in text:
        text = text.split(" atau ")[0].strip()

    # 16c. Strip leading abbrev/noise words (bj, bh, btg, an, ...)
    while True:
        words = text.split()
        if not words or words[0] not in PREFIX_NOISE_WORDS:
            break
        text = " ".join(words[1:])

    # 16d. Strip trailing prep/conjunction (di, dan, atau, yg, ...)
    while True:
        words = text.split()
        if not words or words[-1] not in TRAILING_NOISE_WORDS:
            break
        text = " ".join(words[:-1])

    # 16e. Strip product modifier suffixes (siap pakai, siap saji, instan)
    while True:
        words = text.split()
        if not words or words[-1] not in PRODUCT_MODIFIER_WORDS:
            break
        text = " ".join(words[:-1])

    # 16f. Collapse consecutive duplicate words: "cabai cabai rawit" -> "cabai rawit"
    # Run iteratively until stable (handles "cabai cabai cabai")
    prev = None
    while text != prev:
        prev = text
        text = re.sub(r"\b(\w+)(\s+\1\b)+", r"\1", text)

    # 17. Post-normalize known compound ingredient names
    text_stripped = re.sub(r"\s+", " ", text).strip()
    if text_stripped in POST_NORMALIZE:
        text_stripped = POST_NORMALIZE[text_stripped]
    text = text_stripped

    # 18. Final cleanup
    text = re.sub(r"\s{2,}", " ", text).strip()
    text = re.sub(r",+", "", text)
    text = text.strip(".,;:!? ")

    # 19. Discard rules
    if not text:
        return ""
    if re.fullmatch(r"[\d\s./,\-]+", text):
        return ""
    if text in SECTION_HEADERS:
        return ""
    if len(text) > 30:
        return ""
    if len(text) < 2:
        return ""
    words = set(text.split())
    if words.issubset(NOISE_ONLY_WORDS):
        return ""
    if text == "air":
        return ""

    # 19b. Discard if starts with section header word AND not in whitelist
    first = text.split()[0] if text.split() else ""
    if first in {"bumbu", "bahan", "pelengkap", "topping", "hiasan",
                  "olesan", "kuah", "isian", "adonan", "cocolan", "sambel"}:
        if text not in SECTION_HEADER_WHITELIST:
            return ""

    # 19c. Discard if contains cooking action verb (post-PREP-strip residue)
    POST_ACTION = {"menumis", "menggoreng", "merebus", "membakar",
                   "memanggang", "marinasi", "marinade", "rebusan",
                   "tumisan", "gorengan", "suwir", "suir"}
    if any(w in POST_ACTION for w in text.split()):
        return ""

    # 20. FINAL VALIDATION PASS — catch any remaining noise
    # Remove any single-letter tokens that survived
    text = re.sub(r"\b[a-z]\b", "", text).strip()
    text = re.sub(r"\s{2,}", " ", text).strip()

    # Re-strip trailing noise after single-letter removal
    while True:
        words = text.split()
        if not words or words[-1] not in TRAILING_NOISE_WORDS:
            break
        text = " ".join(words[:-1])

    # Final discard checks
    if not text or len(text) < 2:
        return ""
    words = set(text.split())
    if words.issubset(NOISE_ONLY_WORDS):
        return ""

    return text


def clean_ingredients_cell(raw_cell: str) -> tuple[list[str], int]:
    raw_parts = [p.strip() for p in raw_cell.split("--") if p.strip()]
    cleaned = []
    seen = set()
    for part in raw_parts:
        result = clean_single_ingredient(part)
        if not result:
            continue
        sub_items = re.split(r"\s+dan\s+|\s+and\s+", result)
        for sub in sub_items:
            sub = sub.strip().strip(",").strip()
            if sub and sub not in SECTION_HEADERS and sub != "air" and sub not in seen:
                seen.add(sub)
                cleaned.append(sub)
    return cleaned, len(cleaned)


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    input_path = r"D:\PPT\NirSisa\EDA Dataset\Indonesian_Food_Recipes.csv"
    output_path = r"D:\PPT\NirSisa\EDA Dataset\Indonesian_Food_Recipes_Cleaned_v3.csv"

    print("Reading:", input_path)

    rows_in: list[dict] = []
    with open(input_path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        for row in reader:
            rows_in.append(row)

    print(f"Total rows: {len(rows_in)}")

    total_raw = 0
    total_clean = 0

    rows_out: list[dict] = []
    for i, row in enumerate(rows_in):
        raw_cell = row.get("Ingredients", "")
        raw_count = len([p for p in raw_cell.split("--") if p.strip()])
        total_raw += raw_count

        cleaned_list, clean_count = clean_ingredients_cell(raw_cell)
        total_clean += clean_count

        new_row = dict(row)
        new_row["Ingredients Cleaned"] = ", ".join(cleaned_list)
        new_row["Total Ingredients"] = clean_count
        rows_out.append(new_row)

    print("Writing:", output_path)
    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows_out)

    removed = total_raw - total_clean
    pct = removed / total_raw * 100 if total_raw else 0
    print(f"\nTotal ingredients (raw)  : {total_raw}")
    print(f"Total ingredients (clean): {total_clean}")
    print(f"Removed                  : {removed} ({pct:.1f}%)")
    print("\nDone:", output_path)


if __name__ == "__main__":
    main()
