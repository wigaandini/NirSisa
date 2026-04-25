import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  RefreshControl,
  InteractionManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChefAIStackParamList, RootStackParamList } from "../navigation/AppNavigator";
import FilterModal, { DEFAULT_FILTER, FilterState, RangeOption } from "../components/FilterModal";
import Header from "../components/Header";
import { api, extractApiError } from "../services/api";
import { RecommendationItem, RecommendationResponse } from "../types/api";
import { capitalizeEachWord } from "../utils/formatters";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<ChefAIStackParamList, "RecipeRecommendation">;

type DerivedStatus = "expired_soon" | "approaching" | "fresh";

/**
 * Logika penentuan status berdasarkan skor SPI (0.0 - 1.0)
 * Kita naikkan threshold agar bahan segar tidak langsung jadi merah.
 */
const deriveStatus = (item: RecommendationItem): DerivedStatus => {
  // Jika SPI sangat tinggi (di atas 0.8), berarti ada bahan yang kritis/kedaluwarsa
  if (item.spi_score >= 0.8) return "expired_soon";
  // Jika SPI sedang (di atas 0.4), berarti ada bahan mendekati kedaluwarsa
  if (item.spi_score >= 0.4) return "approaching";
  // Selain itu dianggap segar
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
  if (range === "5-10") return value >= 5 && value <= 10;
  if (range === "<5") return value < 5;
  return true;
}

// FIX: Tambahkan parameter searchQuery agar tidak error (3 argumen)
function applyFilter(
  recipes: RecommendationItem[],
  filter: FilterState,
  searchQuery: string
): RecommendationItem[] {
  let result = recipes.filter((r) => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSteps = matchesRange(r.total_steps, filter.stepsRange);
    const matchesIngredients = matchesRange(r.total_ingredients, filter.ingredientsRange);
    return matchesSearch && matchesSteps && matchesIngredients;
  });

  if (filter.sortBy === "fastest_steps") {
    result = [...result].sort((a, b) => a.total_steps - b.total_steps);
  } else if (filter.sortBy === "min_ingredients") {
    result = [...result].sort((a, b) => a.total_ingredients - b.total_ingredients);
  } else if (filter.sortBy === "most_popular") {
    result = [...result].sort((a, b) => (b.loves ?? 0) - (a.loves ?? 0));
  }
  return result;
}

function isFilterActive(filter: FilterState): boolean {
  return (
    filter.sortBy !== null ||
    filter.stepsRange !== null ||
    filter.ingredientsRange !== null
  );
}

const RecipeRecommendationScreen: React.FC<Props> = ({ navigation, route }) => {
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { photoUri } = useAuth();
  const [search, setSearch] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterState>(DEFAULT_FILTER);

  const [recipes, setRecipes] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ latencyMs: number; spiWeight: number } | null>(null);
  const [isPopularMode, setIsPopularMode] = useState(false);

  const fetchPopularFallback = useCallback(async () => {
    try {
      const res = await api.get("/recipes/popular", { params: { limit: 10 } });
      const popularRecipes: RecommendationItem[] = (res.data || []).map(
        (r: any, idx: number) => ({
          index: r.id ?? idx,
          title: r.title || "",
          ingredients: r.ingredients || "",
          ingredients_cleaned: r.ingredients_cleaned || "",
          steps: r.steps || "",
          loves: r.loves || 0,
          url: r.url || null,
          category: r.category_name || null,
          total_ingredients: r.total_ingredients || 0,
          total_steps: r.total_steps || 0,
          cosine_score: 0,
          spi_score: 0,
          final_score: 0,
          match_percentage: 0,
          explanation: null,
        })
      );
      setRecipes(popularRecipes);
      setIsPopularMode(true);
      setErrorMsg(null);
    } catch (fallbackErr) {
      setRecipes([]);
      setIsPopularMode(false);
    }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    try {
      setErrorMsg(null);
      // Tambahkan timestamp atau no-cache jika API terasa statis
      const res = await api.get<RecommendationResponse>("/recommend", {
        params: { top_k: 20, _t: Date.now() },
      });
      
      console.log("[AI] SPI Weight received:", res.data.spi_weight);
      
      setRecipes(res.data.recommendations || []);
      setMeta({ latencyMs: res.data.latency_ms, spiWeight: res.data.spi_weight });
      setIsPopularMode(false);
    } catch (err) {
      const msg = extractApiError(err);
      if (msg.toLowerCase().includes("inventaris kosong")) {
        setMeta(null);
        await fetchPopularFallback();
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchPopularFallback]);

  const pendingRecipeRef = useRef(route.params?.pendingRecipe);
  pendingRecipeRef.current = route.params?.pendingRecipe;

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchRecommendations();

      const pending = pendingRecipeRef.current;
      if (!pending) return;

      const task = InteractionManager.runAfterInteractions(() => {
        navigation.push("RecipeDetail", { recipe: pending });
        navigation.setParams({ pendingRecipe: undefined } as any);
      });
      return () => task.cancel();
    }, [fetchRecommendations, navigation])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecommendations();
  };

  // filteredRecipes sekarang menggunakan 3 argumen secara benar
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
        <Header
          onNotificationPress={() => rootNavigation.navigate("Notification")}
          onAvatarPress={() => rootNavigation.navigate("Main", { screen: "Profil" } as any)}
          photoUri={photoUri}
        />

        <Text style={[styles.title, loading && recipes.length === 0 && { opacity: 0 }]}>
          {isPopularMode ? "Resep Populer" : "Rekomendasi Menu"}
        </Text>
        <Text style={[styles.subtitle, loading && recipes.length === 0 && { opacity: 0 }]}>
          {isPopularMode
            ? "Tambahkan bahan di tab Stok untuk rekomendasi yang lebih personal."
            : "Pilihan cerdas untuk kurangi sisa makanan hari ini."}
        </Text>

        {isPopularMode && !loading && recipes.length > 0 && (
          <View style={styles.popularBanner}>
            <Ionicons name="trending-up" size={16} color="#D97706" />
            <Text style={styles.popularBannerText}>
              Menampilkan resep populer. Tambah bahan di Stok untuk rekomendasi AI.
            </Text>
          </View>
        )}

        {meta && !loading && recipes.length > 0 && !isPopularMode && (
          <View style={styles.metaBanner}>
            <Ionicons name="sparkles" size={12} color="#BB0009" />
            <Text style={styles.metaBannerText}>
              {recipes.length} resep • {meta.latencyMs.toFixed(0)}ms • SPI weight {meta.spiWeight.toFixed(2)}
            </Text>
          </View>
        )}

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

        {filterActive && (
          <View style={styles.filterBadgeRow}>
            <Ionicons name="funnel" size={13} color="#BB0009" />
            <Text style={styles.filterBadgeText}>Filter aktif</Text>
            <TouchableOpacity onPress={() => setActiveFilter(DEFAULT_FILTER)}>
              <Text style={styles.filterBadgeClear}>Hapus</Text>
            </TouchableOpacity>
          </View>
        )}

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
            const config = isPopularMode
              ? { label: "POPULER", badgeColor: "#D97706", borderColor: "#F59E0B", bgColor: "#FFFBEB" }
              : STATUS_CONFIG[status];
              
            return (
              <TouchableOpacity
                key={recipe.index}
                style={[
                  styles.recipeCard,
                  { borderLeftColor: config.borderColor, backgroundColor: config.bgColor },
                ]}
                activeOpacity={0.75}
                onPress={() => navigation.navigate("RecipeDetail", { recipe })}
              >
                <View style={[styles.statusBadge, { backgroundColor: config.badgeColor }]}>
                  <Text style={styles.statusBadgeText}>{config.label}</Text>
                </View>

                <Text style={styles.recipeName}>{capitalizeEachWord(recipe.title)}</Text>

                <Text style={styles.recipeDescription} numberOfLines={2}>
                  {isPopularMode
                    ? `${recipe.loves} orang menyukai resep ini.`
                    : status === "fresh"
                      ? `${recipe.match_percentage.toFixed(0)}% bahan Anda cocok. Menu sehat dan segar!`
                      : recipe.explanation || `${recipe.match_percentage.toFixed(0)}% bahan cocok.`
                  }
                </Text>

                {/* Score breakdown — Sembunyikan jika mode populer atau SPI 0 (segar sekali) */}
                {!isPopularMode && recipe.spi_score > 0 && (
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
                )}

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
  flex: { flex: 1, backgroundColor: "#FAFAFA" },
  scrollContent: { paddingHorizontal: 24, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 20 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, color: "#2B2B2B", marginBottom: 6 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: "#656C6E", marginBottom: 28 },
  popularBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFBEB", padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: "#FEF3C7" },
  popularBannerText: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#B45309", marginLeft: 8 },
  metaBanner: { flexDirection: "row", alignItems: "center", marginBottom: 16, backgroundColor: "#F3F4F6", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, alignSelf: "flex-start" },
  metaBannerText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#6B7280", marginLeft: 6 },
  searchRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  searchContainer: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E8E8E8", paddingHorizontal: 12, height: 48 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, color: "#2B2B2B" },
  filterButton: { width: 48, height: 48, backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E8E8E8", alignItems: "center", justifyContent: "center" },
  filterButtonActive: { backgroundColor: "#BB0009", borderColor: "#BB0009" },
  filterBadgeRow: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 8 },
  filterBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#BB0009" },
  filterBadgeClear: { fontFamily: "Inter_700Bold", fontSize: 12, color: "#656C6E", textDecorationLine: "underline" },
  recipeCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderLeftWidth: 6, borderColor: "#F0F0F0", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 12 },
  statusBadgeText: { fontFamily: "Inter_700Bold", fontSize: 10, color: "#FFFFFF" },
  recipeName: { fontFamily: "Inter_700Bold", fontSize: 18, color: "#2B2B2B", marginBottom: 8 },
  recipeDescription: { fontFamily: "Inter_400Regular", fontSize: 13, color: "#656C6E", lineHeight: 19, marginBottom: 16 },
  scoreRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  scorePill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.05)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  scorePillFinal: { backgroundColor: "rgba(187, 0, 9, 0.1)" },
  scorePillLabel: { fontFamily: "Inter_700Bold", fontSize: 9, color: "#656C6E" },
  scorePillValue: { fontFamily: "Inter_700Bold", fontSize: 11, color: "#2B2B2B" },
  metaRow: { flexDirection: "row", alignItems: "center", paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.05)" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#656C6E" },
  metaDivider: { width: 1, height: 14, backgroundColor: "#E8E8E8", marginHorizontal: 12 },
  emptyState: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#949FA2", textAlign: "center" },
});

export default RecipeRecommendationScreen;