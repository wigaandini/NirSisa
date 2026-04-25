import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  TouchableOpacity, // <--- Tambahkan ini
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../services/supabase";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import Header from "../components/Header";

const API_URL = "https://nirsisa-production.up.railway.app";

// Body format: "Telur Ayam sebaiknya segera diolah. Sisa waktu: 2 hari."
// Atau: "Wortel, Bayam (+1 lainnya) mendekati kedaluwarsa..."
const extractIngredientFromNotif = (body: string): string => {
  // Ambil teks sebelum kata "sebaiknya", "akan", "sudah", atau "mendekati"
  const match = body.match(/^(.+?)\s+(sebaiknya|akan|sudah|mendekati)/i);
  if (match) {
    // Bersihkan: hapus emoji, trim
    return match[1].replace(/[^\w\s]/gi, "").trim();
  }
  // Fallback: ambil kata pertama saja
  return body.split(" ").slice(0, 2).join(" ").trim();
};

type Props = NativeStackScreenProps<RootStackParamList, "Notification">;

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  notification_type: "critical" | "warning" | "info";
  sent_at: string;
}

interface TopRecommendation {
  title: string;
  ingredients: string;
}

const NotificationScreen: React.FC<Props> = ({ navigation }) => {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [recommendation, setRecommendation] = useState<TopRecommendation | null>(null);

  const fetchData = async () => {
  if (!session?.user?.id) return;
  setLoading(true);

  try {
    // 1. Ambil Log Notifikasi Resmi dari DB
    const { data: notifData } = await supabase
      .from("notification_log")
      .select("*")
      .eq("user_id", session.user.id)
      .order("sent_at", { ascending: false });

    // 2. SMART DETECTION: Cek stok yang kritis secara real-time
    // Ini adalah fallback jika tabel notification_log masih kosong
    const { data: expiringInventory } = await supabase
      .from("inventory_with_spi")
      .select("item_name, days_remaining, freshness_status")
      .eq("user_id", session.user.id)
      .in("freshness_status", ["expired", "warning"]) // Ambil yang merah & kuning
      .order("days_remaining", { ascending: true });

    // 3. Gabungkan data (Buat notifikasi buatan dari stok yang ada)
    const dynamicNotifs: NotificationItem[] = (expiringInventory || []).map((item, index) => ({
      id: `dynamic-${index}`,
      title: item.freshness_status === 'expired' ? "Sudah Kedaluwarsa!" : "Hampir Kedaluwarsa",
      body: `${item.item_name} sebaiknya segera diolah. Sisa waktu: ${item.days_remaining} hari.`,
      notification_type: item.freshness_status === 'expired' ? 'critical' : 'warning',
      sent_at: new Date().toISOString()
    }));

    // Prioritaskan log resmi, jika kosong gunakan hasil deteksi otomatis
    const finalNotifs = notifData && notifData.length > 0 
      ? notifData 
      : dynamicNotifs;

    setNotifications(finalNotifs);

    // 4. Ambil Rekomendasi AI (Tetap sama)
    const res = await axios.get(`${API_URL}/recommend?top_k=1`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    
    if (res.data.recommendations?.length > 0) {
      setRecommendation(res.data.recommendations[0]);
    }
  } catch (error) {
    console.error("Fetch Notifications Error:", error);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [session])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getNotifStyle = (type: string) => {
    switch (type) {
      case "critical": return { color: "#BB0009", bg: "#FEE2E2", icon: "warning" as const };
      case "warning": return { color: "#D97706", bg: "#FEF3C7", icon: "timer-outline" as const };
      default: return { color: "#36393B", bg: "#F3F4F6", icon: "notifications-outline" as const };
    }
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#BB0009" />}
      >
        <Header variant="back" onBack={() => navigation.goBack()} />

        <Text style={styles.title}>Notifikasi</Text>
        <Text style={styles.subtitle}>Jaga kesegaran dapur Anda dan kurangi limbah.</Text>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#BB0009" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* AI Recommendation Card (Jika ada bahan kritis) */}
            {recommendation && (
              <View style={[styles.card, styles.cardAI]}>
                <Text style={styles.cardAILabel}>Rekomendasi Chef AI</Text>
                <Text style={styles.cardAIDesc}>
                  Gunakan bahan yang hampir habis untuk memasak{" "}
                  <Text style={styles.cardAIBold}>{recommendation.title}</Text> hari ini!
                </Text>
                <TouchableOpacity 
                  style={styles.secondaryButton}
                  onPress={() => navigation.navigate("Main", { screen: "ChefAI" })}
                >
                  <Text style={styles.secondaryButtonText}>Lihat Detail Resep</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* List Notifikasi dari DB */}
            {notifications.length > 0 ? (
              notifications.map((notif) => {
                const style = getNotifStyle(notif.notification_type);
                const ingredientName = extractIngredientFromNotif(notif.body);
                const navigateWithSearch = () => {
                  navigation.navigate("Main", {
                    screen: "ChefAI",
                    params: {
                      screen: "RecipeRecommendation",
                      params: { searchQuery: ingredientName },
                    },
                  });
                };
                return (
                  <TouchableOpacity
                    key={notif.id}
                    style={[styles.card, { borderLeftWidth: 4, borderLeftColor: style.color }]}
                    activeOpacity={0.75}
                    onPress={navigateWithSearch}
                  >
                    <View style={styles.cardIconWrap}>
                      <View style={[styles.iconCircle, { backgroundColor: style.bg }]}>
                        <Ionicons name={style.icon} size={22} color={style.color} />
                      </View>
                      <View style={styles.cardBody}>
                        <Text style={styles.cardTitle}>{notif.title}</Text>
                        <Text style={styles.cardDesc}>{notif.body}</Text>
                        {(notif.notification_type === 'critical' || notif.notification_type === 'warning') && (
                          <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: style.color }]}
                            onPress={navigateWithSearch}
                          >
                            <Text style={styles.primaryButtonText}>Cari Resep</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>Semua bahan Anda masih segar!</Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#FFF8F8",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 20,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: "#2B2B2B",
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#656C6E",
    marginBottom: 28,
  },
  // ── Cards ──
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  cardRedBorder: {
    borderLeftWidth: 4,
    borderLeftColor: "#BB0009",
  },
  cardOrangeBorder: {
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
  },
  cardAI: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FEE2E2",
  },
  cardIconWrap: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#2B2B2B",
    marginBottom: 6,
  },
  cardDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#656C6E",
    lineHeight: 19,
  },
  primaryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#BB0009",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginTop: 14,
  },
  primaryButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  // ── AI Card ──
  cardAILabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#BB0009",
    marginBottom: 10,
  },
  cardAIDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#2B2B2B",
    lineHeight: 21,
    marginBottom: 16,
  },
  cardAIBold: {
    fontFamily: "Inter_700Bold",
    color: "#2B2B2B",
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#BB0009",
  },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontFamily: 'Inter_400Regular', color: '#9CA3AF', fontSize: 15 }
});

export default NotificationScreen;