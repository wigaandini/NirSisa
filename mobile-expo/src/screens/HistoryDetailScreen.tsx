import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { supabase } from "../services/supabase";
import { capitalizeEachWord } from "../utils/formatters";

const LOGO_IMAGE = require("../assets/images/logo.png");

type Props = NativeStackScreenProps<RootStackParamList, "HistoryDetail">;

const HistoryDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { historyId } = route.params;
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    fetchDetail();
  }, [historyId]);

  const fetchDetail = async () => {
  try {
    setLoading(true);
    
    const { data, error } = await supabase
      .from("consumption_history")
      .select(`
        id,
        recipe_title,
        cooked_at,
        consumption_history_items (
          id,
          quantity_used,
          item_name,
          unit,
          inventory_stock!rel_history_to_stock (
            item_name,
            unit
          )
        )
      `)
      .eq("id", historyId)
      .single();

    if (error) throw error;
    setDetail(data);
  } catch (error: any) {
    console.error("Fetch Detail Error:", error.message);
    // Jika masih error, coba hapus "!rel_history_to_stock" 
    // setelah Anda menjalankan SQL di atas.
  } finally {
    setLoading(false);
  }
};

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    return d.toLocaleDateString('id-ID', { 
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  // --- HANDLER LOADING ---
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#BB0009" />
      </View>
    );
  }

  // --- HANDLER DATA NULL (Mencegah crash cooked_at of null) ---
  if (!detail) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#BFD3D6" />
        <Text style={styles.emptyText}>Detail tidak ditemukan.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 15 }}>
          <Text style={{ color: '#BB0009', fontWeight: 'bold' }}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#2B2B2B" />
          </TouchableOpacity>
          <Image source={LOGO_IMAGE} style={styles.logoSmall} resizeMode="contain" />
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <Text style={styles.dateLabel}>{formatDate(detail.cooked_at)}</Text>
          <Text style={styles.title}>{capitalizeEachWord(detail.recipe_title)}</Text>
          
          <View style={styles.infoBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#15803D" />
            <Text style={styles.infoBadgeText}>Berhasil Dimasak</Text>
          </View>

          <Text style={styles.sectionTitle}>Bahan yang Digunakan</Text>
          
          <View style={styles.card}>
            {detail.consumption_history_items?.map((item: any, index: number) => {
               const name = item.inventory_stock?.item_name || item.item_name || "Bahan";
               const unit = item.inventory_stock?.unit || item.unit || "";
               
               return (
                <View key={item.id} style={[
                  styles.ingredientRow, 
                  index !== detail.consumption_history_items.length - 1 && styles.borderBottom
                ]}>
                  <View style={styles.dot} />
                  <View style={styles.ingredientInfo}>
                    <Text style={styles.ingredientName}>{capitalizeEachWord(name)}</Text>
                  </View>
                  <Text style={styles.ingredientQty}>{item.quantity_used} {unit}</Text>
                </View>
               );
            })}
          </View>

          <Text style={styles.footerNote}>
            * Stok bahan di atas telah otomatis dikurangi saat Anda mengonfirmasi masak.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#FAFAFA" },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, marginBottom: 24 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  logoSmall: { width: 56, height: 32 },
  content: { paddingHorizontal: 24 },
  dateLabel: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#BB0009', marginBottom: 8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 26, color: '#2B2B2B', marginBottom: 12 },
  infoBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DCFCE7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 32 },
  infoBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#15803D' },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#2B2B2B', marginBottom: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F0F0F0' },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  ingredientInfo: { flex: 1 },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#BB0009', marginRight: 12 },
  ingredientName: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#36393B' },
  ingredientQty: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#2B2B2B' },
  footerNote: { marginTop: 24, fontFamily: 'Inter_400Regular', fontSize: 12, color: '#949FA2', fontStyle: 'italic', textAlign: 'center' },
  emptyText: { fontFamily: 'Inter_400Regular', color: '#949FA2', fontSize: 15, marginTop: 10 }
});

export default HistoryDetailScreen;