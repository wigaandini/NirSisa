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
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.78;

const KATEGORI_OPTIONS = [
  "Sayuran",
  "Buah-Buahan",
  "Daging & Telur",
  "Produk Jadi",
  "Bumbu & Rempah",
  "Minuman",
  "Lainnya",
];

export interface BahanBaru {
  nama: string;
  kategori: string;
  jumlah: string;
  tanggalKadaluwarsa: string;
}

interface TambahBahanModalProps {
  visible: boolean;
  onSave: (bahan: BahanBaru) => void;
  onClose: () => void;
}

const TambahBahanModal: React.FC<TambahBahanModalProps> = ({ visible, onSave, onClose }) => {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [tanggal, setTanggal] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      setDropdownOpen(false);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_HEIGHT,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    setNama("");
    setKategori("");
    setJumlah("");
    setTanggal("");
    setDropdownOpen(false);
    onClose();
  };

  const handleSave = () => {
    onSave({ nama, kategori, jumlah, tanggalKadaluwarsa: tanggal });
    handleClose();
  };

  // Format tanggal input: auto-insert "/" separators
  const handleTanggalChange = (val: string) => {
    const digits = val.replace(/\D/g, "");
    let formatted = digits;
    if (digits.length >= 3) {
      formatted = digits.slice(0, 2) + "/" + digits.slice(2);
    }
    if (digits.length >= 5) {
      formatted = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4, 8);
    }
    setTanggal(formatted);
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) },
          ]}
        />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.kavWrapper}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Tambah Bahan</Text>
              <Text style={styles.sheetSubtitle}>Lacak inventaris makanan Anda</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={18} color="#2B2B2B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
            {/* Nama Bahan */}
            <Text style={styles.fieldLabel}>NAMA BAHAN</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Contoh: Wortel Organik"
              placeholderTextColor="#BDBDBD"
              value={nama}
              onChangeText={setNama}
            />

            {/* Kategori */}
            <Text style={styles.fieldLabel}>KATEGORI</Text>
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => setDropdownOpen(!dropdownOpen)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dropdownValue, !kategori && styles.dropdownPlaceholder]}>
                {kategori || "Pilih kategori"}
              </Text>
              <Ionicons
                name={dropdownOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color="#656C6E"
              />
            </TouchableOpacity>

            {/* Dropdown Options */}
            {dropdownOpen && (
              <View style={styles.dropdownList}>
                {KATEGORI_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.dropdownItem, kategori === opt && styles.dropdownItemSelected]}
                    onPress={() => {
                      setKategori(opt);
                      setDropdownOpen(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, kategori === opt && styles.dropdownItemTextSelected]}>
                      {opt}
                    </Text>
                    {kategori === opt && (
                      <Ionicons name="checkmark" size={16} color="#BB0009" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Jumlah */}
            <Text style={styles.fieldLabel}>JUMLAH</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Contoh: 500 gr, 2 pcs"
              placeholderTextColor="#BDBDBD"
              value={jumlah}
              onChangeText={setJumlah}
            />

            {/* Tanggal Kadaluwarsa — hanya untuk Produk Jadi */}
            {kategori === "Produk Jadi" && (
              <>
                <Text style={styles.fieldLabel}>TANGGAL KADALUWARSA</Text>
                <View style={styles.dateInputRow}>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="mm/dd/yyyy"
                    placeholderTextColor="#BDBDBD"
                    value={tanggal}
                    onChangeText={handleTanggalChange}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                  <Ionicons name="calendar-outline" size={20} color="#656C6E" />
                </View>
              </>
            )}

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, !nama && styles.saveButtonDisabled]}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={!nama}
            >
              <Text style={styles.saveButtonText}>Simpan ke Inventaris</Text>
            </TouchableOpacity>

            <View style={{ height: Platform.OS === "ios" ? 32 : 16 }} />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
  kavWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
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
    alignItems: "flex-start",
    marginBottom: 24,
  },
  sheetTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#2B2B2B",
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#656C6E",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#949FA2",
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#2B2B2B",
  },
  // ── Dropdown ──
  dropdownTrigger: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownValue: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#2B2B2B",
  },
  dropdownPlaceholder: {
    color: "#BDBDBD",
  },
  dropdownList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginTop: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  dropdownItemSelected: {
    backgroundColor: "#FEF2F2",
  },
  dropdownItemText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#2B2B2B",
  },
  dropdownItemTextSelected: {
    fontFamily: "Inter_600SemiBold",
    color: "#BB0009",
  },
  // ── Date ──
  dateInputRow: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
  },
  dateInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#2B2B2B",
    height: 52,
  },
  // ── Save Button ──
  saveButton: {
    backgroundColor: "#BB0009",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 28,
  },
  saveButtonDisabled: {
    backgroundColor: "#E57373",
  },
  saveButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});

export default TambahBahanModal;
