import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";

const LOGO_IMAGE = require("../assets/images/logo.png");

interface HistoryItem {
  id: string;
  date: string;
  recipeName: string;
  description: string;
}

const HISTORY: HistoryItem[] = [
  {
    id: "1",
    date: "24 OKT 2023",
    recipeName: "Orak-Arik Sayur Gurih",
    description: "Menggunakan sawi hijau.",
  },
  {
    id: "2",
    date: "21 OKT 2023",
    recipeName: "Rendang",
    description: "Menggunakan daging.",
  },
  {
    id: "3",
    date: "18 OKT 2023",
    recipeName: "Omelette",
    description: "Menggunakan telur.",
  },
  {
    id: "4",
    date: "15 OKT 2023",
    recipeName: "Sup Tomat & Basil",
    description: "Menggunakan tomat dan basil.",
  },
  {
    id: "5",
    date: "12 OKT 2023",
    recipeName: "Pasta Aglio Olio",
    description: "Menggunakan bawang putih dan pasta.",
  },
];

const RiwayatScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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

        {/* Stat Cards */}
        <View style={styles.statRow}>
          <View style={[styles.statCard, styles.statCardBeige]}>
            <Text style={[styles.statNumber, { color: "#92400E" }]}>24</Text>
            <Text style={[styles.statLabel, { color: "#B45309" }]}>RESEP DIMASAK</Text>
          </View>
          <View style={[styles.statCard, styles.statCardPink]}>
            <Text style={[styles.statNumber, { color: "#BB0009" }]}>52</Text>
            <Text style={[styles.statLabel, { color: "#BB0009" }]}>BAHAN DIMASAK</Text>
          </View>
        </View>

        {/* Aktivitas Terbaru */}
        <Text style={styles.sectionTitle}>Aktivitas Terbaru</Text>

        {/* Timeline */}
        <View style={styles.timeline}>
          {HISTORY.map((item, index) => {
            const isLast = index === HISTORY.length - 1;
            return (
              <View key={item.id} style={styles.timelineRow}>
                {/* Left: line + circle */}
                <View style={styles.timelineLeft}>
                  {/* Top line segment */}
                  <View style={[styles.timelineLine, index === 0 && styles.timelineLineHidden]} />
                  {/* Circle */}
                  <View style={styles.timelineCircle}>
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </View>
                  {/* Bottom line segment */}
                  <View style={[styles.timelineLine, isLast && styles.timelineLineHidden]} />
                </View>

                {/* Right: card */}
                <View style={styles.timelineCard}>
                  <Text style={styles.cardDate}>{item.date}</Text>
                  <Text style={styles.cardName}>{item.recipeName}</Text>
                  <Text style={styles.cardDesc}>{item.description}</Text>
                </View>
              </View>
            );
          })}
        </View>

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
});

export default RiwayatScreen;
