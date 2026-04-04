import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface PlaceholderScreenProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const PlaceholderScreen: React.FC<PlaceholderScreenProps> = ({ title, icon }) => {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color="#BFD3D6" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Segera hadir</Text>
    </View>
  );
};

export const ChefAIScreen = () => (
  <PlaceholderScreen title="Chef AI" icon="sparkles-outline" />
);

export const RiwayatScreen = () => (
  <PlaceholderScreen title="Riwayat" icon="time-outline" />
);

export const ProfilScreen = () => (
  <PlaceholderScreen title="Profil" icon="person-outline" />
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#2B2B2B",
    marginTop: 16,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#949FA2",
    marginTop: 4,
  },
});

export default PlaceholderScreen;