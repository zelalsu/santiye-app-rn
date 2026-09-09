import { COLORS } from "@/constants/theme";
import { auth } from "@/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
type Mode = "login" | "register";

const PRIVACY_POLICY_URL =
  "https://zelalsu.github.io/Santiyen-Cebinde-Support/privacy.html";

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("E-posta ve şifre gereklidir.");
      return;
    }

    if (mode === "register" && !name.trim()) {
      setError("Adınızı giriniz.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );

        await updateProfile(cred.user, {
          displayName: name.trim(),
        });
      }

      router.replace("/projects");
    } catch (e: any) {
      console.log(e);

      switch (e.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
          setError("E-posta veya şifre hatalı.");
          break;

        case "auth/email-already-in-use":
          setError("Bu e-posta zaten kayıtlı.");
          break;

        case "auth/weak-password":
          setError("Şifre en az 6 karakter olmalı.");
          break;

        case "auth/invalid-email":
          setError("Geçersiz e-posta adresi.");
          break;

        default:
          setError("Bir hata oluştu.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoRow}>
            <Image
              source={require("../../assets/images/splash-brand.png")}
              style={styles.logo}
            />

            <Text style={styles.appName}>Şantiyen Cebinde</Text>
          </View>

          {/* Kart */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {mode === "login" ? "Giriş Yap" : "Hesap Oluştur"}
            </Text>
            <Text style={styles.cardSubtitle}>
              {mode === "login"
                ? "Projelerinize devam edin"
                : "Hemen ücretsiz başlayın"}
            </Text>

            {/* Ad Soyad — sadece kayıtta */}
            {mode === "register" && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Ad Soyad</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color="#94a3b8"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Adınız Soyadınız"
                    placeholderTextColor="#C0C0C0"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            {/* E-posta */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>E-posta</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color="#94a3b8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="ornek@email.com"
                  placeholderTextColor="#C0C0C0"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Şifre */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Şifre</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color="#94a3b8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor="#C0C0C0"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color="#94a3b8"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Hata */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={15}
                  color="#e24b4a"
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.submitText}>
                    {mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            {/* Mode Switch */}
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>
                {mode === "login"
                  ? "Hesabınız yok mu?"
                  : "Zaten hesabınız var mı?"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError("");
                }}
              >
                <Text style={styles.switchLink}>
                  {mode === "login" ? "Kayıt Ol" : "Giriş Yap"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            accessibilityRole="link"
            accessibilityLabel="Gizlilik politikasını aç"
            style={styles.privacyLink}
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)}
          >
            <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.primary} />
            <Text style={styles.privacyLinkText}>Gizlilik Politikası</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },

  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 36,
  },

  logo: {
    width: 42,
    height: 42,
    resizeMode: "contain",
    marginRight: 10,
    borderRadius: 10,
  },

  appName: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.primary,
    fontFamily: "Manrope",
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },

  cardTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 6,
    fontFamily: "Manrope",
  },

  cardSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 26,
    fontFamily: "Inter",
    lineHeight: 20,
  },

  fieldGroup: {
    marginBottom: 18,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
    fontFamily: "Inter",
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",

    borderWidth: 1.5,
    borderColor: COLORS.border,

    borderRadius: 16,
    paddingHorizontal: 14,

    backgroundColor: COLORS.inputBg,
  },

  inputIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
    fontFamily: "Inter",
  },

  eyeBtn: {
    padding: 4,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",

    backgroundColor: COLORS.dangerBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    gap: 8,

    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },

  errorText: {
    fontSize: 13,
    color: COLORS.danger,
    fontFamily: "Inter",
    flex: 1,
    lineHeight: 18,
  },

  submitBtn: {
    backgroundColor: COLORS.primary,

    height: 54,
    borderRadius: 18,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 8,
    marginTop: 8,

    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },

  submitText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter",
  },

  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",

    marginTop: 24,
    gap: 6,
  },

  switchText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "Inter",
  },

  switchLink: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
    fontFamily: "Inter",
  },

  privacyLink: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 12,
    marginTop: 14,
  },

  privacyLinkText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter",
    textDecorationLine: "underline",
  },
});
