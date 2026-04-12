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

const EXPIRING_ITEMS = [
  { id: "1", name: "Daging Sapi", qty: "250g", badge: "HARI INI", badgeColor: "#BB0009" },
  { id: "2", name: "Tahu", qty: "100g", badge: "2 HARI LAGI", badgeColor: "#FDCB52" },
  { id: "3", name: "Alpukat", qty: "4 buah", badge: "3 HARI LAGI", badgeColor: "#FDCB52" },
];

const RECIPES = [
  {
    id: "1",
    tag: "MENGGUNAKAN DAGING SAPI",
    name: "Bakso Sapi",
    steps: 5,
    ingredients: 4,
    likes: 120,
  },
  {
    id: "2",
    tag: "MENGGUNAKAN TAHU DAN DAUN SELEDRI",
    name: "Perkedel Tahu",
    steps: 4,
    ingredients: 5,
    likes: 85,
  },
];

const HomeScreen: React.FC = () => {
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

        {/* Greeting */}
        <Text style={styles.greeting}>Halo, Clement!</Text>
        <Text style={styles.greetingSub}>
          Kamu punya 3 bahan yang harus kamu perhatikan minggu ini.
        </Text>

        {/* Segera Kedaluwarsa */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Segera Kedaluwarsa</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>LIHAT SEMUA</Text>
          </TouchableOpacity>
        </View>

        {EXPIRING_ITEMS.map((item) => {
          const isWarning = item.badge === "2 HARI LAGI" || item.badge === "3 HARI LAGI";

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.expiryCard,
                isWarning && {
                  backgroundColor: "#FFF7ED",
                  borderColor: "#FFEDD5",
                },
              ]}
            >
              <View
                style={[styles.expiryBadge, { backgroundColor: item.badgeColor }]}
              >
                <Text style={styles.expiryBadgeText}>{item.badge}</Text>
              </View>
              <View style={styles.expiryInfo}>
                <Text style={styles.expiryName}>{item.name}</Text>
                <Text style={styles.expiryQty}>{item.qty}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Rekomendasi Chef AI */}
        <View style={[styles.sectionHeader, { marginTop: 28 }]}>
          <Text style={styles.sectionTitle}>Rekomendasi Chef AI</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Main", { screen: "ChefAI" })}>
            <Text style={styles.seeAll}>LIHAT SEMUA</Text>
          </TouchableOpacity>
        </View>

        {RECIPES.map((recipe) => (
          <TouchableOpacity key={recipe.id} style={styles.recipeCard}>
            <Text style={styles.recipeTag}>{recipe.tag}</Text>
            <Text style={styles.recipeName}>{recipe.name}</Text>
            <View style={styles.recipeMeta}>
              <View style={styles.recipeMetaItem}>
                <Ionicons name="list-outline" size={14} color="#656C6E" />
                <Text style={styles.recipeMetaText}>{recipe.steps} Tahap</Text>
              </View>
              <View style={styles.recipeMetaItem}>
                <Ionicons name="cube-outline" size={14} color="#656C6E" />
                <Text style={styles.recipeMetaText}>{recipe.ingredients} Bahan</Text>
              </View>
              <View style={styles.recipeMetaItem}>
                <Ionicons name="heart" size={14} color="#BB0009" />
                <Text style={styles.recipeMetaText}>{recipe.likes} Suka</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {/* Active Stock Banner */}
        <View style={styles.stockBanner}>
          <Ionicons name="file-tray-full-outline" size={24} color="#FFFFFF" />
          <Text style={styles.stockBannerNumber}>42</Text>
          <Text style={styles.stockBannerLabel}>BAHAN AKTIF DI STOK</Text>
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
    marginBottom: 24,
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
  greeting: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: "#2B2B2B",
    marginBottom: 4,
  },
  greetingSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#656C6E",
    lineHeight: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#2B2B2B",
  },
  seeAll: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#BB0009",
    letterSpacing: 0.3,
  },
  expiryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  expiryBadge: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  expiryBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  expiryInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  expiryName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#2B2B2B",
  },
  expiryQty: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#949FA2",
    marginTop: 2,
  },
  recipeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  recipeTag: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#BB0009",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  recipeName: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#2B2B2B",
    marginBottom: 10,
  },
  recipeMeta: {
    flexDirection: "row",
    gap: 16,
  },
  recipeMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  recipeMetaText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#656C6E",
  },
  stockBanner: {
    backgroundColor: "#BB0009",
    borderRadius: 18,
    padding: 24,
    marginTop: 20,
  },
  stockBannerNumber: {
    fontFamily: "Inter_700Bold",
    fontSize: 48,
    color: "#FFFFFF",
    marginTop: 4,
  },
  stockBannerLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
    letterSpacing: 0.5,
    opacity: 0.9,
  },
});

export default HomeScreen;