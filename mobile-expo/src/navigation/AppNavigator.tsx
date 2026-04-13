import React from "react";
import { View, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { useAuth } from "../context/AuthContext";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import LoginScreen from "../screens/LoginScreen";
import SignUpScreen from "../screens/SignUpScreen";
import HomeScreen from "../screens/HomeScreen";
import StokScreen from "../screens/StokScreen";
import ProfilScreen from "../screens/ProfilScreen";
import RiwayatScreen from "../screens/RiwayatScreen";
import RecipeRecommendationScreen from "../screens/RecipeRecommendationScreen";
import RecipeDetailScreen from "../screens/RecipeDetailScreen";
import NotificationScreen from "../screens/NotificationScreen";

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Main: { screen?: string } | undefined;
  Notification: undefined;
};

export type ChefAIStackParamList = {
  RecipeRecommendation: undefined;
  RecipeDetail: { recipeId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const ChefAIStack = createNativeStackNavigator<ChefAIStackParamList>();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Beranda: { active: "grid", inactive: "grid-outline" },
  Stok: { active: "file-tray-full", inactive: "file-tray-full-outline" },
  ChefAI: { active: "sparkles", inactive: "sparkles-outline" },
  Riwayat: { active: "time", inactive: "time-outline" },
  Profil: { active: "person", inactive: "person-outline" },
};

const ChefAITabIcon = ({ focused, size }: { focused: boolean; size: number }) => (
  <View style={styles.chefAIButton}>
    <Ionicons name="sparkles" size={size} color="#FFFFFF" />
  </View>
);

const ChefAINavigator: React.FC = () => (
  <ChefAIStack.Navigator screenOptions={{ headerShown: false }}>
    <ChefAIStack.Screen name="RecipeRecommendation" component={RecipeRecommendationScreen} />
    <ChefAIStack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
  </ChefAIStack.Navigator>
);

const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: "#BB0009",
        tabBarInactiveTintColor: "#949FA2",
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === "ChefAI") {
            return <ChefAITabIcon focused={focused} size={size - 4} />;
          }
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.active : icons.inactive;
          return <Ionicons name={iconName} size={size - 2} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Beranda"
        component={HomeScreen}
        options={{ tabBarLabel: "BERANDA" }}
      />
      <Tab.Screen
        name="Stok"
        component={StokScreen}
        options={{ tabBarLabel: "STOK" }}
      />
      <Tab.Screen
        name="ChefAI"
        component={ChefAINavigator}
        options={{
          tabBarLabel: "CHEF AI",
          tabBarActiveTintColor: "#BB0009",
        }}
      />
      <Tab.Screen
        name="Riwayat"
        component={RiwayatScreen}
        options={{ tabBarLabel: "RIWAYAT" }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfilScreen}
        options={{ tabBarLabel: "PROFIL" }}
      />
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
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Notification" component={NotificationScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
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
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    height: Platform.OS === "ios" ? 88 : 70,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 28 : 10,
  },
  tabLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  chefAIButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#BB0009",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    shadowColor: "#BB0009",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default AppNavigator;
