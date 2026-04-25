import React, { useState, useCallback } from "react";
import { View, StyleSheet, ActivityIndicator, Text, TextInput } from "react-native";

// Prevent Android system font-size settings from scaling all text/inputs.
// allowFontScaling alone is not enough on newer RN/Android — maxFontSizeMultiplier
// caps the system fontScale at 1x regardless of device accessibility settings.
(Text as any).defaultProps = (Text as any).defaultProps ?? {};
(Text as any).defaultProps.allowFontScaling = false;
(Text as any).defaultProps.maxFontSizeMultiplier = 1;
(TextInput as any).defaultProps = (TextInput as any).defaultProps ?? {};
(TextInput as any).defaultProps.allowFontScaling = false;
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1;
import { NavigationContainer } from "@react-navigation/native";
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import SplashScreen from "./src/screens/SplashScreen";
import AppNavigator from "./src/navigation/AppNavigator";
import { AuthProvider } from "./src/context/AuthContext";
import { useNotifications } from "./src/hooks/useNotifications";

// Komponen inner agar useNotifications bisa akses AuthContext
const AppContent: React.FC = () => {
  useNotifications();
  return <AppNavigator />;
};

const App: React.FC = () => {
  const [isSplashDone, setIsSplashDone] = useState(false);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const handleSplashFinish = useCallback(() => {
    setTimeout(() => {
      setIsSplashDone(true);
    }, 400);
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BB0009" />
      </View>
    );
  }

  if (!isSplashDone) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  return (
    <AuthProvider>
      <NavigationContainer>
        <AppContent />
      </NavigationContainer>
    </AuthProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#B08070",
  },
});

export default App;