import React, { useState, useCallback } from "react";
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
import { useAuth } from "../context/AuthContext";

const LOGO_IMAGE = require("../assets/images/logo.png");

interface HistoryItem {
  id: string;
  cooked_at: string;
  recipe_title: string;
  ingredients_count: number;
}

const RiwayatScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useAuth();
  
  // States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState({ totalRecipes: 0, totalIngredients: 0 });

  // Fungsi Fetch Data
const fetchHistoryData = async () => {
  if (!session?.user?.id) return;
  
  try {
    const { data, error } = await supabase
      .from("consumption_history")
      .select(`
        id,
        recipe_title,
        cooked_at,
        consumption_history_items (id) 
      `)
      .eq("user_id", session.user.id)
      .order("cooked_at", { ascending: false });

    if (error) throw error;

    // 1. Format data history
    const formattedHistory = (data || []).map((item: any) => ({
      id: item.id,
      recipe_title: item.recipe_title,
      cooked_at: item.cooked_at,
      // Menghitung jumlah bahan per resep secara dinamis
      ingredients_count: item.consumption_history_items?.length || 0
    }));

    // 2. HITUNG STATISTIK SECARA DINAMIS
    // Menghitung total bahan dari seluruh resep yang pernah dimasak
    const totalIngredientsUsed = formattedHistory.reduce(
      (sum, item) => sum + item.ingredients_count, 
      0
    );

    setHistory(formattedHistory);
    setStats({
      totalRecipes: formattedHistory.length,
      totalIngredients: totalIngredientsUsed // <--- SEKARANG SUDAH DINAMIS
    });

  } catch (error: any) {
    console.error("Fetch History Error:", error.message);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  // Auto Refresh saat halaman dibuka
  useFocusEffect(
    useCallback(() => {
      fetchHistoryData();
    }, [session])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistoryData();
  };

  // Helper Format Tanggal
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#BB0009" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Image source={LOGO_IMAGE} style={styles.logoSmall} resizeMode="contain" />
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notifButton} onPress={() => navigation.navigate("Notification")}>
              <Ionicons name="notifications-outline" size={22} color="#2B2B2B" />
            </TouchableOpacity>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color="#FFFFFF" />
            </View>
          </View>
        </View>

        {/* Stat Cards Dinamis */}
        <View style={styles.statRow}>
          <View style={[styles.statCard, styles.statCardBeige]}>
            <Text style={[styles.statNumber, { color: "#92400E" }]}>{stats.totalRecipes}</Text>
            <Text style={[styles.statLabel, { color: "#B45309" }]}>RESEP DIMASAK</Text>
          </View>
          <View style={[styles.statCard, styles.statCardPink]}>
            <Text style={[styles.statNumber, { color: "#BB0009" }]}>{stats.totalIngredients}</Text>
            <Text style={[styles.statLabel, { color: "#BB0009" }]}>BAHAN DIMASAK</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Aktivitas Terbaru</Text>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#BB0009" style={{ marginTop: 20 }} />
        ) : history.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={48} color="#BFD3D6" />
            <Text style={styles.emptyText}>Belum ada riwayat memasak.</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {history.map((item, index) => {
              const isLast = index === history.length - 1;
              return (
                <View key={item.id} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineLine, index === 0 && styles.timelineLineHidden]} />
                    <View style={styles.timelineCircle}>
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    </View>
                    <View style={[styles.timelineLine, isLast && styles.timelineLineHidden]} />
                  </View>

                  <View style={styles.timelineCard}>
                    <Text style={styles.cardDate}>{formatDate(item.cooked_at)}</Text>
                    <Text style={styles.cardName}>{item.recipe_title}</Text>
                    <Text style={styles.cardDesc}>
                      Berhasil mengolah {item.ingredients_count} bahan makanan.
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

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
    marginBottom: 28,
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
  // ── Stat Cards ──
  statRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
  },
  statCardBeige: {
    backgroundColor: "#FEF3C7",
  },
  statCardPink: {
    backgroundColor: "#FEE2E2",
  },
  statNumber: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.4,
  },
  // ── Timeline ──
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#2B2B2B",
    marginBottom: 20,
  },
  timeline: {
    flexDirection: "column",
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  timelineLeft: {
    width: 40,
    alignItems: "center",
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#BB0009",
    minHeight: 20,
  },
  timelineLineHidden: {
    backgroundColor: "transparent",
  },
  timelineCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E57373",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    padding: 16,
    marginLeft: 12,
    marginBottom: 16,
  },
  cardDate: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#BB0009",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  cardName: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: "#2B2B2B",
    marginBottom: 4,
  },
  cardDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#656C6E",
  },
  emptyState: { alignItems: 'center', marginTop: 40, gap: 10 },
  emptyText: { fontFamily: 'Inter_400Regular', color: '#949FA2', fontSize: 15 }
});

export default RiwayatScreen;
