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
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";

WebBrowser.maybeCompleteAuthSession();

const LOGO_IMAGE = require("../assets/images/logo.png");

interface SignUpScreenProps {
  navigation: any;
}

const SignUpScreen: React.FC<SignUpScreenProps> = ({ navigation }) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!fullName || !email || !password) {
      Alert.alert("Error", "Semua field harus diisi");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Kata sandi minimal 6 karakter");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: fullName } },
    });
    if (!error && data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        display_name: fullName,
      });
    }
    setLoading(false);
    if (error) {
      Alert.alert("Pendaftaran Gagal", error.message);
    } else {
      Alert.alert("Berhasil", "Akun berhasil dibuat! Silakan login.", [
        { text: "OK", onPress: () => navigation.navigate("Login") },
      ]);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      // 1. Buat URL Redirect yang mengarah kembali ke HP
      const redirectUrl = AuthSession.makeRedirectUri({ 
        scheme: "nirsisa",
        path: "auth-callback" // Opsional, bisa nirsisa:// saja
      });

      // 2. Minta URL Login dari Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { 
          redirectTo: redirectUrl, 
          skipBrowserRedirect: true 
        },
      });

      if (error || !data.url) throw error || new Error("Gagal mendapatkan URL login");

      // 3. Buka browser dan TUNGGU hasilnya (Redirect kembali ke app)
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      // 4. Jika user berhasil login dan kembali ke aplikasi
      if (result.type === "success" && result.url) {
        // Ekstrak token dari URL (URL biasanya mengandung #access_token=...)
        const urlPart = result.url.split("#")[1];
        const params = new URLSearchParams(urlPart);
        
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");

        if (access_token && refresh_token) {
          // Simpan session ke Supabase Client di Mobile
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (sessionError) throw sessionError;
          
          // Pindah ke halaman utama
          navigation.replace("Main");
        }
      }
    } catch (error: any) {
      Alert.alert("Google Login Error", error.message);
    }
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

          {/* Full Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>NAMA LENGKAP</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Yovanka"
                placeholderTextColor="#BFD3D6"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>SUREL</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="yovanka@gmail.com"
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

          {/* Sign Up Button */}
          <TouchableOpacity style={styles.primaryButton} onPress={handleSignUp} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Daftar</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ATAU DAFTAR DENGAN</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Button */}
          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignUp}>
            <Text style={styles.googleButtonText}>Google</Text>
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.bottomLinkContainer}>
            <Text style={styles.bottomLinkGray}>Sudah memiliki akun?</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={styles.bottomLinkRed}>  Masuk kembali</Text>
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
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#BB0009",
    borderRadius: 28,
    paddingVertical: 16,
    marginTop: 8,
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

export default SignUpScreen;