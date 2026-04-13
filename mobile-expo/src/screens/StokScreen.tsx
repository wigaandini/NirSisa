import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TambahBahanModal, { BahanBaru } from "../components/TambahBahanModal";
import StokFilterModal, { DEFAULT_STOK_FILTER, StokFilter } from "../components/StokFilterModal";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { supabase } from "../services/supabase";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

const LOGO_IMAGE = require("../assets/images/logo.png");
const API_URL = "https://nirsisa-production.up.railway.app";

interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  category_name: string | null;
  freshness_status: "critical" | "warning" | "fresh" | "unknown";
  days_remaining: number;
}

const StokScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [tambahVisible, setTambahVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StokFilter>(DEFAULT_STOK_FILTER);

  const fetchInventory = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      // 1. Coba ambil dari VIEW
      const { data, error } = await supabase
        .from("inventory_with_spi")
        .select("*")
        .eq("user_id", session.user.id)
        .gt("quantity", 0)
        .order("expiry_date", { ascending: true });

      // 2. Logika Fallback jika View bermasalah atau kosong
      if (error || !data || data.length === 0) {
        const { data: rawData, error: rawError } = await supabase
          .from("inventory_stock")
          .select("*")
          .eq("user_id", session.user.id)
          .gt("quantity", 0)
          .order("expiry_date", { ascending: true });

        if (rawError) throw rawError;
        setInventory(rawData || []);
      } else {
        setInventory(data);
      }
    } catch (error: any) {
      console.error("Fetch Error:", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [session]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchInventory();
  }, [session]);

  const handleSaveBahan = async (bahan: BahanBaru) => {
    if (!session?.access_token) return;
    try {
      setLoading(true);
      const response = await axios.post(
        `${API_URL}/inventory`,
        {
          item_name: bahan.nama,
          quantity: parseFloat(bahan.jumlah),
          unit: bahan.satuan,
          is_natural: bahan.isNatural,
          expiry_date: bahan.tanggalExpired 
        },
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );

      if (response.status === 201) {
        Alert.alert("Berhasil", "Bahan ditambahkan.");
        setTambahVisible(false);
        fetchInventory();
      }
    } catch (error: any) {
      // --- UBAH BAGIAN INI UNTUK DEBUGGING ---
      const serverMessage = error.response?.data?.detail || error.message;
      console.error("Server Error Detail:", serverMessage);
      Alert.alert("Gagal Menyambung", `Pesan Server: ${serverMessage}`);
      // ---------------------------------------
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIKA PEMROSESAN DATA (GROUPING) ---
  const groupedInventory = useMemo(() => {
    // 1. Filter berdasarkan pencarian
    const filtered = inventory.filter(item => 
      (item.item_name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    // 2. Kelompokkan ke dalam objek berdasarkan kategori
    const groups: Record<string, InventoryItem[]> = {};
    
    filtered.forEach(item => {
      const groupName = item.category_name || "Lain-lain";
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(item);
    });

    return groups;
  }, [inventory, searchQuery]);

  const getStatusDisplay = (status: string, days: number) => {
    switch (status) {
      case "critical": return { label: "HARI INI", color: "#BB0009" };
      case "warning": return { label: `${days} HARI LAGI`, color: "#FDCB52" };
      case "fresh": return { label: "SEGAR", color: "#15803D" };
      default: return { label: "CEK FISIK", color: "#949FA2" };
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
        {/* Header */}
        <View style={styles.header}>
          <Image source={LOGO_IMAGE} style={styles.logoSmall} resizeMode="contain" />
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notifButton}>
              <Ionicons name="notifications-outline" size={22} color="#2B2B2B" />
            </TouchableOpacity>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color="#FFFFFF" />
            </View>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#949FA2" />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari bahan makanan..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity style={styles.filterButton} onPress={() => setFilterVisible(true)}>
            <Ionicons name="options-outline" size={22} color="#2B2B2B" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.addButton} onPress={() => setTambahVisible(true)}>
          <Text style={styles.addButtonText}>Tambah Stok Bahan</Text>
        </TouchableOpacity>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryExpiring]}>
            <Text style={styles.summaryLabel}>SEGERA{"\n"}KADALUWARSA</Text>
            <Text style={styles.summaryNumber}>
              {inventory.filter(i => i.freshness_status === 'critical' || i.freshness_status === 'warning').length}
            </Text>
            <Text style={styles.summaryUnit}>item</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryFresh]}>
            <Text style={[styles.summaryLabel, { color: "#15803D" }]}>MASIH{"\n"}SEGAR</Text>
            <Text style={[styles.summaryNumber, { color: "#15803D" }]}>
              {inventory.filter(i => i.freshness_status === 'fresh').length}
            </Text>
            <Text style={[styles.summaryUnit, { color: "#15803D" }]}>item</Text>
          </View>
        </View>

        {/* Render List Berdasarkan Group */}
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#BB0009" style={{ marginTop: 20 }} />
        ) : (
          Object.keys(groupedInventory).map((categoryName) => (
            <View key={categoryName} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryTitle}>{categoryName}</Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>
                    {groupedInventory[categoryName].length} Bahan
                  </Text>
                </View>
              </View>

              {groupedInventory[categoryName].map((item) => {
                const statusInfo = getStatusDisplay(item.freshness_status, item.days_remaining);
                return (
                  <TouchableOpacity key={item.id} style={styles.stockCard}>
                    <View style={[styles.stockCardBorder, { backgroundColor: statusInfo.color }]} />
                    <View style={styles.stockCardContent}>
                      <View style={styles.stockCardInfo}>
                        <Text style={styles.stockItemName}>{item.item_name}</Text>
                        <Text style={styles.stockItemQty}>{item.quantity} {item.unit}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
                        <Text style={styles.statusBadgeText}>{statusInfo.label}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
        
        {/* State Kosong */}
        {!loading && inventory.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Belum ada bahan di stok Anda.</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <TambahBahanModal visible={tambahVisible} onSave={handleSaveBahan} onClose={() => setTambahVisible(false)} />
      <StokFilterModal visible={filterVisible} initialFilter={activeFilter} onApply={setActiveFilter} onClose={() => setFilterVisible(false)} />
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
    marginBottom: 20,
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#2B2B2B",
    padding: 0,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonActive: {
    backgroundColor: "#BB0009",
  },
  addButton: {
    backgroundColor: "#BB0009",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#BB0009",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: "#FFFFFF",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  summaryExpiring: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FEE2E2",
  },
  summaryFresh: {
    backgroundColor: "rgba(21, 128, 61, 0.08)",
    borderColor: "rgba(21, 128, 61, 0.25)",
  },
  summaryLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#BB0009",
    letterSpacing: 0.5,
    lineHeight: 16,
    marginBottom: 8,
  },
  summaryNumber: {
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    color: "#2B2B2B",
  },
  summaryUnit: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#656C6E",
    marginTop: -2,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  categoryTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#2B2B2B",
  },
  categoryBadge: {
    backgroundColor: "#F0F0F0",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  categoryBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#656C6E",
  },
  stockCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  stockCardBorder: {
    width: 5,
  },
  stockCardContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  stockCardInfo: {
    flex: 1,
  },
  stockItemName: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#2B2B2B",
    marginBottom: 2,
  },
  stockItemQty: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#949FA2",
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.3,
  },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#949FA2' }
});

export default StokScreen;