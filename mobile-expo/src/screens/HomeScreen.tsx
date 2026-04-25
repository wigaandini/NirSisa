import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { supabase } from "../services/supabase";
import { useAuth } from "../context/AuthContext";
import { api, extractApiError } from "../services/api";
import { RecommendationItem, RecommendationResponse } from "../types/api";
import { capitalizeEachWord } from "../utils/formatters";
import Header from "../components/Header";

interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  days_remaining: number;
  freshness_status: "expired" | "critical" | "warning" | "fresh" | "unknown";
}

const normalizeTitle = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { photoUri } = useAuth();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("User");
  const [expiringItems, setExpiringItems] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<RecommendationItem[]>([]);
  const [totalStock, setTotalStock] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
      if (profile?.display_name) setUserName(profile.display_name);

      const { count } = await supabase.from("inventory_stock").select("*", { count: "exact", head: true }).eq("user_id", user.id).gt("quantity", 0);
      setTotalStock(count || 0);

      const { data: stock } = await supabase.from("inventory_with_spi").select("*").eq("user_id", user.id).in("freshness_status", ["expired", "critical"]).order("expiry_date", { ascending: true }).limit(5);
      setExpiringItems(stock || []);

      const { data: cookedHistory } = await supabase.from("consumption_history").select("recipe_title").eq("user_id", user.id);
      const cookedTitles = new Set((cookedHistory || []).map((item: any) => normalizeTitle(item.recipe_title || "")));

      if ((count || 0) > 0) {
        try {
          const res = await api.get<RecommendationResponse>("/recommend", { params: { top_k: 8 } });
          const filtered = (res.data.recommendations || []).filter((r) => !cookedTitles.has(normalizeTitle(r.title)));
          setRecipes(filtered.slice(0, 2));
        } catch (e) { setRecipes([]); }
      } else { setRecipes([]); }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchInitialData(); }, []);
  useFocusEffect(useCallback(() => { fetchInitialData(); }, []));

  const getBadgeInfo = (days: number) => {
    if (days <= 0) return { label: "KEDALUWARSA", color: "#000000" };
    if (days === 1) return { label: "BESOK", color: "#BB0009" };
    if (days <= 2) return { label: `${days} HARI LAGI`, color: "#BB0009" };
    if (days <= 5) return { label: `${days} HARI LAGI`, color: "#FDCB52" };
    return { label: `${days} HARI LAGI`, color: "#15803D" };
  };

  const getCardColors = (days: number) => {
    if (days <= 0) return { backgroundColor: "#F5F5F5", borderColor: "#E5E7EB" };
    if (days <= 2) return { backgroundColor: "#FEF2F2", borderColor: "#FEE2E2" };
    if (days <= 5) return { backgroundColor: "#FFF8E1", borderColor: "#FDCB52" };
    return { backgroundColor: "#DCFCE7", borderColor: "#15803D" };
  };

  if (loading && !refreshing) {
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchInitialData(); }} tintColor="#BB0009" />}
      >
        <Header
          onNotificationPress={() => navigation.navigate("Notification")}
          onAvatarPress={() => navigation.navigate("Main", { screen: "Profil" } as any)}
          photoUri={photoUri}
        />

        {/* 1. GREETING */}
        <Text style={styles.greeting}>Halo, {userName.split(" ")[0]}!</Text>
        <Text style={styles.greetingSub}>
          {expiringItems.length > 0 
            ? `Kamu punya ${expiringItems.length} bahan yang harus kamu perhatikan minggu ini.`
            : "Semua bahanmu masih dalam kondisi aman."}
        </Text>

        {/* 2. SECTION: EXPIRING (Dikecilkan judulnya, sejajar dengan tombol) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Sudah & Segera Kedaluwarsa</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Main", { screen: "Stok" })}>
            <Text style={styles.seeAll}>LIHAT SEMUA</Text>
          </TouchableOpacity>
        </View>

        {expiringItems.length > 0 ? (
          expiringItems.map((item) => {
            const badge = getBadgeInfo(item.days_remaining);
            const cardColors = getCardColors(item.days_remaining);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.expiryCard, { backgroundColor: cardColors.backgroundColor, borderColor: cardColors.borderColor }]}
                onPress={() => navigation.navigate("Main", { screen: "Stok" })}
              >
                <View style={[styles.expiryBadge, { backgroundColor: badge.color }]}>
                  <Text style={styles.expiryBadgeText}>{badge.label}</Text>
                </View>
                <View style={styles.expiryInfo}>
                  <Text style={styles.expiryName}>{capitalizeEachWord(item.item_name)}</Text>
                  <Text style={styles.expiryQty}>{item.quantity} {item.unit}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#15803D" />
            <Text style={styles.emptyText}>Tidak ada bahan kritis hari ini.</Text>
          </View>
        )}

        {/* 3. SECTION: RECOMMENDATIONS (Sejajar) */}
        <View style={[styles.sectionHeader, { marginTop: 32 }]}>
          <Text style={styles.sectionTitle}>Rekomendasi Chef AI</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Main", { screen: "ChefAI" })}>
            <Text style={styles.seeAll}>LIHAT SEMUA</Text>
          </TouchableOpacity>
        </View>

        {recipes.map((recipe) => (
          <TouchableOpacity
            key={recipe.index}
            style={styles.recipeCard}
            onPress={() => navigation.navigate("Main", { screen: "ChefAI", params: { screen: "RecipeRecommendation", params: { pendingRecipe: recipe } } })}
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
            </View>
          </TouchableOpacity>
        ))}

        {/* 4. STOCK BANNER (Di bagian paling bawah) */}
        <TouchableOpacity
          style={[styles.stockBanner, { marginTop: 32 }]}
          onPress={() => navigation.navigate("Main", { screen: "Stok" })}
          activeOpacity={0.85}
        >
          <Ionicons name="file-tray-full-outline" size={24} color="#FFFFFF" />
          <Text style={styles.stockBannerNumber}>{totalStock}</Text>
          <Text style={styles.stockBannerLabel}>BAHAN AKTIF DI STOK</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#FAFAFA" },
  scrollContent: { paddingHorizontal: 24, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 20 },
  greeting: { fontFamily: "Inter_700Bold", fontSize: 28, color: "#2B2B2B" },
  greetingSub: { fontFamily: "Inter_400Regular", fontSize: 16, color: "#656C6E", marginTop: 4, marginBottom: 10, lineHeight: 22 },
  sectionHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "flex-end", // Sejajar di bagian bawah teks
    marginTop: 24, 
    marginBottom: 16 
  },
  sectionTitle: { 
    fontFamily: "Inter_700Bold", 
    fontSize: 15, // Dikecilkan dari 18 agar muat sejajar
    color: "#2B2B2B",
    flex: 1 
  },
  seeAll: { 
    fontFamily: "Inter_700Bold", 
    fontSize: 11, 
    color: "#BB0009", 
    letterSpacing: 0.5,
    marginLeft: -10
  },
  expiryCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  expiryBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 12 },
  expiryBadgeText: { fontFamily: "Inter_700Bold", fontSize: 10, color: "#FFFFFF" },
  expiryInfo: { flex: 1 },
  expiryName: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#2B2B2B" },
  expiryQty: { fontFamily: "Inter_400Regular", fontSize: 13, color: "#656C6E" },
  recipeCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#F0F0F0" },
  recipeTag: { fontFamily: "Inter_700Bold", fontSize: 10, color: "#BB0009", marginBottom: 4 },
  recipeName: { fontFamily: "Inter_700Bold", fontSize: 18, color: "#2B2B2B", marginBottom: 12 },
  recipeMeta: { flexDirection: "row", gap: 16 },
  recipeMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  recipeMetaText: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#656C6E" },
  stockBanner: { backgroundColor: "#BB0009", borderRadius: 20, padding: 24, alignItems: "flex-start" },
  stockBannerNumber: { fontFamily: "Inter_700Bold", fontSize: 48, color: "#FFFFFF", marginVertical: 8 },
  stockBannerLabel: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#FFFFFF", letterSpacing: 1 },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: '#F0FDF4', borderRadius: 12, borderWidth: 1, borderColor: '#DCFCE7' },
  emptyText: { fontFamily: 'Inter_400Regular', color: '#15803D', fontSize: 14 }
});

export default HomeScreen;