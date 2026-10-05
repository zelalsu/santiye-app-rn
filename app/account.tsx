import Header from "@/components/Header";
import { clearActiveProject } from "@/config/projectAccess";
import { COLORS } from "@/constants/theme";
import { auth, db, storage } from "@/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
} from "firebase/auth";
import { collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
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

const PROJECT_COLLECTIONS = [
  "categories",
  "contractors",
  "dailyLogs",
  "siteLogs",
  "dailyLogCosts",
  "measurements",
  "pdfHistory",
  "documentSections",
];
const PRIVACY_POLICY_URL =
  "https://zelalsu.github.io/Santiyen-Cebinde-Support/privacy.html";

async function deleteCollection(path: string[]) {
  const snapshot = await getDocs(collection(db, path.join("/")));
  await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
}

async function deleteUserData(uid: string) {
  const accessRecords = await getDocs(
    collection(db, "users", uid, "projectAccess"),
  );
  for (const access of accessRecords.docs) {
    const data = access.data();
    if (data.ownerId && data.projectId) {
      await deleteDoc(
        doc(
          db,
          "users",
          data.ownerId,
          "projects",
          data.projectId,
          "members",
          uid,
        ),
      ).catch(() => undefined);
    }
    await deleteDoc(access.ref);
  }

  const projects = await getDocs(collection(db, "users", uid, "projects"));

  for (const project of projects.docs) {
    const members = await getDocs(collection(project.ref, "members"));
    for (const member of members.docs) {
      if (member.id !== uid) {
        await deleteDoc(
          doc(
            db,
            "users",
            member.id,
            "projectAccess",
            `${uid}_${project.id}`,
          ),
        ).catch(() => undefined);
      }
      await deleteDoc(member.ref);
    }

    const [phases, documentSections] = await Promise.all([
      getDocs(collection(project.ref, "phases")),
      getDocs(collection(project.ref, "documentSections")),
    ]);
    const documentSectionIds = new Set([
      ...phases.docs.map((phase) => phase.id),
      ...documentSections.docs.map((section) => section.id),
    ]);

    for (const sectionId of documentSectionIds) {
      const documents = await getDocs(
        collection(
          db,
          "users",
          uid,
          "projects",
          project.id,
          "phases",
          sectionId,
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
      const phase = phases.docs.find((item) => item.id === sectionId);
      if (phase) await deleteDoc(phase.ref);
    }

    for (const child of PROJECT_COLLECTIONS) {
      await deleteCollection(["users", uid, "projects", project.id, child]);
    }
    await deleteDoc(project.ref);
  }

  const invites = await getDocs(
    query(collection(db, "projectInvites"), where("createdBy", "==", uid)),
  );
  await Promise.all(invites.docs.map((invite) => deleteDoc(invite.ref)));

  await deleteDoc(doc(db, "users", uid)).catch(() => undefined);
}

export default function AccountScreen() {
  const user = auth.currentUser;
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteExpanded, setDeleteExpanded] = useState(false);

  const logout = async () => {
    await clearActiveProject();
    await signOut(auth);
    if (router.canDismiss()) router.dismissAll();
    router.replace("/(auth)");
  };

  const confirmLogout = () => {
    Alert.alert("Çıkış yapılsın mı?", "Bu cihazdaki oturumunuz kapatılacak.", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Çıkış Yap", style: "destructive", onPress: logout },
    ]);
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
              await clearActiveProject();
              if (router.canDismiss()) router.dismissAll();
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

        <Text style={styles.sectionLabel}>GENEL</Text>
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

        <Text style={styles.sectionLabel}>HESAP VE GÜVENLİK</Text>
        <View style={styles.securityGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: deleteExpanded }}
            style={styles.deleteRow}
            onPress={() => setDeleteExpanded((current) => !current)}
          >
            <View style={styles.dangerIcon}>
              <Ionicons name="trash-outline" size={19} color="#b91c1c" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.deleteRowTitle}>Hesabı sil</Text>
              <Text style={styles.deleteRowDescription}>Hesap ve proje verilerini kalıcı olarak kaldırın</Text>
            </View>
            <Ionicons name={deleteExpanded ? "chevron-up" : "chevron-down"} size={19} color={COLORS.textMuted} />
          </Pressable>
          {deleteExpanded && (
            <View style={styles.deleteDetails}>
              <Text style={styles.dangerDescription}>
                Tüm şantiyeleriniz, günlükleriniz ve belgeleriniz kalıcı olarak silinir. Bu işlem geri alınamaz.
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
                accessibilityRole="button"
                accessibilityLabel="Hesabımı kalıcı olarak sil"
                style={[styles.deleteButton, deleting && { opacity: 0.6 }]}
                onPress={confirmDelete}
                disabled={deleting}
              >
                {deleting ? <ActivityIndicator color="#b91c1c" /> : <Text style={styles.deleteText}>Hesabımı kalıcı olarak sil</Text>}
              </Pressable>
            </View>
          )}
        </View>

        <Pressable accessibilityRole="button" style={styles.logoutButton} onPress={confirmLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.textSecondary} />
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </Pressable>
        <Text selectable style={styles.copyright}>
          © 2026 Zelalsu Kartal
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, padding: 20, gap: 12 },
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
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 6,
    marginLeft: 4,
  },
  securityGroup: {
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  deleteRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15 },
  dangerIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff1f1",
  },
  deleteRowTitle: { color: "#991b1b", fontSize: 14, fontWeight: "800" },
  deleteRowDescription: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  deleteDetails: {
    gap: 10,
    padding: 15,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: "#fffafa",
  },
  dangerDescription: { color: "#7f1d1d", fontSize: 12, lineHeight: 18 },
  passwordInput: {
    minHeight: 44,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fff",
  },
  deleteText: { color: "#b91c1c", fontSize: 13, fontWeight: "800" },
  logoutButton: {
    minHeight: 48,
    marginTop: "auto",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: "800" },
  copyright: {
    paddingVertical: 12,
    textAlign: "center",
    color: COLORS.textMuted,
    fontSize: 12,
  },
});
