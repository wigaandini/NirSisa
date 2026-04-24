import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { supabase } from "../services/supabase";
import { useAuth } from "../context/AuthContext";
import { unregisterPushToken } from "../services/notifications";
import * as ImagePicker from "expo-image-picker";

const LOGO_IMAGE = require("../assets/images/logo.png");
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.72;

// ── Change Password Modal ──────────────────────────────────────
interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ visible, onClose }) => {
  const slideAnim = React.useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = React.useRef(new Animated.Value(0)).current;

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSavePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Error", "Kata sandi baru harus diisi");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Konfirmasi kata sandi tidak cocok");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "Kata sandi minimal 6 karakter");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      Alert.alert("Gagal", error.message);
    } else {
      Alert.alert("Berhasil", "Kata sandi berhasil diperbarui");
      handleClose();
    }
  };

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_HEIGHT,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View
          style={[
            modalStyles.backdrop,
            { opacity: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) },
          ]}
        />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={modalStyles.kavWrapper}
        pointerEvents="box-none"
      >
        <Animated.View style={[modalStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>Ganti Kata Sandi</Text>
            <TouchableOpacity style={modalStyles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={20} color="#2B2B2B" />
            </TouchableOpacity>
          </View>

          <Text style={modalStyles.sheetSubtitle}>
            Pastikan kata sandi baru Anda kuat dan belum pernah digunakan sebelumnya.
          </Text>

          <Text style={modalStyles.fieldLabel}>KATA SANDI LAMA</Text>
          <View style={modalStyles.inputRow}>
            <TextInput
              style={modalStyles.input}
              placeholder="••••••••"
              placeholderTextColor="#BFD3D6"
              secureTextEntry={!showOld}
              value={oldPassword}
              onChangeText={setOldPassword}
            />
            <TouchableOpacity onPress={() => setShowOld(!showOld)} style={modalStyles.eyeBtn}>
              <Ionicons name={showOld ? "eye-off-outline" : "eye-outline"} size={20} color="#949FA2" />
            </TouchableOpacity>
          </View>

          <Text style={modalStyles.fieldLabel}>KATA SANDI BARU</Text>
          <View style={modalStyles.inputRow}>
            <TextInput
              style={modalStyles.input}
              placeholder="••••••••"
              placeholderTextColor="#BFD3D6"
              secureTextEntry={!showNew}
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TouchableOpacity onPress={() => setShowNew(!showNew)} style={modalStyles.eyeBtn}>
              <Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={20} color="#949FA2" />
            </TouchableOpacity>
          </View>

          <Text style={modalStyles.fieldLabel}>KONFIRMASI KATA SANDI BARU</Text>
          <View style={modalStyles.inputRow}>
            <TextInput
              style={modalStyles.input}
              placeholder="••••••••"
              placeholderTextColor="#BFD3D6"
              secureTextEntry={!showConfirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={modalStyles.eyeBtn}>
              <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={20} color="#949FA2" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={modalStyles.saveButton} activeOpacity={0.85} onPress={handleSavePassword} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={modalStyles.saveButtonText}>Simpan Perubahan</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={modalStyles.cancelButton} onPress={handleClose}>
            <Text style={modalStyles.cancelButtonText}>Batal</Text>
          </TouchableOpacity>

          <View style={{ height: Platform.OS === "ios" ? 20 : 8 }} />
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Ganti Foto Modal ───────────────────────────────────────────
const FOTO_SHEET_HEIGHT = 320;

const GantiFotoModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onPhotoSelected: (uri: string) => void;
}> = ({ visible, onClose, onPhotoSelected }) => {
  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Izin Diperlukan", "Izinkan akses kamera untuk mengambil foto.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      onPhotoSelected(result.assets[0].uri);
      onClose();
    }
  };

  const handleGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Izin Diperlukan", "Izinkan akses galeri untuk memilih foto.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      onPhotoSelected(result.assets[0].uri);
      onClose();
    }
  };
  const slideAnim = React.useRef(new Animated.Value(FOTO_SHEET_HEIGHT)).current;
  const backdropAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: FOTO_SHEET_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[modalStyles.backdrop, { opacity: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) }]}
        />
      </TouchableWithoutFeedback>

      <Animated.View style={[fotoStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={fotoStyles.dragHandle} />

        <Text style={fotoStyles.title}>Ganti Foto Profil</Text>
        <Text style={fotoStyles.subtitle}>Pilih cara untuk memperbarui foto Anda</Text>

        <View style={fotoStyles.optionCard}>
          <TouchableOpacity style={fotoStyles.optionRow} activeOpacity={0.7} onPress={handleCamera}>
            <View style={[fotoStyles.optionIcon, { backgroundColor: "#BB0009" }]}>
              <Ionicons name="camera-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={fotoStyles.optionText}>
              <Text style={fotoStyles.optionTitle}>Ambil Foto</Text>
              <Text style={fotoStyles.optionSub}>Gunakan kamera ponsel Anda</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#BFD3D6" />
          </TouchableOpacity>

          <View style={fotoStyles.optionDivider} />

          <TouchableOpacity style={fotoStyles.optionRow} activeOpacity={0.7} onPress={handleGallery}>
            <View style={[fotoStyles.optionIcon, { backgroundColor: "#F59E0B" }]}>
              <Ionicons name="images-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={fotoStyles.optionText}>
              <Text style={fotoStyles.optionTitle}>Pilih dari Galeri</Text>
              <Text style={fotoStyles.optionSub}>Pilih foto yang sudah ada</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#BFD3D6" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={fotoStyles.cancelButton} onPress={onClose} activeOpacity={0.7}>
          <Text style={fotoStyles.cancelText}>Batal</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const fotoStyles = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#F5F5F5",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#BFD3D6",
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: "#2B2B2B",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#656C6E",
    textAlign: "center",
    marginBottom: 20,
  },
  optionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#2B2B2B",
    marginBottom: 2,
  },
  optionSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#949FA2",
  },
  optionDivider: {
    height: 1,
    backgroundColor: "#F5F5F5",
    marginLeft: 74,
  },
  cancelButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#2B2B2B",
  },
});

// ── Edit Profile Modal ─────────────────────────────────────────
interface EditProfileModalProps {
  visible: boolean;
  name: string;
  email: string;
  onSave: (name: string, email: string) => void;
  onClose: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ visible, name, email, onSave, onClose }) => {
  const slideAnim = React.useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = React.useRef(new Animated.Value(0)).current;
  const [localName, setLocalName] = useState(name);
  const [localEmail, setLocalEmail] = useState(email);

  React.useEffect(() => {
    if (visible) {
      setLocalName(name);
      setLocalEmail(email);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[modalStyles.backdrop, { opacity: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) }]}
        />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={modalStyles.kavWrapper} pointerEvents="box-none">
        <Animated.View style={[modalStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>Edit Profil</Text>
            <TouchableOpacity style={modalStyles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={20} color="#2B2B2B" />
            </TouchableOpacity>
          </View>

          <Text style={modalStyles.sheetSubtitle}>
            Perbarui nama dan email yang terdaftar di akun Anda.
          </Text>

          <Text style={modalStyles.fieldLabel}>NAMA LENGKAP</Text>
          <View style={modalStyles.inputRow}>
            <Ionicons name="person-outline" size={18} color="#949FA2" style={{ marginRight: 10 }} />
            <TextInput
              style={modalStyles.input}
              value={localName}
              onChangeText={setLocalName}
              placeholderTextColor="#BFD3D6"
              placeholder="Nama lengkap"
            />
          </View>

          <Text style={modalStyles.fieldLabel}>EMAIL</Text>
          <View style={modalStyles.inputRow}>
            <Ionicons name="mail-outline" size={18} color="#949FA2" style={{ marginRight: 10 }} />
            <TextInput
              style={modalStyles.input}
              value={localEmail}
              onChangeText={setLocalEmail}
              placeholderTextColor="#BFD3D6"
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity style={modalStyles.saveButton} activeOpacity={0.85} onPress={() => { onSave(localName, localEmail); onClose(); }}>
            <Text style={modalStyles.saveButtonText}>Simpan Perubahan</Text>
          </TouchableOpacity>

          <TouchableOpacity style={modalStyles.cancelButton} onPress={onClose}>
            <Text style={modalStyles.cancelButtonText}>Batal</Text>
          </TouchableOpacity>

          <View style={{ height: Platform.OS === "ios" ? 20 : 8 }} />
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Main Screen ────────────────────────────────────────────────
const ProfilScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session, signOut, photoUri: contextPhotoUri, setPhotoUri, uploadAndPersistPhoto } = useAuth();
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(contextPhotoUri);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [gantiFotoVisible, setGantiFotoVisible] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [bahanCount, setBahanCount] = useState<number>(0);
  const [resepCount, setResepCount] = useState<number>(0);

  // Keep local copy in sync when context changes (e.g. first load)
  useEffect(() => {
    setLocalPhotoUri(contextPhotoUri);
  }, [contextPhotoUri]);

  const handlePhotoSelected = async (uri: string) => {
    setLocalPhotoUri(uri);   // updates this screen immediately (optimistic)
    // ▼▼▼ FIX BUG 1: upload ke Supabase Storage + simpan URL ke profiles.avatar_url ▼▼▼
    const persistedUrl = await uploadAndPersistPhoto(uri);
    if (persistedUrl) {
      setLocalPhotoUri(persistedUrl); // gunakan URL persisten
    }
    // ▲▲▲
  };

  // ▼▼▼ FIX BUG 2: useFocusEffect agar count refresh saat kembali ke halaman ▼▼▼
  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      setProfileEmail(session.user.email ?? "");
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", session.user.id)
        .single()
        .then(({ data }) => {
          if (data?.display_name) {
            setProfileName(data.display_name);
          } else {
            const metaName = session.user.user_metadata?.display_name ?? "";
            setProfileName(metaName);
          }
        });

      supabase
        .from("inventory_with_spi")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .then(({ count }) => setBahanCount(count ?? 0));

      supabase
        .from("user_favorites")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .then(({ count }) => setResepCount(count ?? 0));
    }, [session])
  );
  // ▲▲▲

  const handleSaveName = async () => {
    if (!session?.user?.id) return;
    if (!profileName.trim()) {
      Alert.alert("Peringatan", "Nama tidak boleh kosong");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: session.user.id,
          display_name: profileName.trim(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "id",
        });

      if (error) throw error;
      Alert.alert("Berhasil", "Nama lengkap berhasil diperbarui");
    } catch (error: any) {
      console.error("Update Profile Error:", error.message);
      Alert.alert("Gagal", `Tidak dapat menyimpan perubahan: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Keluar Akun", "Apakah Anda yakin ingin keluar?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Keluar",
        style: "destructive",
        onPress: async () => {
          // Nonaktifkan push token sebelum logout
          try {
            await unregisterPushToken();
          } catch (err) {
            console.warn("[ProfilScreen] gagal unregister push token:", err);
          }
          signOut();
        },
      },
    ]);
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Image source={LOGO_IMAGE} style={styles.logoSmall} resizeMode="contain" />
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.notifButton}
              onPress={() => navigation.navigate("Notification")}
            >
              <Ionicons name="notifications-outline" size={22} color="#2B2B2B" />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={1} style={styles.avatar}>
              {localPhotoUri
                ? <Image source={{ uri: localPhotoUri }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                : <Ionicons name="person" size={20} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setGantiFotoVisible(true)}>
              <LinearGradient
                colors={["#FDCB52", "#BB0009"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarGradientRing}
              >
                <View style={styles.avatarInner}>
                  {localPhotoUri ? (
                    <Image
                      source={{ uri: localPhotoUri }}
                      style={{ width: 100, height: 100, borderRadius: 50 }}
                    />
                  ) : (
                    <Ionicons name="person" size={52} color="#FFFFFF" />
                  )}
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editAvatarButton} onPress={() => setGantiFotoVisible(true)}>
              <Ionicons name="pencil" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="leaf-outline" size={16} color="#15803D" />
              <Text style={styles.statText}>{bahanCount} Bahan Diselamatkan</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="restaurant-outline" size={16} color="#BB0009" />
              <Text style={styles.statText}>{resepCount} Resep Favorit</Text>
            </View>
          </View>
        </View>

        {/* Form */}
        <Text style={styles.fieldLabel}>NAMA LENGKAP</Text>
        <View style={styles.inputRow}>
          <Ionicons name="person-outline" size={18} color="#949FA2" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={profileName}
            onChangeText={setProfileName}
            placeholderTextColor="#BFD3D6"
            onEndEditing={handleSaveName}
          />
          {saving && <ActivityIndicator size="small" color="#BB0009" />}
        </View>

        <Text style={styles.fieldLabel}>EMAIL</Text>
        <View style={styles.inputRow}>
          <Ionicons name="mail-outline" size={18} color="#949FA2" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={profileEmail}
            editable={false}
            placeholderTextColor="#BFD3D6"
            keyboardType="email-address"
          />
        </View>

        <Text style={styles.fieldLabel}>AKTIVITAS</Text>
        <TouchableOpacity
          style={styles.inputRow}
          onPress={() => navigation.navigate("FavoriteRecipes")}
          activeOpacity={0.7}
        >
          <Ionicons name="heart-outline" size={18} color="#949FA2" style={styles.inputIcon} />
          <Text style={styles.inputText}>Resep Favorit Saya</Text>
          <Ionicons name="chevron-forward" size={18} color="#949FA2" />
        </TouchableOpacity>

        <Text style={styles.fieldLabel}>KEAMANAN</Text>
        <TouchableOpacity
          style={styles.inputRow}
          onPress={() => setChangePasswordVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="lock-closed-outline" size={18} color="#949FA2" style={styles.inputIcon} />
          <Text style={styles.inputText}>Ganti Kata Sandi</Text>
          <Ionicons name="chevron-forward" size={18} color="#949FA2" />
        </TouchableOpacity>

        {/* Keluar Akun */}
        <TouchableOpacity style={styles.logoutButton} activeOpacity={0.8} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#BB0009" />
          <Text style={styles.logoutText}>Keluar Akun</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>

      <GantiFotoModal
        visible={gantiFotoVisible}
        onClose={() => setGantiFotoVisible(false)}
        onPhotoSelected={handlePhotoSelected}
      />
      <ChangePasswordModal
        visible={changePasswordVisible}
        onClose={() => setChangePasswordVisible(false)}
      />
      <EditProfileModal
        visible={editProfileVisible}
        name={profileName}
        email={profileEmail}
        onSave={(n, e) => { setProfileName(n); setProfileEmail(e); }}
        onClose={() => setEditProfileVisible(false)}
      />
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────
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
    marginBottom: 28,
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
    overflow: "hidden",
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 18,
  },
  avatarGradientRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#36393B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#BB0009",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#2B2B2B",
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: "#BFD3D6",
  },
  fieldLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#949FA2",
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 20,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#2B2B2B",
    height: 52,
  },
  inputText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#2B2B2B",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    paddingVertical: 16,
    marginTop: 32,
  },
  logoutText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#BB0009",
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
  kavWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sheetTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#2B2B2B",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#656C6E",
    lineHeight: 19,
    marginBottom: 24,
  },
  fieldLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#949FA2",
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#2B2B2B",
    height: 52,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputFull: {
    marginBottom: 0,
  },
  eyeBtn: {
    padding: 4,
  },
  saveButton: {
    backgroundColor: "#BB0009",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  saveButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: 10,
  },
  cancelButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#2B2B2B",
  },
});

export default ProfilScreen;