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
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../services/api";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.85;

const KATEGORI_OPTIONS = [
  "Sayuran", "Buah-Buahan", "Daging Sapi", "Daging Ayam", "Ikan",
  "Udang", "Telur", "Tahu", "Tempe", "Susu & Olahan", "Produk Jadi",
  "Bumbu Segar", "Tepung", "Lainnya"
];

export interface BahanBaru {
  nama: string;
  kategori: string;
  jumlah: string;
  satuan: string;
  isNatural: boolean;
  tanggalExpired: string | null;
}

interface TambahBahanModalProps {
  visible: boolean;
  onSave: (bahan: BahanBaru) => void;
  onClose: () => void;
  initialData?: BahanBaru; 
}

// Helper: Ubah YYYY-MM-DD (DB) ke DD/MM/YYYY (UI)
const formatDBDateToUI = (dateStr: string | null | undefined) => {
  if (!dateStr) return "";
  // Menangani format ISO (2026-04-20T...) atau Date string (2026-04-20)
  const pureDate = dateStr.split('T')[0]; 
  const [year, month, day] = pureDate.split("-");
  return `${day}/${month}/${year}`;
};

const TambahBahanModal: React.FC<TambahBahanModalProps> = ({ 
  visible, 
  onSave, 
  onClose, 
  initialData // 1. SUDAH DITAMBAHKAN DI SINI
}) => {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [satuan, setSatuan] = useState("");
  const [tanggal, setTanggal] = useState(""); // Ini state tanggal Anda
  const [isNatural, setIsNatural] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animasi Modal
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      setDropdownOpen(false);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Handle Initial Data (Mode Edit vs Tambah)
  useEffect(() => {
    if (visible) {
      if (initialData) {
        // --- MODE EDIT: Tampilkan data existing ---
        setNama(initialData.nama || "");
        setKategori(initialData.kategori || "");
        setJumlah(initialData.jumlah?.toString() || "");
        setSatuan(initialData.satuan || "");
        setIsNatural(initialData.isNatural);
        setTanggal(formatDBDateToUI(initialData.tanggalExpired)); // Konversi ke DD/MM/YYYY
      } else {
        // --- MODE TAMBAH: Reset jadi kosong ---
        setNama("");
        setKategori("");
        setJumlah("");
        setSatuan("pcs");
        setIsNatural(true);
        setTanggal("");
      }
    }
  }, [visible, initialData]);

  // Otomatis set isNatural berdasarkan kategori
  useEffect(() => {
    if (kategori === "Produk Jadi") {
      setIsNatural(false);
    } else if (kategori !== "" && kategori !== "Lainnya") {
      setIsNatural(true);
    }
  }, [kategori]);

  const handleNamaChange = (text: string) => {
    setNama(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get("/inventory/ingredient-search", { params: { q: text.trim() } });
        setSuggestions(res.data || []);
        setShowSuggestions(res.data?.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
  };

  const handlePickSuggestion = (item: any) => {
    setNama(item.ingredient_name);
    setSatuan(item.default_unit);
    setShowSuggestions(false);
    if (item.category_display && KATEGORI_OPTIONS.includes(item.category_display)) {
      setKategori(item.category_display);
    }
  };

  const formatToDBDate = (dateStr: string) => {
    if (!dateStr || dateStr.length < 10) return null;
    const [dd, mm, yyyy] = dateStr.split("/");
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleSave = () => {
    onSave({
      nama,
      kategori,
      jumlah,
      satuan: satuan || "pcs",
      isNatural,
      tanggalExpired: formatToDBDate(tanggal),
    });
    // Jangan panggil handleClose di sini jika parent (StokScreen) yang akan menutup modal setelah API sukses
  };

  const handleTanggalChange = (val: string) => {
    const digits = val.replace(/\D/g, "");
    let formatted = digits;
    if (digits.length >= 3) formatted = digits.slice(0, 2) + "/" + digits.slice(2);
    if (digits.length >= 5) formatted = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4, 8);
    setTanggal(formatted);
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.dragHandle} />
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>{initialData ? "Edit Bahan" : "Tambah Bahan"}</Text>
            <Text style={styles.sheetSubtitle}>Lacak inventaris makanan Anda</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={18} color="#2B2B2B" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }} >
            
            <Text style={styles.fieldLabel}>NAMA BAHAN</Text>
            <TextInput style={styles.textInput} placeholder="Contoh: Wortel" value={nama} onChangeText={handleNamaChange} />
            
            {showSuggestions && (
              <View style={styles.suggestionList}>
                {suggestions.map((s, i) => (
                  <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => handlePickSuggestion(s)}>
                    <Text style={styles.suggestionText}>{s.ingredient_name}</Text>
                    <Text style={styles.suggestionUnit}>{s.default_unit}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.fieldLabel}>KATEGORI</Text>
            <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setDropdownOpen(!dropdownOpen)}>
              <Text style={[styles.dropdownValue, !kategori && styles.dropdownPlaceholder]}>{kategori || "Pilih kategori"}</Text>
              <Ionicons name={dropdownOpen ? "chevron-up" : "chevron-down"} size={18} color="#656C6E" />
            </TouchableOpacity>

            {dropdownOpen && (
              <View style={styles.dropdownList}>
                {KATEGORI_OPTIONS.map((opt) => (
                  <TouchableOpacity key={opt} style={styles.dropdownItem} onPress={() => { setKategori(opt); setDropdownOpen(false); }}>
                    <Text style={styles.dropdownItemText}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.fieldLabel}>JUMLAH</Text>
                <TextInput style={styles.textInput} placeholder="500" value={jumlah} onChangeText={setJumlah} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>SATUAN</Text>
                <TextInput style={styles.textInput} placeholder="gram / ikat" value={satuan} onChangeText={setSatuan} />
              </View>
            </View>

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>Bahan Alami / Segar?</Text>
                <Text style={styles.switchSub}>Aktifkan jika tanpa label expired</Text>
              </View>
              <Switch value={isNatural} onValueChange={setIsNatural} trackColor={{ true: '#BB0009' }} />
            </View>

            <Text style={styles.fieldLabel}>TANGGAL KADALUWARSA (OPSIONAL)</Text>
            <View style={styles.dateInputRow}>
              <TextInput style={styles.dateInput} placeholder="dd/mm/yyyy" value={tanggal} onChangeText={handleTanggalChange} keyboardType="numeric" maxLength={10} />
              <Ionicons name="calendar-outline" size={20} color="#656C6E" />
            </View>

            <TouchableOpacity style={[styles.saveButton, !nama && styles.saveButtonDisabled]} onPress={handleSave} disabled={!nama}>
              <Text style={styles.saveButtonText}>{initialData ? "Simpan Perubahan" : "Simpan ke Inventaris"}</Text>
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
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
    height: SCREEN_HEIGHT * 0.88,
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
  suggestionList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginTop: 4,
    maxHeight: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  suggestionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  suggestionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#2B2B2B",
  },
  suggestionUnit: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#949FA2",
  },
  row: { flexDirection: 'row' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12 },
  switchLabel: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#2B2B2B' },
  switchSub: { fontSize: 11, color: '#656C6E' },
  infoText: { fontSize: 11, color: '#949FA2', fontStyle: 'italic', marginTop: 4 },


  
});

export default TambahBahanModal;
