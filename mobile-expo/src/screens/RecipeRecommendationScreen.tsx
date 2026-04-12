import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChefAIStackParamList, RootStackParamList } from "../navigation/AppNavigator";
import FilterModal, { DEFAULT_FILTER, FilterState, RangeOption } from "../components/FilterModal";
import { RECIPES, Recipe, RecipeStatus } from "../data/recipes";

const LOGO_IMAGE = require("../assets/images/logo.png");

type Props = NativeStackScreenProps<ChefAIStackParamList, "RecipeRecommendation">;

const STATUS_CONFIG: Record<
  RecipeStatus,
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

function applyFilter(recipes: Recipe[], filter: FilterState, search: string): Recipe[] {
  let result = recipes.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchesSteps = matchesRange(r.steps, filter.stepsRange);
    const matchesIngredients = matchesRange(r.ingredients, filter.ingredientsRange);
    return matchesSearch && matchesSteps && matchesIngredients;
  });

  if (filter.sortBy === "fastest_steps") {
    result = [...result].sort((a, b) => a.steps - b.steps);
  } else if (filter.sortBy === "min_ingredients") {
    result = [...result].sort((a, b) => a.ingredients - b.ingredients);
  } else if (filter.sortBy === "most_popular") {
    result = [...result].sort((a, b) => b.likes - a.likes);
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

const RecipeRecommendationScreen: React.FC<Props> = ({ navigation }) => {
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [search, setSearch] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterState>(DEFAULT_FILTER);

  const filteredRecipes = applyFilter(RECIPES, activeFilter, search);
  const filterActive = isFilterActive(activeFilter);

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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

        {/* Recipe Cards */}
        {filteredRecipes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={40} color="#BFD3D6" />
            <Text style={styles.emptyText}>Tidak ada menu yang ditemukan</Text>
          </View>
        ) : (
          filteredRecipes.map((recipe) => {
            const config = STATUS_CONFIG[recipe.status];
            return (
              <TouchableOpacity
                key={recipe.id}
                style={[
                  styles.recipeCard,
                  { borderLeftColor: config.borderColor, backgroundColor: config.bgColor },
                ]}
                activeOpacity={0.75}
                onPress={() => navigation.navigate("RecipeDetail", { recipeId: recipe.id })}
              >
                {/* Status Badge */}
                <View style={[styles.statusBadge, { backgroundColor: config.badgeColor }]}>
                  <Text style={styles.statusBadgeText}>{config.label}</Text>
                </View>

                {/* Recipe Name */}
                <Text style={styles.recipeName}>{recipe.name}</Text>

                {/* Description */}
                <Text style={styles.recipeDescription} numberOfLines={2}>
                  {recipe.description}
                </Text>

                {/* Meta Row */}
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="list-outline" size={14} color="#656C6E" />
                    <Text style={styles.metaText}>{recipe.steps} Tahap</Text>
                  </View>
                  <View style={styles.metaDivider} />
                  <View style={styles.metaItem}>
                    <Ionicons name="cube-outline" size={14} color="#656C6E" />
                    <Text style={styles.metaText}>{recipe.ingredients} Bahan</Text>
                  </View>
                  <View style={styles.metaDivider} />
                  <View style={styles.metaItem}>
                    <Ionicons name="heart" size={14} color="#BB0009" />
                    <Text style={styles.metaText}>{recipe.likes} Suka</Text>
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
    marginBottom: 24,
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
  },
});

export default RecipeRecommendationScreen;
