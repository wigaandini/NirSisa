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
import { ChefAIStackParamList } from "../navigation/AppNavigator";
import { RECIPES, Ingredient, RecipeStep } from "../data/recipes";

const LOGO_IMAGE = require("../assets/images/logo.png");

type Props = NativeStackScreenProps<ChefAIStackParamList, "RecipeDetail">;

const IngredientRow: React.FC<{ item: Ingredient }> = ({ item }) => {
  const isInsufficient = item.status === "insufficient";
  const isLow = item.status === "low";

  return (
    <View style={styles.ingredientRow}>
      <View style={styles.ingredientInfo}>
        <Text style={styles.ingredientName}>{item.name}</Text>
        <Text style={[styles.ingredientSub, isInsufficient && styles.ingredientSubInsufficient]}>
          {item.amount}
          {" • "}
          {item.availableLabel}
        </Text>
      </View>
      <View style={[
        styles.ingredientStatus,
        isInsufficient && styles.ingredientStatusRed,
        isLow && styles.ingredientStatusGreen,
        item.status === "available" && styles.ingredientStatusGreen,
      ]}>
        <Ionicons
          name={isInsufficient ? "close" : "checkmark"}
          size={16}
          color="#FFFFFF"
        />
      </View>
    </View>
  );
};

const StepRow: React.FC<{ item: RecipeStep; isLast: boolean }> = ({ item, isLast }) => (
  <View style={styles.stepRow}>
    <View style={styles.stepLeft}>
      <View style={styles.stepCircle}>
        <Text style={styles.stepNumber}>{item.number}</Text>
      </View>
      {!isLast && <View style={styles.stepLine} />}
    </View>
    <View style={[styles.stepContent, isLast && { marginBottom: 0 }]}>
      <Text style={styles.stepTitle}>{item.title}</Text>
      <Text style={styles.stepDescription}>{item.description}</Text>
    </View>
  </View>
);

const RecipeDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const recipe = RECIPES.find((r) => r.id === route.params.recipeId);

  if (!recipe) {
    return (
      <View style={styles.flex}>
        <Text style={{ padding: 24, fontFamily: "Inter_400Regular" }}>
          Resep tidak ditemukan.
        </Text>
      </View>
    );
  }

  const hasInsufficient = recipe.ingredientList.some((i) => i.status === "insufficient");

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
          <TouchableOpacity style={styles.heartButton}>
            <Ionicons name="heart-outline" size={22} color="#2B2B2B" />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Text style={styles.title}>{recipe.name}</Text>

        {/* Warning Banner */}
        {hasInsufficient && (
          <View style={styles.warningBanner}>
            <Ionicons name="information-circle" size={20} color="#D97706" style={styles.warningIcon} />
            <Text style={styles.warningText}>
              Mohon cek kondisi bahan secara manual untuk memastikan kesegaran dan menghindari bahan
              yang sudah busuk.
            </Text>
          </View>
        )}

        {/* Bahan-Bahan */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bahan-Bahan</Text>
          <Text style={styles.sectionMeta}>{recipe.ingredientList.length} item total</Text>
        </View>
        <View style={styles.card}>
          {recipe.ingredientList.map((item, index) => (
            <View key={item.id}>
              <IngredientRow item={item} />
              {index < recipe.ingredientList.length - 1 && (
                <View style={styles.separator} />
              )}
            </View>
          ))}
        </View>

        {/* Langkah-Langkah */}
        <Text style={[styles.sectionTitle, { marginTop: 28, marginBottom: 16 }]}>
          Langkah-Langkah
        </Text>
        <View style={styles.card}>
          {recipe.stepList.map((step, index) => (
            <StepRow
              key={step.id}
              item={step}
              isLast={index === recipe.stepList.length - 1}
            />
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Sticky Bottom Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.confirmButton} activeOpacity={0.85}>
          <Text style={styles.confirmButtonText}>Konfirmasi Masak</Text>
        </TouchableOpacity>
      </View>
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
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
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
  heartButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: "#2B2B2B",
    lineHeight: 36,
    marginBottom: 16,
  },
  warningBanner: {
    flexDirection: "row",
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 14,
    marginBottom: 24,
    alignItems: "flex-start",
  },
  warningIcon: {
    marginRight: 10,
    marginTop: 1,
  },
  warningText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#92400E",
    lineHeight: 19,

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
  sectionMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#949FA2",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  // ── Ingredients ──
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  ingredientIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  ingredientIconInsufficient: {
    backgroundColor: "#FEF2F2",
  },
  ingredientInitial: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#D97706",
  },
  ingredientInitialInsufficient: {
    color: "#BB0009",
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#2B2B2B",
    marginBottom: 2,
  },
  ingredientSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#949FA2",
  },
  ingredientSubInsufficient: {
    color: "#BB0009",
  },
  ingredientStatus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ingredientStatusGreen: {
    backgroundColor: "#15803D",
  },
  ingredientStatusRed: {
    backgroundColor: "#BB0009",
  },
  separator: {
    height: 1,
    backgroundColor: "#F5F5F5",
    marginLeft: 56,
  },
  // ── Steps ──
  stepRow: {
    flexDirection: "row",
    paddingTop: 16,
  },
  stepLeft: {
    alignItems: "center",
    width: 32,
    marginRight: 14,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#BB0009",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  stepLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#F0F0F0",
    marginTop: 6,
    marginBottom: 0,
    minHeight: 20,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 20,
  },
  stepTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#2B2B2B",
    marginBottom: 4,
    marginTop: 6,
  },
  stepDescription: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#656C6E",
    lineHeight: 19,
  },
  // ── Bottom Bar ──
  bottomBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  confirmButton: {
    backgroundColor: "#BB0009",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  confirmButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});

export default RecipeDetailScreen;
