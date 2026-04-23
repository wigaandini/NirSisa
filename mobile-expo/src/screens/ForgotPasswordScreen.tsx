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

const LOGO_IMAGE = require("../assets/images/logo.png");

interface ForgotPasswordScreenProps {
  navigation: any;
}

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email) {
      Alert.alert("Error", "Masukkan alamat surel Anda");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) {
      Alert.alert("Gagal", error.message);
    } else {
      setSent(true);
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
          {/* Header Row: Logo */}
          <View style={styles.headerRow}>
            <Image source={LOGO_IMAGE} style={styles.logoSmall} resizeMode="contain" />
          </View>

          {/* Back button */}
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#656C6E" />
            <Text style={styles.backText}>Kembali</Text>
          </TouchableOpacity>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.titleBlack}>Lupa Kata Sandi?</Text>
          </View>

          {sent ? (
            /* Success state */
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons name="mail-outline" size={36} color="#BB0009" />
              </View>
              <Text style={styles.successTitle}>Surel Terkirim!</Text>
              <Text style={styles.successBody}>
                Kami telah mengirimkan tautan pengaturan ulang kata sandi ke{" "}
                <Text style={styles.successEmail}>{email}</Text>. Periksa kotak masuk Anda.
              </Text>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.navigate("Login")}
              >
                <Text style={styles.secondaryButtonText}>Kembali ke Masuk</Text>
                <Ionicons name="arrow-forward" size={18} color="#BB0009" />
              </TouchableOpacity>
            </View>
          ) : (
            /* Form state */
            <>
              <View style={styles.subtitleContainer}>
                <Text style={styles.subtitleGray}>
                  Masukkan surel akun Anda dan kami akan mengirimkan tautan untuk mengatur ulang kata sandi.
                </Text>
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

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSend}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Kirim Tautan</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
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
    alignItems: "center",
    marginBottom: 24,
  },
  logoSmall: {
    width: 72,
    height: 40,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 32,
  },
  backText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#656C6E",
  },
  titleContainer: {
    marginBottom: 16,
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
    lineHeight: 26,
  },
  inputGroup: {
    marginBottom: 24,
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
  successContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: 16,
    gap: 16,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFF0F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  successTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#2B2B2B",
  },
  successBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#656C6E",
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 16,
  },
  successEmail: {
    fontFamily: "Inter_600SemiBold",
    color: "#BB0009",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 14,
    gap: 6,
    borderWidth: 1.5,
    borderColor: "#BB0009",
    alignSelf: "stretch",
  },
  secondaryButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#BB0009",
  },
});

export default ForgotPasswordScreen;