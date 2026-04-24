import React, { createContext, useContext, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  // ▼▼▼ FIX BUG 1: foto profil persisten ▼▼▼
  photoUri: string | null;
  setPhotoUri: (uri: string | null) => void;
  uploadAndPersistPhoto: (localUri: string) => Promise<string | null>;
  // ▲▲▲
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  signOut: async () => {},
  photoUri: null,
  setPhotoUri: () => {},
  uploadAndPersistPhoto: async () => null,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadAvatarFromDB(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadAvatarFromDB(session.user.id);
      } else {
        // Logout → reset foto
        setPhotoUri(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ▼▼▼ FIX BUG 1: load avatar_url dari tabel profiles saat login ▼▼▼
  const loadAvatarFromDB = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .single();

      if (data?.avatar_url) {
        setPhotoUri(data.avatar_url);
      }
    } catch (err) {
      console.warn("[AuthContext] gagal load avatar:", err);
    }
  };

  /**
   * Upload foto lokal ke Supabase Storage bucket 'avatars',
   * lalu simpan public URL ke profiles.avatar_url.
   * Return public URL jika berhasil, null jika gagal.
   */
  const uploadAndPersistPhoto = async (localUri: string): Promise<string | null> => {
    if (!session?.user?.id) return null;

    try {
      const userId = session.user.id;
      const fileExt = localUri.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${userId}/avatar.${fileExt}`;
      const contentType = fileExt === "jpg" ? "image/jpeg" : `image/${fileExt}`;

      // ▼▼▼ FIX: React Native tidak support blob() dengan benar untuk file lokal.
      // Pakai arrayBuffer() yang reliable di semua platform.
      const response = await fetch(localUri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, arrayBuffer, {
          cacheControl: "3600",
          upsert: true,
          contentType,
        });
      // ▲▲▲

      if (uploadError) {
        console.error("[AuthContext] upload error:", uploadError.message);
        return null;
      }

      // Dapatkan public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) return null;

      // Tambah cache-buster agar image component force re-fetch
      const finalUrl = `${publicUrl}?t=${Date.now()}`;

      // Simpan ke tabel profiles
      await supabase
        .from("profiles")
        .update({
          avatar_url: finalUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      setPhotoUri(finalUrl);
      return finalUrl;
    } catch (err) {
      console.error("[AuthContext] uploadAndPersistPhoto error:", err);
      return null;
    }
  };
  // ▲▲▲

  const signOut = async () => {
    setPhotoUri(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        signOut,
        photoUri,
        setPhotoUri,
        uploadAndPersistPhoto,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);