import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const LOGO_IMAGE = require("../assets/images/logo.png");

interface MainScreenProps {
  navigation: any;
}

const MainScreen: React.FC<MainScreenProps> = ({ navigation }) => {
  const handleLogout = () => {
    // TODO: clear session
    navigation.replace("Login");
  };

  return (
    <View style={styles.container}>
      <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>NirSisa</Text>
      <Text style={styles.subtitle}>Halaman utama (dummy)</Text>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#BB0009" />
        <Text style={styles.logoutText}>Keluar (simulasi session expired)</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  logo: {
    width: 100,
    height: 56,
    marginBottom: 16,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: "#BB0009",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#656C6E",
    marginBottom: 8,
  },
  description: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#949FA2",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#BB0009",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  logoutText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#BB0009",
  },
});

export default MainScreen;