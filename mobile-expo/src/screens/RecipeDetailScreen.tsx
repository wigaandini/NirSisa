import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChefAIStackParamList } from "../navigation/AppNavigator";
import { api, extractApiError } from "../services/api";
import {
  InventoryItemResponse,
  ReconciliationRequest,
  ReconciliationResponse,
} from "../types/api";
import { capitalizeEachWord } from "../utils/formatters";

const LOGO_IMAGE = require("../assets/images/logo.png");

type Props = NativeStackScreenProps<ChefAIStackParamList, "RecipeDetail">;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const parseRawList = (raw: string): string[] => {
  if (!raw) return [];
  let parts = raw.split("--").map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) {
    parts = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }

  return parts
    .map((p) => p.replace(/^\d+[.)]\s*/, "").trim())
    .filter((p) => p.length > 0)
    .filter((p) => !/^bahan\s*:?\s*$/i.test(p));
};

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[,;:+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const UNIT_ALIASES: Record<string, string> = {
  gr: "g",
  gram: "g",
  grams: "g",
  ons: "ons",
  kg: "kg",
  kilogram: "kg",
  ml: "ml",
  l: "l",
  liter: "l",
  sdt: "tsp",
  sdm: "tbsp",
  tsp: "tsp",
  tbsp: "tbsp",
  butir: "pcs",
  buah: "pcs",
  pcs: "pcs",
  pc: "pcs",
  batang: "batang",
  btg: "batang",
  siung: "siung",
  ikat: "ikat",
};

type UnitGroup = "weight" | "volume" | "count" | "other";

const normalizeUnit = (unit?: string | null): string | null => {
  if (!unit) return null;
  return UNIT_ALIASES[normalizeText(unit)] || normalizeText(unit);
};

const getUnitGroup = (unit: string | null): UnitGroup | null => {
  if (!unit) return null;
  if (["g", "kg", "ons"].includes(unit)) return "weight";
  if (["ml", "l", "tsp", "tbsp"].includes(unit)) return "volume";
  if (["pcs", "batang", "siung", "ikat"].includes(unit)) return "count";
  return "other";
};

const parseFractionNumber = (raw: string): number | null => {
  const value = raw.replace(",", ".").trim();

  if (/^\d+\s+\d+\/\d+$/.test(value)) {
    const [whole, frac] = value.split(" ");
    const [a, b] = frac.split("/").map(Number);
    if (!b) return null;
    return Number(whole) + a / b;
  }

  if (/^\d+\/\d+$/.test(value)) {
    const [a, b] = value.split("/").map(Number);
    if (!b) return null;
    return a / b;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractRequestedAmount = (
  text: string
): { quantity: number | null; unit: string | null } => {
  const normalized = normalizeText(text);

  if (/^secukupnya\b/i.test(normalized)) {
    return { quantity: null, unit: null };
  }

  const match = normalized.match(
    /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?/
  );

  if (!match) {
    return { quantity: null, unit: null };
  }

  return {
    quantity: parseFractionNumber(match[1]),
    unit: normalizeUnit(match[2] || null),
  };
};

const convertToBase = (
  quantity: number,
  unit: string
): { group: UnitGroup; value: number } | null => {
  const group = getUnitGroup(unit);
  if (!group || group === "other") return null;

  if (group === "weight") {
    if (unit === "g") return { group, value: quantity };
    if (unit === "kg") return { group, value: quantity * 1000 };
    if (unit === "ons") return { group, value: quantity * 100 };
  }

  if (group === "volume") {
    if (unit === "ml") return { group, value: quantity };
    if (unit === "l") return { group, value: quantity * 1000 };
    if (unit === "tsp") return { group, value: quantity * 5 };
    if (unit === "tbsp") return { group, value: quantity * 15 };
  }

  if (group === "count") {
    if (["pcs", "batang", "siung", "ikat"].includes(unit)) {
      return { group, value: quantity };
    }
  }

  return null;
};

const convertRequestedToInventoryUnit = (
  quantity: number | null,
  requestedUnit: string | null,
  inventoryUnit: string | null
): number | null => {
  if (quantity === null || !requestedUnit || !inventoryUnit) return null;

  const normalizedInventoryUnit = normalizeUnit(inventoryUnit);
  if (!normalizedInventoryUnit) return null;

  const requestedBase = convertToBase(quantity, requestedUnit);
  const inventoryBasePerUnit = convertToBase(1, normalizedInventoryUnit);

  if (!requestedBase || !inventoryBasePerUnit) return null;
  if (requestedBase.group !== inventoryBasePerUnit.group) return null;

  if (
    requestedBase.group === "count" &&
    normalizeUnit(requestedUnit) !== normalizedInventoryUnit
  ) {
    return null;
  }

  return requestedBase.value / inventoryBasePerUnit.value;
};

const STOPWORDS = new Set([
  "gram",
  "gr",
  "kg",
  "ons",
  "ml",
  "l",
  "liter",
  "sdt",
  "sdm",
  "tsp",
  "tbsp",
  "butir",
  "buah",
  "pcs",
  "pc",
  "batang",
  "siung",
  "ikat",
  "lembar",
  "cm",
  "secukupnya",
  "sesuai",
  "selera",
  "iris",
  "tipis",
  "halus",
  "kasar",
  "potong",
  "buang",
  "kulit",
  "kerasnya",
  "bahan",
  "dan",
  "atau",
]);

const tokenizeIngredient = (text: string): string[] => {
  return normalizeText(text)
    .replace(/[0-9/.,]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
};

const hasWholePhrase = (haystack: string, needle: string): boolean => {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, "i");
  return regex.test(haystack);
};

const scoreInventoryMatch = (
  ingredientText: string,
  inventoryItem: InventoryItemResponse
): number => {
  const ingredientNormalized = normalizeText(ingredientText);
  const inventoryName = normalizeText(
    inventoryItem.item_name_normalized || inventoryItem.item_name || ""
  );

  if (!inventoryName) return 0;

  if (hasWholePhrase(ingredientNormalized, inventoryName)) {
    return 100;
  }

  const ingredientTokens = new Set(tokenizeIngredient(ingredientText));
  const inventoryTokens = tokenizeIngredient(inventoryName);

  if (inventoryTokens.length === 0) return 0;

  const overlap = inventoryTokens.filter((token) => ingredientTokens.has(token)).length;

  if (overlap === 0) return 0;

  const ratio = overlap / inventoryTokens.length;

  if (ratio === 1) return 90;
  if (ratio >= 0.75) return 70;
  return 0;
};

const pickBestInventoryMatch = (
  ingredientText: string,
  inventory: InventoryItemResponse[]
): InventoryItemResponse | null => {
  let best: InventoryItemResponse | null = null;
  let bestScore = 0;

  for (const inv of inventory) {
    const score = scoreInventoryMatch(ingredientText, inv);
    if (score > bestScore) {
      best = inv;
      bestScore = score;
    }
  }

  if (bestScore < 70) return null;
  return best;
};

type IngredientMatchStatus =
  | "safe"
  | "partial"
  | "uncertain"
  | "missing";

interface IngredientView {
  id: string;
  text: string;
  matchedItem: InventoryItemResponse | null;
  requestedQuantity: number | null;
  requestedUnit: string | null;
  quantityToUse: number | null;
  status: IngredientMatchStatus;
  helperText: string;
}

interface StepView {
  id: string;
  number: number;
  text: string;
}

const IngredientRow: React.FC<{ item: IngredientView }> = ({ item }) => {
  let statusStyle = styles.ingredientStatusRed;
  let iconName: keyof typeof Ionicons.glyphMap = "close";

  if (item.status === "safe") {
    statusStyle = styles.ingredientStatusGreen;
    iconName = "checkmark";
  } else if (item.status === "partial" || item.status === "uncertain") {
    statusStyle = styles.ingredientStatusOrange;
    iconName = "alert";
  }

  return (
    <View style={styles.ingredientRow}>
      <View style={styles.ingredientInfo}>
        <Text style={styles.ingredientName}>{item.text}</Text>
        <Text
          style={[
            styles.ingredientSub,
            item.status === "missing" && styles.ingredientSubInsufficient,
            (item.status === "partial" || item.status === "uncertain") &&
              styles.ingredientSubWarning,
          ]}
        >
          {item.helperText}
        </Text>
      </View>
      <View style={[styles.ingredientStatus, statusStyle]}>
        <Ionicons name={iconName} size={16} color="#FFFFFF" />
      </View>
    </View>
  );
};

const StepRow: React.FC<{ item: StepView; isLast: boolean }> = ({ item, isLast }) => (
  <View style={styles.stepRow}>
    <View style={styles.stepLeft}>
      <View style={styles.stepCircle}>
        <Text style={styles.stepNumber}>{item.number}</Text>
      </View>
      {!isLast && <View style={styles.stepLine} />}
    </View>
    <View style={[styles.stepContent, isLast && { marginBottom: 0 }]}>
      <Text style={styles.stepDescription}>{item.text}</Text>
    </View>
  </View>
);

const RecipeDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { recipe } = route.params;

  const [inventory, setInventory] = useState<InventoryItemResponse[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<InventoryItemResponse[]>("/inventory");
        setInventory(res.data || []);
      } catch (err) {
        console.warn("[RecipeDetail] gagal fetch inventory:", extractApiError(err));
      } finally {
        setLoadingInventory(false);
      }
    })();
  }, []);

  const ingredientList: IngredientView[] = useMemo(() => {
    const lines = parseRawList(recipe.ingredients);

    return lines.map((text, idx) => {
      const matched = pickBestInventoryMatch(text, inventory);
      const requested = extractRequestedAmount(text);

      if (!matched) {
        return {
          id: `ing-${idx}`,
          text,
          matchedItem: null,
          requestedQuantity: requested.quantity,
          requestedUnit: requested.unit,
          quantityToUse: null,
          status: "missing",
          helperText: "Tidak ada match stok yang aman",
        };
      }

      const stockUnit = normalizeUnit(matched.unit);
      const quantityToUse = convertRequestedToInventoryUnit(
        requested.quantity,
        requested.unit,
        stockUnit
      );

      // Jika ada match nama bahan, tapi jumlah/satuan tidak bisa divalidasi,
      // tetap dianggap boleh lanjut masak. Hanya saja stok tidak dikurangi otomatis.
      if (quantityToUse === null) {
        return {
          id: `ing-${idx}`,
          text,
          matchedItem: matched,
          requestedQuantity: requested.quantity,
          requestedUnit: requested.unit,
          quantityToUse: null,
          status: "partial",
          helperText: `Bahan cocok ke ${capitalizeEachWord(
            matched.item_name
          )}, tetapi jumlah/satuan belum bisa dipotong otomatis`,
        };
      }

      if (quantityToUse > matched.quantity) {
        return {
          id: `ing-${idx}`,
          text,
          matchedItem: matched,
          requestedQuantity: requested.quantity,
          requestedUnit: requested.unit,
          quantityToUse: null,
          status: "partial",
          helperText: `Bahan cocok ke ${capitalizeEachWord(
            matched.item_name
          )}, tetapi stok tidak cukup untuk potong otomatis`,
        };
      }

      return {
        id: `ing-${idx}`,
        text,
        matchedItem: matched,
        requestedQuantity: requested.quantity,
        requestedUnit: requested.unit,
        quantityToUse,
        status: "safe",
        helperText: `Akan pakai ${quantityToUse.toFixed(2)} ${matched.unit || ""} dari stok ${
          matched.quantity
        } ${matched.unit || ""}`,
      };
    });
  }, [recipe.ingredients, inventory]);

  const stepList: StepView[] = useMemo(() => {
    return parseRawList(recipe.steps).map((text, idx) => ({
      id: `step-${idx}`,
      number: idx + 1,
      text,
    }));
  }, [recipe.steps]);

  const payloadIngredients = useMemo(() => {
    const aggregated = new Map<
      string,
      { item_id: string; quantity_used: number; item_name: string; unit: string | null }
    >();

    ingredientList
      .filter(
        (item) =>
          item.status === "safe" &&
          item.matchedItem &&
          item.quantityToUse !== null
      )
      .forEach((item) => {
        const key = item.matchedItem!.id;
        const current = aggregated.get(key);

        if (current) {
          current.quantity_used += item.quantityToUse!;
        } else {
          aggregated.set(key, {
            item_id: item.matchedItem!.id,
            quantity_used: item.quantityToUse!,
            item_name: item.matchedItem!.item_name,
            unit: item.matchedItem!.unit || null,
          });
        }
      });

    return Array.from(aggregated.values());
  }, [ingredientList]);

  const hasAnyMatchedIngredients = ingredientList.some((item) => item.matchedItem !== null);
  const hasAnyValidatedIngredients = payloadIngredients.length > 0;
  const hasIssues = ingredientList.some((item) => item.status !== "safe");

  const handleKonfirmasiMasak = async () => {
    if (!hasAnyMatchedIngredients) {
      Alert.alert(
        "Belum Bisa Dikonfirmasi",
        "Belum ada bahan resep yang cocok dengan stok Anda. Tambahkan minimal satu bahan yang relevan ke stok terlebih dahulu."
      );
      return;
    }

    const summary =
      payloadIngredients.length > 0
        ? payloadIngredients
            .map(
              (it) =>
                `• ${capitalizeEachWord(it.item_name)} (${it.quantity_used.toFixed(2)} ${
                  it.unit || "unit"
                })`
            )
            .join("\n")
        : "• Tidak ada bahan yang bisa dipotong otomatis dari stok";

    const note = hasIssues
      ? "\n\nCatatan: bahan yang tidak cocok, ambigu, atau stoknya tidak cukup tetap tidak akan menghalangi konfirmasi masak. Hanya bahan yang tervalidasi yang akan dipotong otomatis."
      : "";

    Alert.alert(
      "Konfirmasi Masak",
      `Anda tetap bisa konfirmasi masak meskipun tidak semua bahan tersedia.\n\nYang akan diproses dari stok:\n\n${summary}${note}\n\nLanjutkan?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya, Masak",
          style: "destructive",
          onPress: doReconcile,
        },
      ]
    );
  };

  const doReconcile = async () => {
    setReconciling(true);

    try {
      const payload: ReconciliationRequest = {
        recipe_id: null,
        recipe_title: recipe.title,
        ingredients_used: payloadIngredients.map((it) => ({
          item_id: it.item_id,
          quantity_used: Number(it.quantity_used.toFixed(4)),
        })),
      };

      const res = await api.post<ReconciliationResponse>("/inventory/reconcile", payload);
      const data = res.data;

      const updatedCount = data.items_updated.length;
      const removedCount = data.items_removed.length;
      const totalConsumed = updatedCount + removedCount;

      const stockMessage =
        totalConsumed > 0
          ? `${totalConsumed} bahan diproses dari stok.\n${updatedCount} bahan dikurangi, ${removedCount} bahan habis.`
          : "Riwayat masak tersimpan, tetapi tidak ada bahan stok yang dipotong otomatis.";

      Alert.alert(
        "Berhasil Masak! 🎉",
        `${stockMessage}\n\nResep tersimpan di Riwayat.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      const msg = extractApiError(err);
      Alert.alert("Gagal", `Tidak bisa memproses: ${msg}`);
    } finally {
      setReconciling(false);
    }
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#2B2B2B" />
          </TouchableOpacity>
          <Image source={LOGO_IMAGE} style={styles.logoSmall} resizeMode="contain" />
          <TouchableOpacity style={styles.heartButton}>
            <Ionicons name="heart-outline" size={22} color="#2B2B2B" />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>{capitalizeEachWord(recipe.title)}</Text>

        <View style={styles.matchBanner}>
          <Ionicons name="sparkles" size={16} color="#BB0009" />
          <Text style={styles.matchBannerText}>
            {recipe.match_percentage.toFixed(0)}% bahan Anda cocok • Skor final{" "}
            {(recipe.final_score * 100).toFixed(0)}%
          </Text>
        </View>

        {hasIssues && (
          <View style={styles.warningBanner}>
            <Ionicons
              name="information-circle"
              size={20}
              color="#D97706"
              style={styles.warningIcon}
            />
            <Text style={styles.warningText}>
              Anda tetap bisa konfirmasi masak walaupun ada bahan yang belum terpenuhi.
              Hanya bahan yang tervalidasi otomatis yang akan dikurangi dari stok.
            </Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bahan-Bahan</Text>
          <Text style={styles.sectionMeta}>{ingredientList.length} item total</Text>
        </View>

        {loadingInventory ? (
          <ActivityIndicator color="#BB0009" style={{ marginVertical: 20 }} />
        ) : (
          <View style={styles.card}>
            {ingredientList.map((item, index) => (
              <View key={item.id}>
                <IngredientRow item={item} />
                {index < ingredientList.length - 1 && <View style={styles.separator} />}
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 28, marginBottom: 16 }]}>
          Langkah-Langkah
        </Text>
        <View style={styles.card}>
          {stepList.map((step, index) => (
            <StepRow key={step.id} item={step} isLast={index === stepList.length - 1} />
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            (!hasAnyMatchedIngredients || reconciling) && { opacity: 0.6 },
          ]}
          activeOpacity={0.85}
          onPress={handleKonfirmasiMasak}
          disabled={!hasAnyMatchedIngredients || reconciling}
        >
          {reconciling ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmButtonText}>Konfirmasi Masak</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  logoSmall: {
    width: 56,
    height: 32,
  },
  heartButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: "#2B2B2B",
    lineHeight: 36,
    marginBottom: 12,
  },
  matchBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  matchBannerText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: "#BB0009",
    letterSpacing: 0.3,
  },
  warningBanner: {
    flexDirection: "row",
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 14,
    marginBottom: 24,
    alignItems: "flex-start",
  },
  warningIcon: {
    marginRight: 10,
    marginTop: 1,
  },
  warningText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#92400E",
    lineHeight: 19,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#2B2B2B",
  },
  sectionMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#949FA2",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#2B2B2B",
    marginBottom: 2,
  },
  ingredientSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#949FA2",
  },
  ingredientSubInsufficient: {
    color: "#BB0009",
  },
  ingredientSubWarning: {
    color: "#D97706",
  },
  ingredientStatus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ingredientStatusGreen: {
    backgroundColor: "#15803D",
  },
  ingredientStatusRed: {
    backgroundColor: "#BB0009",
  },
  ingredientStatusOrange: {
    backgroundColor: "#D97706",
  },
  separator: {
    height: 1,
    backgroundColor: "#F5F5F5",
    marginLeft: 0,
  },
  stepRow: {
    flexDirection: "row",
    paddingTop: 16,
  },
  stepLeft: {
    alignItems: "center",
    width: 32,
    marginRight: 14,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#BB0009",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  stepLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#F0F0F0",
    marginTop: 6,
    marginBottom: 0,
    minHeight: 20,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 20,
  },
  stepDescription: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#656C6E",
    lineHeight: 19,
    marginTop: 6,
  },
  bottomBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  confirmButton: {
    backgroundColor: "#BB0009",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  confirmButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});

export default RecipeDetailScreen;