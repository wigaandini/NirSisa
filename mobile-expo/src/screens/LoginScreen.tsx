import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const LOGO_IMAGE = require("../assets/images/logo.png");

interface LoginScreenProps {
  navigation: any;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    // TODO: integrate with backend auth
    navigation.replace("Main");
  };

  const handleGoogleLogin = () => {
    // TODO: integrate Google OAuth
    navigation.replace("Main");
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Header Row: Logo + Globe */}
          <View style={styles.headerRow}>
            <Image source={LOGO_IMAGE} style={styles.logoSmall} resizeMode="contain" />
            <TouchableOpacity style={styles.globeButton}>
              <Ionicons name="globe-outline" size={24} color="#656C6E" />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.titleBlack}>Selamat datang di</Text>
            <Text style={styles.titleRed}>NirSisa</Text>
          </View>

          {/* Subtitle */}
          <View style={styles.subtitleContainer}>
            <Text style={styles.subtitleGray}>AI pendamping Anda untuk</Text>
            <Text style={styles.subtitleRed}>dapur tanpa sisa makanan.</Text>
          </View>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>SUREL</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="chef@nirsisa.com"
                placeholderTextColor="#BFD3D6"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>KATA SANDI</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••"
                placeholderTextColor="#BFD3D6"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={22}
                  color="#949FA2"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity style={styles.forgotContainer}>
            <Text style={styles.forgotText}>Lupa Kata Sandi?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
            <Text style={styles.primaryButtonText}>Masuk</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ATAU MASUK DENGAN</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Button */}
          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
            <Text style={styles.googleButtonText}>Google</Text>
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={styles.bottomLinkContainer}>
            <Text style={styles.bottomLinkGray}>Tidak memiliki akun?</Text>
            <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
              <Text style={styles.bottomLinkRed}>  Buat akun</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 30,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  logoSmall: {
    width: 72,
    height: 40,
  },
  globeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    marginBottom: 12,
  },
  titleBlack: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: "#2B2B2B",
    lineHeight: 40,
  },
  titleRed: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: "#BB0009",
    lineHeight: 40,
  },
  subtitleContainer: {
    marginBottom: 32,
  },
  subtitleGray: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#656C6E",
    lineHeight: 24,
  },
  subtitleRed: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#BB0009",
    lineHeight: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#36393B",
    letterSpacing: 1,
    marginBottom: 6,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#2B2B2B",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: "absolute",
    right: 14,
    padding: 4,
  },
  forgotContainer: {
    alignSelf: "flex-end",
    marginBottom: 24,
    marginTop: 4,
  },
  forgotText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#BB0009",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#BB0009",
    borderRadius: 28,
    paddingVertical: 16,
    gap: 8,
    shadowColor: "#BB0009",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#FFFFFF",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E8E8E8",
  },
  dividerText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "#949FA2",
    marginHorizontal: 12,
    letterSpacing: 0.5,
  },
  googleButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  googleButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#2B2B2B",
  },
  bottomLinkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: "auto",
    paddingTop: 24,
  },
  bottomLinkGray: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#656C6E",
  },
  bottomLinkRed: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#BB0009",
  },
});

export default LoginScreen;