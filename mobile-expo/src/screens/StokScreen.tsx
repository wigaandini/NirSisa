import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TambahBahanModal, { BahanBaru } from "../components/TambahBahanModal";
import StokFilterModal, { DEFAULT_STOK_FILTER, StokFilter } from "../components/StokFilterModal";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";

const LOGO_IMAGE = require("../assets/images/logo.png");

type FreshnessStatus = "HARI INI" | "2 HARI LAGI" | "SEGAR";

interface StockItem {
  id: string;
  name: string;
  qty: string;
  status: FreshnessStatus;
  borderColor: string;
}

interface StockCategory {
  title: string;
  items: StockItem[];
}

const STATUS_STYLES: Record<FreshnessStatus, { bg: string; text: string }> = {
  "HARI INI": { bg: "#BB0009", text: "#FFFFFF" },
  "2 HARI LAGI": { bg: "#FDCB52", text: "#FFFFFF" },
  "SEGAR": { bg: "#15803D", text: "#FFFFFF" },
};

const STOCK_DATA: StockCategory[] = [
  {
    title: "Sayuran",
    items: [
      { id: "1", name: "Bayam Hijau", qty: "3 Ikat", status: "HARI INI", borderColor: "#BB0009" },
      { id: "2", name: "Wortel", qty: "500 gr", status: "2 HARI LAGI", borderColor: "#E8A317" },
      { id: "3", name: "Kubis", qty: "1 buah", status: "SEGAR", borderColor: "#15803D" },
    ],
  },
  {
    title: "Daging & Telur",
    items: [
      { id: "4", name: "Dada Ayam", qty: "1 kg", status: "HARI INI", borderColor: "#BB0009" },
      { id: "5", name: "Telur Ayam", qty: "10 butir", status: "SEGAR", borderColor: "#15803D" },
    ],
  },
];

const StokScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [searchQuery, setSearchQuery] = useState("");
  const [tambahVisible, setTambahVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StokFilter>(DEFAULT_STOK_FILTER);

  const filterActive =
    activeFilter.sortBy !== null ||
    activeFilter.kategori.length > 0 ||
    activeFilter.status.length > 0;

  const handleSaveBahan = (bahan: BahanBaru) => {
    // TODO: integrate with backend / state management
    console.log("Bahan baru:", bahan);
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#949FA2" />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari bahan makanan..."
              placeholderTextColor="#BFD3D6"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={[styles.filterButton, filterActive && styles.filterButtonActive]}
            onPress={() => setFilterVisible(true)}
          >
            <Ionicons name="options-outline" size={22} color={filterActive ? "#FFFFFF" : "#2B2B2B"} />
          </TouchableOpacity>
        </View>

        {/* Add Stock Button */}
        <TouchableOpacity style={styles.addButton} onPress={() => setTambahVisible(true)}>
          <Text style={styles.addButtonText}>Tambah Stok Bahan</Text>
        </TouchableOpacity>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryExpiring]}>
            <Text style={styles.summaryLabel}>SEGERA{"\n"}KADALUWARSA</Text>
            <Text style={styles.summaryNumber}>12</Text>
            <Text style={styles.summaryUnit}>item</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryFresh]}>
            <Text style={[styles.summaryLabel, { color: "#15803D" }]}>
              MASIH{"\n"}SEGAR
            </Text>
            <Text style={[styles.summaryNumber, { color: "#15803D" }]}>48</Text>
            <Text style={[styles.summaryUnit, { color: "#15803D" }]}>item</Text>
          </View>
        </View>

        {/* Stock Categories */}
        {STOCK_DATA.map((category) => (
          <View key={category.title} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>{category.title}</Text>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>
                  {category.items.length} Bahan
                </Text>
              </View>
            </View>

            {category.items.map((item) => {
              const statusStyle = STATUS_STYLES[item.status];
              return (
                <TouchableOpacity key={item.id} style={styles.stockCard}>
                  <View
                    style={[
                      styles.stockCardBorder,
                      { backgroundColor: item.borderColor },
                    ]}
                  />
                  <View style={styles.stockCardContent}>
                    <View style={styles.stockCardInfo}>
                      <Text style={styles.stockItemName}>{item.name}</Text>
                      <Text style={styles.stockItemQty}>{item.qty}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusStyle.bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: statusStyle.text },
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <View style={{ height: 24 }} />
      </ScrollView>

      <TambahBahanModal
        visible={tambahVisible}
        onSave={handleSaveBahan}
        onClose={() => setTambahVisible(false)}
      />
      <StokFilterModal
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
});

export default StokScreen;