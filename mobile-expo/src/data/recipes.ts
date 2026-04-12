export type RecipeStatus = "expired_soon" | "approaching" | "fresh";

export interface Ingredient {
  id: string;
  name: string;
  amount: string;
  availableLabel: string;
  status: "available" | "low" | "insufficient";
  emoji: string;
}

export interface RecipeStep {
  id: string;
  number: number;
  title: string;
  description: string;
}

export interface Recipe {
  id: string;
  status: RecipeStatus;
  name: string;
  description: string;
  steps: number;
  ingredients: number;
  likes: number;
  ingredientList: Ingredient[];
  stepList: RecipeStep[];
}

export const RECIPES: Recipe[] = [
  {
    id: "1",
    status: "expired_soon",
    name: "Sup Tomat & Basil",
    description: "Menggunakan: Tomat, Basil, yang segera kadaluwarsa",
    steps: 5,
    ingredients: 4,
    likes: 120,
    ingredientList: [
      { id: "1", name: "Tomat", amount: "3 buah", availableLabel: "3 Tersedia", status: "available", emoji: "🍅" },
      { id: "2", name: "Basil Segar", amount: "1 ikat", availableLabel: "1 Tersedia", status: "available", emoji: "🌿" },
      { id: "3", name: "Bawang Putih", amount: "2 siung", availableLabel: "1 Sisa Kemarin", status: "low", emoji: "🧄" },
      { id: "4", name: "Kaldu Ayam", amount: "500ml", availableLabel: "Kurang", status: "insufficient", emoji: "🍲" },
    ],
    stepList: [
      { id: "1", number: 1, title: "Siapkan Bahan", description: "Cuci tomat dan basil hingga bersih. Kupas dan cincang bawang putih." },
      { id: "2", number: 2, title: "Tumis Bawang", description: "Panaskan minyak di panci, tumis bawang putih hingga harum dan kekuningan." },
      { id: "3", number: 3, title: "Masak Tomat", description: "Masukkan tomat yang sudah dipotong, aduk hingga layu dan mengeluarkan air." },
      { id: "4", number: 4, title: "Tambah Kaldu", description: "Tuang kaldu ayam, bumbui dengan garam dan merica. Masak dengan api sedang selama 15 menit." },
      { id: "5", number: 5, title: "Sajikan", description: "Tambahkan daun basil segar di atas sup. Sajikan selagi hangat." },
    ],
  },
  {
    id: "2",
    status: "approaching",
    name: "Pasta Aglio Olio",
    description: "Menggunakan: Bawang Putih, Pasta, Minyak Zaitun",
    steps: 12,
    ingredients: 6,
    likes: 340,
    ingredientList: [
      { id: "1", name: "Pasta Spaghetti", amount: "200g", availableLabel: "1 Tersedia", status: "available", emoji: "🍝" },
      { id: "2", name: "Bawang Putih", amount: "6 siung", availableLabel: "6 Tersedia", status: "available", emoji: "🧄" },
      { id: "3", name: "Minyak Zaitun", amount: "4 sdm", availableLabel: "1 Tersedia", status: "available", emoji: "🫒" },
      { id: "4", name: "Cabai Merah", amount: "2 buah", availableLabel: "2 Tersedia", status: "available", emoji: "🌶️" },
      { id: "5", name: "Peterseli", amount: "1 ikat", availableLabel: "Kurang", status: "insufficient", emoji: "🌿" },
      { id: "6", name: "Keju Parmesan", amount: "50g", availableLabel: "1 Sisa Kemarin", status: "low", emoji: "🧀" },
    ],
    stepList: [
      { id: "1", number: 1, title: "Rebus Pasta", description: "Rebus pasta dalam air mendidih yang sudah diberi garam hingga al dente, sekitar 8-10 menit." },
      { id: "2", number: 2, title: "Siapkan Bumbu", description: "Iris tipis bawang putih dan cabai merah. Cincang kasar peterseli." },
      { id: "3", number: 3, title: "Tumis Bawang", description: "Panaskan minyak zaitun di wajan, tumis bawang putih dan cabai dengan api kecil hingga keemasan." },
      { id: "4", number: 4, title: "Campur & Sajikan", description: "Masukkan pasta yang sudah ditiriskan ke wajan. Aduk rata, taburi peterseli dan parmesan." },
    ],
  },
  {
    id: "3",
    status: "fresh",
    name: "Orak-Arik Sayur Gurih",
    description: "Menggunakan: Wortel, Buncis, Kol, Telur",
    steps: 8,
    ingredients: 5,
    likes: 210,
    ingredientList: [
      { id: "1", name: "Sawi Hijau", amount: "1 ikat", availableLabel: "1 Tersedia", status: "available", emoji: "🥬" },
      { id: "2", name: "Telur Ayam", amount: "2 butir", availableLabel: "2 Tersedia", status: "available", emoji: "🥚" },
      { id: "3", name: "Bawang Bombay", amount: "1/2 buah", availableLabel: "1 Tersedia", status: "available", emoji: "🧅" },
      { id: "4", name: "Bawang Putih", amount: "1 buah", availableLabel: "1 Sisa Kemarin", status: "low", emoji: "🧄" },
      { id: "5", name: "Wortel", amount: "4 butir 900g", availableLabel: "Kurang", status: "insufficient", emoji: "🥕" },
    ],
    stepList: [
      { id: "1", number: 1, title: "Persiapan Sayur", description: "Potong sawi, wortel, dan buncis sesuai selera. Iris tipis bawang bombay." },
      { id: "2", number: 2, title: "Tumis Bumbu & Telur", description: "Tumis bawang bombay hingga harum. Masukkan telur, buat orak arik hingga matang." },
      { id: "3", number: 3, title: "Masak Sayuran", description: "Masukkan semua sayuran ke wajan, aduk rata dengan api sedang hingga layu." },
    ],
  },
  {
    id: "4",
    status: "expired_soon",
    name: "Tumis Daging Bawang",
    description: "Menggunakan: Daging Sapi, Bawang Merah, yang segera kadaluwarsa",
    steps: 6,
    ingredients: 7,
    likes: 98,
    ingredientList: [
      { id: "1", name: "Daging Sapi", amount: "250g", availableLabel: "1 Tersedia", status: "available", emoji: "🥩" },
      { id: "2", name: "Bawang Merah", amount: "5 siung", availableLabel: "5 Tersedia", status: "available", emoji: "🧅" },
      { id: "3", name: "Bawang Putih", amount: "3 siung", availableLabel: "3 Tersedia", status: "available", emoji: "🧄" },
      { id: "4", name: "Kecap Manis", amount: "2 sdm", availableLabel: "1 Tersedia", status: "available", emoji: "🫙" },
      { id: "5", name: "Cabai Hijau", amount: "3 buah", availableLabel: "Kurang", status: "insufficient", emoji: "🌶️" },
      { id: "6", name: "Daun Bawang", amount: "2 batang", availableLabel: "1 Sisa Kemarin", status: "low", emoji: "🌿" },
      { id: "7", name: "Minyak Goreng", amount: "3 sdm", availableLabel: "1 Tersedia", status: "available", emoji: "🫙" },
    ],
    stepList: [
      { id: "1", number: 1, title: "Marinasi Daging", description: "Iris tipis daging sapi, marinasi dengan kecap manis dan sedikit garam selama 15 menit." },
      { id: "2", number: 2, title: "Tumis Bumbu", description: "Panaskan minyak, tumis bawang merah dan bawang putih hingga harum." },
      { id: "3", number: 3, title: "Masak Daging", description: "Masukkan daging, masak hingga berubah warna dan matang merata." },
      { id: "4", number: 4, title: "Tambah Sayuran", description: "Masukkan cabai hijau dan daun bawang, aduk sebentar." },
      { id: "5", number: 5, title: "Koreksi Rasa", description: "Tambahkan garam, gula, dan merica secukupnya sesuai selera." },
      { id: "6", number: 6, title: "Sajikan", description: "Angkat dan sajikan dengan nasi putih hangat." },
    ],
  },
  {
    id: "5",
    status: "fresh",
    name: "Salad Alpukat Segar",
    description: "Menggunakan: Alpukat, Tomat, Selada, Lemon",
    steps: 3,
    ingredients: 4,
    likes: 175,
    ingredientList: [
      { id: "1", name: "Alpukat", amount: "2 buah", availableLabel: "2 Tersedia", status: "available", emoji: "🥑" },
      { id: "2", name: "Tomat Cherry", amount: "10 buah", availableLabel: "10 Tersedia", status: "available", emoji: "🍅" },
      { id: "3", name: "Selada", amount: "1 ikat", availableLabel: "1 Tersedia", status: "available", emoji: "🥗" },
      { id: "4", name: "Lemon", amount: "1 buah", availableLabel: "Kurang", status: "insufficient", emoji: "🍋" },
    ],
    stepList: [
      { id: "1", number: 1, title: "Siapkan Bahan", description: "Cuci semua sayuran. Belah alpukat, buang biji, dan potong dadu. Potong tomat cherry menjadi dua." },
      { id: "2", number: 2, title: "Buat Dressing", description: "Peras lemon, campurkan dengan minyak zaitun, garam, dan merica hitam." },
      { id: "3", number: 3, title: "Campur & Sajikan", description: "Tata selada di piring, tambahkan alpukat dan tomat, siram dengan dressing. Sajikan segera." },
    ],
  },
];
