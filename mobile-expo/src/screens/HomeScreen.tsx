import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { supabase } from "../services/supabase";
import { api, extractApiError } from "../services/api";
import { RecommendationItem, RecommendationResponse } from "../types/api";
import { capitalizeEachWord } from "../utils/formatters";

const LOGO_IMAGE = require("../assets/images/logo.png");

interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  days_remaining: number;
  freshness_status: "fresh" | "warning" | "critical";
}

const normalizeTitle = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("User");
  const [expiringItems, setExpiringItems] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<RecommendationItem[]>([]);
  const [totalStock, setTotalStock] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchInitialData();
    }, [])
  );

  const fetchInitialData = async () => {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        console.log("LOGGED IN USER ID:", user.id);
      }

      if (!user) {
        setRecipes([]);
        setExpiringItems([]);
        setTotalStock(0);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      if (profile?.display_name) {
        setUserName(profile.display_name);
      }

      const { count } = await supabase
        .from("inventory_stock")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gt("quantity", 0);

      const currentTotal = count || 0;
      setTotalStock(currentTotal);

      const { data: stock } = await supabase
        .from("inventory_stock")
        .select("*")
        .eq("user_id", user.id)
        .gt("quantity", 0)
        .order("expiry_date", { ascending: true })
        .limit(3);

      const processedStock = (stock || []).map((item) => {
        const expiryDate = item.expiry_date ? new Date(item.expiry_date) : null;
        const now = new Date();

        const days = expiryDate
          ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24))
          : 9999;

        return {
          ...item,
          days_remaining: days,
          freshness_status: days <= 2 ? "critical" : days <= 5 ? "warning" : "fresh",
        };
      });

      setExpiringItems(processedStock);

      const { data: cookedHistory, error: cookedHistoryError } = await supabase
        .from("consumption_history")
        .select("recipe_title")
        .eq("user_id", user.id);

      if (cookedHistoryError) {
        console.warn("Gagal fetch consumption_history:", cookedHistoryError.message);
      }

      const cookedTitles = new Set(
        (cookedHistory || [])
          .map((item: { recipe_title: string | null }) => item.recipe_title)
          .filter((title): title is string => Boolean(title))
          .map((title) => normalizeTitle(title))
      );

      if (currentTotal > 0) {
        try {
          const res = await api.get<RecommendationResponse>("/recommend", {
            params: { top_k: 8 },
          });

          const recommendations = res.data.recommendations || [];

          const filteredRecommendations = recommendations.filter(
            (recipe) => !cookedTitles.has(normalizeTitle(recipe.title))
          );

          setRecipes(filteredRecommendations.slice(0, 2));
        } catch (apiError) {
          console.log("AI Recommendation log:", extractApiError(apiError));
          setRecipes([]);
        }
      } else {
        setRecipes([]);
      }
    } catch (error: any) {
      console.error("Fatal Fetch Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getBadgeInfo = (days: number) => {
    if (days <= 0) return { label: "EXPIRED", color: "#000000" };
    if (days === 1) return { label: "BESOK", color: "#BB0009" };
    return { label: `${days} HARI LAGI`, color: days <= 2 ? "#BB0009" : "#FDCB52" };
  };

  const getCardColors = (days: number) => {
    if (days <= 0) {
      return { backgroundColor: "#F5F5F5", borderColor: "#E5E7EB" };
    }
    if (days <= 2) {
      return { backgroundColor: "#FEF2F2", borderColor: "#FEE2E2" };
    }
    if (days <= 5) {
      return { backgroundColor: "#FFF8E1", borderColor: "#FDCB52" };
    }
    return { backgroundColor: "#DCFCE7", borderColor: "#15803D" };
  };

  if (loading) {
    return (
      <View style={[styles.flex, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#BB0009" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchInitialData();
            }}
            tintColor="#BB0009"
          />
        }
      >
        <View style={styles.header}>
          <Image source={LOGO_IMAGE} style={styles.logoSmall} resizeMode="contain" />
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.notifButton}
              onPress={() => navigation.navigate("Notification")}
            >
              <Ionicons name="notifications-outline" size={22} color="#2B2B2B" />
            </TouchableOpacity>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <Text style={styles.greeting}>Halo, {userName.split(" ")[0]}!</Text>
        <Text style={styles.greetingSub}>
          Kamu punya {expiringItems.length} bahan yang harus kamu perhatikan minggu ini.
        </Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Segera Kedaluwarsa</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Main", { screen: "Stok" })}>
            <Text style={styles.seeAll}>LIHAT SEMUA</Text>
          </TouchableOpacity>
        </View>

        {expiringItems.map((item) => {
          const badge = getBadgeInfo(item.days_remaining);
          const cardColors = getCardColors(item.days_remaining);

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.expiryCard,
                {
                  backgroundColor: cardColors.backgroundColor,
                  borderColor: cardColors.borderColor,
                },
              ]}
              onPress={() => navigation.navigate("Main", { screen: "Stok" })}
              activeOpacity={0.85}
            >
              <View style={[styles.expiryBadge, { backgroundColor: badge.color }]}>
                <Text style={styles.expiryBadgeText}>{badge.label}</Text>
              </View>
              <View style={styles.expiryInfo}>
                <Text style={styles.expiryName}>{capitalizeEachWord(item.item_name)}</Text>
                <Text style={styles.expiryQty}>
                  {item.quantity} {item.unit}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={[styles.sectionHeader, { marginTop: 28 }]}>
          <Text style={styles.sectionTitle}>Rekomendasi Chef AI</Text>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("Main", {
                screen: "ChefAI",
                params: { screen: "RecipeRecommendation" },
              })
            }
          >
            <Text style={styles.seeAll}>LIHAT SEMUA</Text>
          </TouchableOpacity>
        </View>

        {recipes.map((recipe) => (
          <TouchableOpacity
            key={recipe.index}
            style={styles.recipeCard}
            onPress={() =>
              navigation.navigate("Main", {
                screen: "ChefAI",
                params: {
                  screen: "RecipeDetail",
                  params: { recipe },
                },
              })
            }
            activeOpacity={0.85}
          >
            <Text style={styles.recipeTag}>REKOMENDASI UNTUKMU</Text>
            <Text style={styles.recipeName}>{capitalizeEachWord(recipe.title)}</Text>
            <View style={styles.recipeMeta}>
              <View style={styles.recipeMetaItem}>
                <Ionicons name="list-outline" size={14} color="#656C6E" />
                <Text style={styles.recipeMetaText}>{recipe.total_steps} Tahap</Text>
              </View>
              <View style={styles.recipeMetaItem}>
                <Ionicons name="cube-outline" size={14} color="#656C6E" />
                <Text style={styles.recipeMetaText}>{recipe.total_ingredients} Bahan</Text>
              </View>
              <View style={styles.recipeMetaItem}>
                <Ionicons name="heart" size={14} color="#BB0009" />
                <Text style={styles.recipeMetaText}>{recipe.loves} Suka</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.stockBanner}
          onPress={() => navigation.navigate("Main", { screen: "Stok" })}
          activeOpacity={0.85}
        >
          <Ionicons name="file-tray-full-outline" size={24} color="#FFFFFF" />
          <Text style={styles.stockBannerNumber}>{totalStock}</Text>
          <Text style={styles.stockBannerLabel}>BAHAN AKTIF DI STOK</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
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
  greeting: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: "#2B2B2B",
    marginBottom: 4,
  },
  greetingSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#656C6E",
    lineHeight: 20,
    marginBottom: 24,
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
  seeAll: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#BB0009",
    letterSpacing: 0.3,
  },
  expiryCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  expiryBadge: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  expiryBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  expiryInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  expiryName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#2B2B2B",
  },
  expiryQty: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#949FA2",
    marginTop: 2,
  },
  recipeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  recipeTag: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#BB0009",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  recipeName: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#2B2B2B",
    marginBottom: 10,
  },
  recipeMeta: {
    flexDirection: "row",
    gap: 16,
  },
  recipeMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  recipeMetaText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#656C6E",
  },
  stockBanner: {
    backgroundColor: "#BB0009",
    borderRadius: 18,
    padding: 24,
    marginTop: 20,
  },
  stockBannerNumber: {
    fontFamily: "Inter_700Bold",
    fontSize: 48,
    color: "#FFFFFF",
    marginTop: 4,
  },
  stockBannerLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
    letterSpacing: 0.5,
    opacity: 0.9,
  },
});

export default HomeScreen;