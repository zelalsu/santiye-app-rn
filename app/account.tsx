import Header from "@/components/Header";
import { COLORS } from "@/constants/theme";
import { auth, db, storage } from "@/firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
} from "firebase/auth";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PROJECT_COLLECTIONS = ["categories", "contractors", "dailyLogs", "pdfHistory"];
const PRIVACY_POLICY_URL =
  "https://zelalsu.github.io/Santiyen-Cebinde-Support/privacy.html";

async function deleteCollection(path: string[]) {
  const snapshot = await getDocs(collection(db, path.join("/")));
  await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
}

async function deleteUserData(uid: string) {
  const projects = await getDocs(collection(db, "users", uid, "projects"));

  for (const project of projects.docs) {
    const phases = await getDocs(
      collection(db, "users", uid, "projects", project.id, "phases"),
    );

    for (const phase of phases.docs) {
      const documents = await getDocs(
        collection(
          db,
          "users",
          uid,
          "projects",
          project.id,
          "phases",
          phase.id,
          "documents",
        ),
      );
      for (const document of documents.docs) {
        const url = document.data().url;
        if (typeof url === "string") {
          await deleteObject(ref(storage, url)).catch(() => undefined);
        }
        await deleteDoc(document.ref);
      }
      await deleteDoc(phase.ref);
    }

    for (const child of PROJECT_COLLECTIONS) {
      await deleteCollection(["users", uid, "projects", project.id, child]);
    }
    await deleteDoc(project.ref);
  }

  await deleteDoc(doc(db, "users", uid)).catch(() => undefined);
}

export default function AccountScreen() {
  const user = auth.currentUser;
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  const logout = async () => {
    await signOut(auth);
    await AsyncStorage.removeItem("activeProjectId");
    router.replace("/(auth)");
  };

  const confirmDelete = () => {
    Alert.alert(
      "Hesabı Kalıcı Olarak Sil",
      "Tüm şantiyeleriniz, maliyet kayıtlarınız, günlükleriniz ve belgeleriniz kalıcı olarak silinecek. Bu işlem geri alınamaz.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Hesabımı Sil",
          style: "destructive",
          onPress: async () => {
            if (!user) return;
            if (!user.email || !deletePassword) {
              Alert.alert("Şifre Gerekli", "Hesabınızı silmek için mevcut şifrenizi girin.");
              return;
            }
            setDeleting(true);
            try {
              const credential = EmailAuthProvider.credential(user.email, deletePassword);
              await reauthenticateWithCredential(user, credential);
              await deleteUserData(user.uid);
              await deleteUser(user);
              await AsyncStorage.removeItem("activeProjectId");
              router.replace("/(auth)");
            } catch (error: any) {
              if (error?.code === "auth/invalid-credential" || error?.code === "auth/wrong-password") {
                Alert.alert("Şifre Hatalı", "Girdiğiniz şifreyi kontrol edip tekrar deneyin.");
              } else {
                Alert.alert("Hesap Silinemedi", "Bağlantınızı kontrol edip tekrar deneyin.");
              }
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header title="Hesap" backIcon />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={30} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.displayName || "Kullanıcı"}</Text>
            <Text selectable style={styles.email}>{user?.email}</Text>
          </View>
        </View>

        <Pressable style={styles.action} onPress={logout}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Çıkış Yap</Text>
            <Text style={styles.actionDescription}>Bu cihazdaki oturumunuzu kapatın.</Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Gizlilik politikasını aç"
          style={styles.action}
          onPress={() => WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)}
        >
          <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Gizlilik Politikası</Text>
            <Text style={styles.actionDescription}>
              Verilerinizin nasıl kullanıldığını ve korunduğunu inceleyin.
            </Text>
          </View>
          <Ionicons name="open-outline" size={19} color={COLORS.textMuted} />
        </Pressable>

        <View style={styles.dangerZone}>
          <Text style={styles.dangerHeading}>Hesap ve Veriler</Text>
          <Text style={styles.dangerDescription}>
            Hesabınızı sildiğinizde uygulamadaki tüm proje verileriniz de kalıcı olarak silinir.
          </Text>
          <TextInput
            style={styles.passwordInput}
            value={deletePassword}
            onChangeText={setDeletePassword}
            placeholder="Mevcut şifreniz"
            placeholderTextColor={COLORS.placeholder}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
          />
          <Pressable
            style={[styles.deleteButton, deleting && { opacity: 0.6 }]}
            onPress={confirmDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#b91c1c" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color="#b91c1c" />
                <Text style={styles.deleteText}>Hesabımı Sil</Text>
              </>
            )}
          </Pressable>
        </View>
        <Text selectable style={styles.copyright}>
          © 2026 Zelalsu Kartal
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, gap: 16 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight,
  },
  name: { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  email: { color: COLORS.textSecondary, fontSize: 14, marginTop: 4 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  actionDescription: { color: COLORS.textSecondary, fontSize: 13, marginTop: 3 },
  dangerZone: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#fff7f7",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  dangerHeading: { color: "#991b1b", fontSize: 16, fontWeight: "800" },
  dangerDescription: { color: "#7f1d1d", fontSize: 14, lineHeight: 21 },
  passwordInput: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fca5a5",
    color: COLORS.text,
    backgroundColor: "#fff",
  },
  deleteButton: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fff",
  },
  deleteText: { color: "#b91c1c", fontSize: 15, fontWeight: "800" },
  copyright: {
    paddingVertical: 12,
    textAlign: "center",
    color: COLORS.textMuted,
    fontSize: 12,
  },
});
