import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.85;

// --- TYPES ---
export type SortStok = "expiry" | "name_az" | "quantity";

// Value di sini harus sama persis dengan kolom 'name' di tabel ingredient_categories
export type KategoriValue =
  | "sayur"
  | "buah"
  | "bahan_olahan"
  | "daging_sapi"
  | "daging_ayam"
  | "dairy"
  | "Lain-lain";

export type StatusStok = "expired" | "warning" | "fresh";

export interface StokFilter {
  sortBy: SortStok | null;
  kategori: KategoriValue[];
  status: StatusStok[];
}

// --- CONSTANTS (Label untuk UI, Value untuk Database) ---
export const DEFAULT_STOK_FILTER: StokFilter = {
  sortBy: null,
  kategori: [],
  status: [],
};

const SORT_OPTIONS: { value: SortStok; label: string }[] = [
  { value: "expiry", label: "Tanggal Kadaluwarsa (Terdekat)" },
  { value: "name_az", label: "Nama (A-Z)" },
  { value: "quantity", label: "Jumlah (Tersisa)" },
];

const KATEGORI_OPTIONS: { label: string; value: KategoriValue }[] = [
  { label: "Sayuran", value: "sayur" },
  { label: "Buah-buahan", value: "buah" },
  { label: "Produk Jadi", value: "bahan_olahan" },
  { label: "Daging Sapi", value: "daging_sapi" },
  { label: "Daging Ayam", value: "daging_ayam" },
  { label: "Minuman/Susu", value: "dairy" },
  { label: "Lain-lain", value: "Lain-lain" },
];

const STATUS_OPTIONS: { label: string; value: StatusStok }[] = [
  { label: "Segera Kadaluwarsa", value: "expired" },
  { label: "Mendekati Kadaluwarsa", value: "warning" },
  { label: "Segar", value: "fresh" },
];

interface StokFilterModalProps {
  visible: boolean;
  initialFilter: StokFilter;
  onApply: (filter: StokFilter) => void;
  onClose: () => void;
}

const StokFilterModal: React.FC<StokFilterModalProps> = ({
  visible,
  initialFilter,
  onApply,
  onClose,
}) => {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // State lokal untuk menampung pilihan sebelum di-Apply
  const [sortBy, setSortBy] = useState<SortStok | null>(initialFilter.sortBy);
  const [kategori, setKategori] = useState<KategoriValue[]>(initialFilter.kategori);
  const [status, setStatus] = useState<StatusStok[]>(initialFilter.status);

  useEffect(() => {
    if (visible) {
      // Sinkronkan state lokal dengan filter yang sedang aktif saat modal dibuka
      setSortBy(initialFilter.sortBy);
      setKategori(initialFilter.kategori);
      setStatus(initialFilter.status);

      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const toggleKategori = (val: KategoriValue) => {
    setKategori((prev) =>
      prev.includes(val) ? prev.filter((k) => k !== val) : [...prev, val]
    );
  };

  const toggleStatus = (val: StatusStok) => {
    setStatus((prev) =>
      prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]
    );
  };

  const handleApply = () => {
    onApply({ sortBy, kategori, status });
    onClose();
  };

  const handleReset = () => {
    setSortBy(null);
    setKategori([]);
    setStatus([]);
    onApply(DEFAULT_STOK_FILTER);
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) }]}
        />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.dragHandle} />

        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Filter & Urutkan</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={18} color="#2B2B2B" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {/* ── Urutkan Berdasarkan (Radio Button style) ── */}
          <Text style={styles.sectionLabel}>URUTKAN BERDASARKAN</Text>
          {SORT_OPTIONS.map((opt) => {
            const isSelected = sortBy === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.radioRow, isSelected && styles.radioRowSelected]}
                onPress={() => setSortBy(isSelected ? null : opt.value)}
              >
                <Text style={[styles.radioLabel, isSelected && styles.radioLabelSelected]}>
                  {opt.label}
                </Text>
                <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* ── Kategori (Multi-select Chips) ── */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>KATEGORI</Text>
          <View style={styles.chipRow}>
            {KATEGORI_OPTIONS.map((opt) => {
              const isSelected = kategori.includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => toggleKategori(opt.value)}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Status (Multi-select Chips) ── */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>STATUS</Text>
          <View style={styles.chipRow}>
            {STATUS_OPTIONS.map((opt) => {
              const isSelected = status.includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => toggleStatus(opt.value)}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Tombol Aksi ── */}
          <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
            <Text style={styles.applyButtonText}>Terapkan Filter</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Hapus Semua Filter</Text>
          </TouchableOpacity>

          <View style={{ height: Platform.OS === "ios" ? 40 : 20 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#BFD3D6",
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: "#2B2B2B",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#949FA2",
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  // ── Radio ──
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  radioRowSelected: {
    borderColor: "#BB0009",
  },
  radioLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#2B2B2B",
    flex: 1,
  },
  radioLabelSelected: {
    fontFamily: "Inter_600SemiBold",
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#BFD3D6",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleSelected: {
    borderColor: "#BB0009",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#BB0009",
  },
  // ── Chips ──
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: "#F0F0F0",
  },
  chipSelected: {
    backgroundColor: "#BB0009",
  },
  chipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#656C6E",
  },
  chipTextSelected: {
    color: "#FFFFFF",
  },
  // ── Actions ──
  applyButton: {
    backgroundColor: "#BB0009",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 32,
    marginBottom: 12,
  },
  applyButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  resetButton: {
    alignItems: "center",
    paddingVertical: 10,
  },
  resetButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#2B2B2B",
  },
});

export default StokFilterModal;
