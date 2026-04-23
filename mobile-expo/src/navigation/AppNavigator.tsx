import React from "react";
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigatorScreenParams } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import LoginScreen from "../screens/LoginScreen";
import SignUpScreen from "../screens/SignUpScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import HomeScreen from "../screens/HomeScreen";
import StokScreen from "../screens/StokScreen";
import ProfilScreen from "../screens/ProfilScreen";
import RiwayatScreen from "../screens/RiwayatScreen";
import RecipeRecommendationScreen from "../screens/RecipeRecommendationScreen";
import RecipeDetailScreen from "../screens/RecipeDetailScreen";
import NotificationScreen from "../screens/NotificationScreen";
import FavoriteRecipesScreen from "../screens/FavoriteRecipesScreen";
import HistoryDetailScreen from "../screens/HistoryDetailScreen";
import { RecommendationItem } from "../types/api";

export type ChefAIStackParamList = {
  RecipeRecommendation: undefined;
  RecipeDetail: { recipe: RecommendationItem };
};

export type MainTabParamList = {
  Beranda: undefined;
  Stok: undefined;
  ChefAI: NavigatorScreenParams<ChefAIStackParamList> | undefined;
  Riwayat: undefined;
  Profil: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Notification: undefined;
  HistoryDetail: { historyId: string };
  FavoriteRecipes: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const ChefAIStack = createNativeStackNavigator<ChefAIStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Floating Chef AI button — rendered via tabBarButton so it can float above the bar
const ChefAIFloatingButton = ({ onPress, accessibilityState }: any) => {
  const focused = accessibilityState?.selected;
  return (
    <Pressable
      onPress={onPress}
      style={styles.chefAIWrapper}
      android_ripple={{ color: "transparent" }}
    >
      <LinearGradient
        colors={["#B9071E", "#FDCB52"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.chefAICircle}
      >
        <Ionicons name="sparkles" size={22} color="#FFFFFF" />
      </LinearGradient>
      <Text style={[styles.chefAILabel, focused && styles.chefAILabelActive]}>
        CHEF AI
      </Text>
    </Pressable>
  );
};

const ChefAINavigator: React.FC = () => (
  <ChefAIStack.Navigator screenOptions={{ headerShown: false }}>
    <ChefAIStack.Screen name="RecipeRecommendation" component={RecipeRecommendationScreen} />
    <ChefAIStack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
  </ChefAIStack.Navigator>
);

const MainTabs: React.FC = () => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 64 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          { height: tabBarHeight, paddingBottom: insets.bottom },
        ],
        tabBarActiveTintColor: "#B9071E",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color }) => {
          const icons: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
            Beranda: { active: "grid", inactive: "grid-outline" },
            Stok:    { active: "file-tray-full", inactive: "file-tray-full-outline" },
            Riwayat: { active: "time", inactive: "time-outline" },
            Profil:  { active: "person", inactive: "person-outline" },
          };
          const icon = icons[route.name];
          if (!icon) return null;
          return <Ionicons name={focused ? icon.active : icon.inactive} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Beranda" component={HomeScreen} options={{ tabBarLabel: "BERANDA" }} />
      <Tab.Screen name="Stok"    component={StokScreen}  options={{ tabBarLabel: "STOK" }} />
      <Tab.Screen
        name="ChefAI"
        component={ChefAINavigator}
        options={{
          tabBarLabel: () => null,
          tabBarIcon:  () => null,
          tabBarButton: (props) => <ChefAIFloatingButton {...props} />,
        }}
      />
      <Tab.Screen name="Riwayat" component={RiwayatScreen} options={{ tabBarLabel: "RIWAYAT" }} />
      <Tab.Screen name="Profil"  component={ProfilScreen}  options={{ tabBarLabel: "PROFIL" }} />
    </Tab.Navigator>
  );
};

const AppNavigator: React.FC = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BB0009" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {session ? (
        <>
          <Stack.Screen name="Main"           component={MainTabs} />
          <Stack.Screen name="Notification"   component={NotificationScreen} />
          <Stack.Screen name="HistoryDetail"  component={HistoryDetailScreen} />
          <Stack.Screen name="FavoriteRecipes" component={FavoriteRecipesScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login"          component={LoginScreen} />
          <Stack.Screen name="SignUp"         component={SignUpScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAFA",
  },

  tabBar: {
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderTopWidth: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    // overflow visible lets the floating circle poke above the bar
    overflow: "visible",
    paddingTop: 8,
    shadowColor: "#2C2F30",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 12,
  },

  tabLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.55,
    marginTop: 2,
  },

  // Wrapper diperluas ke atas agar circle yang float masih bisa di-tap
  chefAIWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 8,
    marginTop: -16,
    paddingTop: 16,
  },

  chefAICircle: {
    position: "absolute",
    top: 0,
    width: 48,
    height: 48,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },

  chefAILabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.55,
    color: "#94A3B8",
  },

  chefAILabelActive: {
    color: "#B9071E",
  },
});

export default AppNavigator;
