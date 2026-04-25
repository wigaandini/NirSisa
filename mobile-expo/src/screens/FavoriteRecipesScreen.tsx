import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, RefreshControl
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import { useAuth } from "../context/AuthContext";
import { capitalizeEachWord } from "../utils/formatters";
import { useFocusEffect } from "@react-navigation/native";
import Header from "../components/Header";

const FavoriteRecipesScreen = ({ navigation }: any) => {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFavorites = async () => {
    if (!session?.user?.id) return;
    try {
        setLoading(true);
        console.log("Fetching favorites for user:", session.user.id);

        // Ganti bagian select-nya
        const { data, error } = await supabase
        .from("user_favorites")
        .select(`
            id,
            recipes!recipe_id ( * ) 
        `)
        .eq("user_id", session.user.id);

        if (error) throw error;
        
        console.log("Data ditemukan:", data?.length); // Cek di terminal apakah data ada
        setFavorites(data || []);
    } catch (error: any) {
        console.error("Error Detail:", error.message);
    } finally {
        setLoading(false);
        setRefreshing(false);
    }
    };

  useFocusEffect(
    useCallback(() => {
      fetchFavorites();
    }, [session?.user?.id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchFavorites();
  };

  return (
    <View style={styles.flex}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Header variant="back" onBack={() => navigation.goBack()} />

        <Text style={styles.title}>Resep Favorit</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#BB0009" style={{ marginTop: 50 }} />
        ) : favorites.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="heart-dislike-outline" size={64} color="#BFD3D6" />
            <Text style={styles.emptyText}>Belum ada resep yang disimpan.</Text>
          </View>
        ) : (
          favorites.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.recipeCard}
              onPress={() => navigation.navigate("Main", { 
                screen: "ChefAI", 
                params: { screen: "RecipeDetail", params: { recipe: item.recipes } } 
              })}
            >
              <View style={styles.recipeInfo}>
            <Text style={styles.recipeTitle}>
            {item.recipes?.title ? capitalizeEachWord(item.recipes.title) : "Resep Tidak Tersedia"}
            </Text>                
            <View style={styles.matchBadge}>
                  <Ionicons name="sparkles" size={12} color="#BB0009" />
                  <Text style={styles.matchText}>Match Sempurna</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#BFD3D6" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#FAFAFA" },
  scrollContent: { paddingHorizontal: 24, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 40 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, color: "#2B2B2B", marginBottom: 24 },
  recipeCard: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', 
    borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F0F0F0' 
  },
  recipeInfo: { flex: 1 },
  recipeTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#2B2B2B', marginBottom: 6 },
  matchBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#BB0009' },
  emptyState: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#949FA2' }
});

export default FavoriteRecipesScreen;