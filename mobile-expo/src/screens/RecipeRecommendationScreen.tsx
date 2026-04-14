import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChefAIStackParamList, RootStackParamList } from "../navigation/AppNavigator";
import FilterModal, { DEFAULT_FILTER, FilterState, RangeOption } from "../components/FilterModal";
// ▼▼▼ FIX: ganti dummy data ke API client + types ▼▼▼
import { api, extractApiError } from "../services/api";
import { RecommendationItem, RecommendationResponse } from "../types/api";
import { capitalizeEachWord } from "../utils/formatters";
// ▲▲▲

const LOGO_IMAGE = require("../assets/images/logo.png");

type Props = NativeStackScreenProps<ChefAIStackParamList, "RecipeRecommendation">;

// ─────────────────────────────────────────────────────────────────────────────
// STATUS DERIVATION
// Sebelumnya pakai dummy `recipe.status`. Sekarang derive dari spi_score yang
// sudah dihitung backend. Threshold di-tune supaya konsisten dengan freshness
// status di backend (spi.py).
// ─────────────────────────────────────────────────────────────────────────────
type DerivedStatus = "expired_soon" | "approaching" | "fresh";

const deriveStatus = (item: RecommendationItem): DerivedStatus => {
  if (item.spi_score >= 0.5) return "expired_soon";
  if (item.spi_score >= 0.15) return "approaching";
  return "fresh";
};

const STATUS_CONFIG: Record<
  DerivedStatus,
  { label: string; badgeColor: string; borderColor: string; bgColor: string }
> = {
  expired_soon: {
    label: "BAHAN AKAN KEDALUWARSA",
    badgeColor: "#BB0009",
    borderColor: "#BB0009",
    bgColor: "#FEF2F2",
  },
  approaching: {
    label: "BAHAN MENDEKATI KEDALUWARSA",
    badgeColor: "#D97706",
    borderColor: "#F59E0B",
    bgColor: "#FFFBEB",
  },
  fresh: {
    label: "SEGAR",
    badgeColor: "#15803D",
    borderColor: "#15803D",
    bgColor: "#F0FDF4",
  },
};

function matchesRange(value: number, range: RangeOption | null): boolean {
  if (!range) return true;
  if (range === ">10") return value > 10;
  if (range === "5-10") return value > 5 && value < 10;
  if (range === "<5") return value < 5;
  return true;
}

function applyFilter(
  recipes: RecommendationItem[],
  filter: FilterState,
  search: string
): RecommendationItem[] {
  let result = recipes.filter((r) => {
    const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase());
    const matchesSteps = matchesRange(r.total_steps, filter.stepsRange);
    const matchesIngredients = matchesRange(r.total_ingredients, filter.ingredientsRange);
    return matchesSearch && matchesSteps && matchesIngredients;
  });

  if (filter.sortBy === "fastest_steps") {
    result = [...result].sort((a, b) => a.total_steps - b.total_steps);
  } else if (filter.sortBy === "min_ingredients") {
    result = [...result].sort((a, b) => a.total_ingredients - b.total_ingredients);
  } else if (filter.sortBy === "most_popular") {
    result = [...result].sort((a, b) => b.loves - a.loves);
  }
  // Default: tetap urut sesuai final_score dari backend (sudah re-ranked oleh SPI)
  return result;
}

function isFilterActive(filter: FilterState): boolean {
  return (
    filter.sortBy !== null ||
    filter.stepsRange !== null ||
    filter.ingredientsRange !== null
  );
}

const RecipeRecommendationScreen: React.FC<Props> = ({ navigation }) => {
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [search, setSearch] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterState>(DEFAULT_FILTER);

  // ▼▼▼ FIX: state untuk hasil API ▼▼▼
  const [recipes, setRecipes] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ latencyMs: number; spiWeight: number } | null>(null);

  const fetchRecommendations = useCallback(async () => {
    try {
      setErrorMsg(null);
      const res = await api.get<RecommendationResponse>("/recommend", {
        params: { top_k: 20 },
      });
      setRecipes(res.data.recommendations || []);
      setMeta({ latencyMs: res.data.latency_ms, spiWeight: res.data.spi_weight });
    } catch (err) {
      const msg = extractApiError(err);
      console.warn("[RecipeRecommendation] fetch error:", msg);
      // 400 dari backend = inventaris kosong → tampilkan empty state, bukan error
      if (msg.toLowerCase().includes("inventaris kosong")) {
        setRecipes([]);
        setErrorMsg("Stok bahan kosong. Tambahkan bahan di tab Stok dulu.");
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh saat halaman dibuka (mis. setelah user nambah bahan baru)
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchRecommendations();
    }, [fetchRecommendations])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecommendations();
  };

  const filteredRecipes = applyFilter(recipes, activeFilter, search);
  const filterActive = isFilterActive(activeFilter);

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#BB0009" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Image source={LOGO_IMAGE} style={styles.logoSmall} resizeMode="contain" />
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notifButton} onPress={() => rootNavigation.navigate("Notification")}>
              <Ionicons name="notifications-outline" size={22} color="#2B2B2B" />
            </TouchableOpacity>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color="#FFFFFF" />
            </View>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Rekomendasi Menu</Text>
        <Text style={styles.subtitle}>
          Pilihan cerdas untuk kurangi sisa makanan hari ini.
        </Text>

        {/* Meta info dari AI engine */}
        {meta && !loading && recipes.length > 0 && (
          <View style={styles.metaBanner}>
            <Ionicons name="sparkles" size={12} color="#BB0009" />
            <Text style={styles.metaBannerText}>
              {recipes.length} resep • {meta.latencyMs.toFixed(0)}ms • SPI weight {meta.spiWeight}
            </Text>
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={18} color="#949FA2" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari menu..."
              placeholderTextColor="#BFD3D6"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity
            style={[styles.filterButton, filterActive && styles.filterButtonActive]}
            onPress={() => setFilterVisible(true)}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={filterActive ? "#FFFFFF" : "#2B2B2B"}
            />
          </TouchableOpacity>
        </View>

        {/* Active filter indicator */}
        {filterActive && (
          <View style={styles.filterBadgeRow}>
            <Ionicons name="funnel" size={13} color="#BB0009" />
            <Text style={styles.filterBadgeText}>Filter aktif</Text>
            <TouchableOpacity
              onPress={() => setActiveFilter(DEFAULT_FILTER)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.filterBadgeClear}>Hapus</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading / Error / Empty / Cards */}
        {loading ? (
          <ActivityIndicator size="large" color="#BB0009" style={{ marginTop: 40 }} />
        ) : errorMsg ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={40} color="#BFD3D6" />
            <Text style={styles.emptyText}>{errorMsg}</Text>
          </View>
        ) : filteredRecipes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={40} color="#BFD3D6" />
            <Text style={styles.emptyText}>Tidak ada menu yang ditemukan</Text>
          </View>
        ) : (
          filteredRecipes.map((recipe) => {
            const status = deriveStatus(recipe);
            const config = STATUS_CONFIG[status];
            return (
              <TouchableOpacity
                key={recipe.index}
                style={[
                  styles.recipeCard,
                  { borderLeftColor: config.borderColor, backgroundColor: config.bgColor },
                ]}
                activeOpacity={0.75}
                // ▼▼▼ FIX: pass full recipe object via params ▼▼▼
                onPress={() => navigation.navigate("RecipeDetail", { recipe })}
                // ▲▲▲
              >
                {/* Status Badge */}
                <View style={[styles.statusBadge, { backgroundColor: config.badgeColor }]}>
                  <Text style={styles.statusBadgeText}>{config.label}</Text>
                </View>

                {/* Recipe Name (capitalized) */}
                <Text style={styles.recipeName}>{capitalizeEachWord(recipe.title)}</Text>

                {/* Match percentage + explanation */}
                <Text style={styles.recipeDescription} numberOfLines={2}>
                  {recipe.explanation || `${recipe.match_percentage.toFixed(0)}% bahan Anda cocok dengan resep ini.`}
                </Text>

                {/* Score breakdown (XAI) */}
                <View style={styles.scoreRow}>
                  <View style={styles.scorePill}>
                    <Text style={styles.scorePillLabel}>COSINE</Text>
                    <Text style={styles.scorePillValue}>{(recipe.cosine_score * 100).toFixed(0)}%</Text>
                  </View>
                  <View style={styles.scorePill}>
                    <Text style={styles.scorePillLabel}>SPI</Text>
                    <Text style={styles.scorePillValue}>{(recipe.spi_score * 100).toFixed(0)}%</Text>
                  </View>
                  <View style={[styles.scorePill, styles.scorePillFinal]}>
                    <Text style={[styles.scorePillLabel, { color: "#BB0009" }]}>FINAL</Text>
                    <Text style={[styles.scorePillValue, { color: "#BB0009" }]}>
                      {(recipe.final_score * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>

                {/* Meta Row */}
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="list-outline" size={14} color="#656C6E" />
                    <Text style={styles.metaText}>{recipe.total_steps} Tahap</Text>
                  </View>
                  <View style={styles.metaDivider} />
                  <View style={styles.metaItem}>
                    <Ionicons name="cube-outline" size={14} color="#656C6E" />
                    <Text style={styles.metaText}>{recipe.total_ingredients} Bahan</Text>
                  </View>
                  <View style={styles.metaDivider} />
                  <View style={styles.metaItem}>
                    <Ionicons name="heart" size={14} color="#BB0009" />
                    <Text style={styles.metaText}>{recipe.loves} Suka</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Filter Modal */}
      <FilterModal
        visible={filterVisible}
        initialFilter={activeFilter}
        onApply={setActiveFilter}
        onClose={() => setFilterVisible(false)}
      />
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  logoSmall: {
    width: 56,
    height: 32,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  notifButton: {
    padding: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#36393B",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: "#2B2B2B",
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#656C6E",
    lineHeight: 20,
    marginBottom: 16,
  },
  metaBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  metaBannerText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "#BB0009",
    letterSpacing: 0.3,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#2B2B2B",
    height: 48,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonActive: {
    backgroundColor: "#BB0009",
    borderColor: "#BB0009",
  },
  filterBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  filterBadgeText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#BB0009",
    flex: 1,
  },
  filterBadgeClear: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#BB0009",
  },
  recipeCard: {
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  statusBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  recipeName: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#2B2B2B",
    marginBottom: 4,
  },
  recipeDescription: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#656C6E",
    lineHeight: 18,
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  scorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scorePillFinal: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  scorePillLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: "#949FA2",
    letterSpacing: 0.3,
  },
  scorePillValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#2B2B2B",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#656C6E",
  },
  metaDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#BFD3D6",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#949FA2",
    textAlign: "center",
    paddingHorizontal: 24,
  },
});

export default RecipeRecommendationScreen;