import React from "react";
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const LOGO_IMAGE = require("../assets/images/logo.png");

interface HeaderProps {
  variant?: "main" | "back";
  onBack?: () => void;
  onNotificationPress?: () => void;
  onAvatarPress?: () => void;
  photoUri?: string | null;
  rightElement?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({
  variant = "main",
  onBack,
  onNotificationPress,
  onAvatarPress,
  photoUri,
  rightElement,
}) => {
  if (variant === "back") {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={22} color="#2B2B2B" />
        </TouchableOpacity>
        <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />
        {rightElement ?? <View style={styles.spacer} />}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />
      <View style={styles.right}>
        <TouchableOpacity style={styles.notifButton} onPress={onNotificationPress}>
          <Ionicons name="notifications-outline" size={22} color="#2B2B2B" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.avatar} onPress={onAvatarPress}>
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.avatarImage}
            />
          ) : (
            <Ionicons name="person" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    width: 56,
    height: 32,
  },
  right: {
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
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  spacer: {
    width: 40,
  },
});

export default Header;
