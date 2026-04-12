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
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";

const LOGO_IMAGE = require("../assets/images/logo.png");

type Props = NativeStackScreenProps<RootStackParamList, "Notification">;

const NotificationScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#2B2B2B" />
          </TouchableOpacity>
          <Image source={LOGO_IMAGE} style={styles.logoSmall} resizeMode="contain" />
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color="#FFFFFF" />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Notifikasi</Text>
        <Text style={styles.subtitle}>Jaga kesegaran dapur Anda dan kurangi limbah.</Text>

        {/* Card 1 — Kedaluwarsa Besok */}
        <View style={[styles.card, styles.cardRedBorder]}>
          <View style={styles.cardIconWrap}>
            <View style={[styles.iconCircle, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="warning" size={22} color="#BB0009" />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Kedaluwarsa Besok</Text>
              <Text style={styles.cardDesc}>
                Bayam Organik dan Yogurt harus segera digunakan.
              </Text>
              <TouchableOpacity style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Lihat Resep</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Card 2 — Kedaluwarsa dalam 2 Hari */}
        <View style={[styles.card, styles.cardOrangeBorder]}>
          <View style={styles.cardIconWrap}>
            <View style={[styles.iconCircle, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="timer-outline" size={22} color="#D97706" />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Kedaluwarsa dalam 2 Hari</Text>
              <Text style={styles.cardDesc}>
                3 bahan di inventaris Anda termasuk mendekati tanggal kedaluwarsa.
              </Text>
            </View>
          </View>
        </View>

        {/* Card 3 — Rekomendasi Chef AI */}
        <View style={[styles.card, styles.cardAI]}>
          <Text style={styles.cardAILabel}>Rekomendasi Chef AI</Text>
          <Text style={styles.cardAIDesc}>
            Saya bisa membantu Anda membuat{" "}
            <Text style={styles.cardAIBold}>Pasta Bayam Krim</Text>
            {" "}malam ini menggunakan bahan yang hampir kedaluwarsa!
          </Text>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Mulai Masak</Text>
          </TouchableOpacity>
        </View>

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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  logoSmall: {
    width: 56,
    height: 32,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#36393B",
    alignItems: "center",
    justifyContent: "center",
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
});

export default NotificationScreen;
