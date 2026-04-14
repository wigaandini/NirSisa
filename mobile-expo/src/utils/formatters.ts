// ============================================================
// Text Formatters
// Dipakai untuk menyamakan cara display teks di seluruh app.
// Data di DB disimpan lowercase (hasil normalizer backend),
// lalu di-capitalize hanya saat render.
// ============================================================

/**
 * Ubah string ke "Capitalize Each Word".
 * Juga mengganti underscore dengan spasi (berguna untuk category_name
 * dari tabel ingredient_categories seperti "daging_sapi" -> "Daging Sapi").
 *
 * Contoh:
 *   capitalizeEachWord("wortel")        -> "Wortel"
 *   capitalizeEachWord("bawang merah")  -> "Bawang Merah"
 *   capitalizeEachWord("daging_sapi")   -> "Daging Sapi"
 *   capitalizeEachWord("")              -> ""
 *   capitalizeEachWord(null)            -> ""
 */
export const capitalizeEachWord = (input?: string | null): string => {
  if (!input) return "";

  return input
    .toString()
    .replace(/_/g, " ")          // daging_sapi -> daging sapi
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) =>
      word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
};

/**
 * Versi khusus untuk nama kategori: sama seperti capitalizeEachWord
 * tapi dengan fallback label kalau kategori NULL / kosong.
 */
export const formatCategoryLabel = (
  name?: string | null,
  fallback: string = "Lain-lain"
): string => {
  if (!name || !name.trim()) return fallback;
  return capitalizeEachWord(name);
};