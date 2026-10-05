import Header from "@/components/Header";
import ProjectCard from "@/components/ProjectCard";
import { canSeeCosts, normalizeProjectRole, projectAccessId, saveActiveProject } from "@/config/projectAccess";
import { COLORS } from "@/constants/theme";
import { auth, db } from "@/firebaseConfig";
import { Project } from "@/types/projects";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProjectsScreen() {
  const [user, setUser] = useState(auth.currentUser);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [joinVisible, setJoinVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const router = useRouter();

  const headerFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerFade, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [headerFade]);
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => setUser(u));
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "users", user.uid, "projects"),
      orderBy("createdAt", "desc"),
    );

    let ownProjects: Project[] = [];
    let sharedProjects: Project[] = [];
    const sync = () => setProjects([...ownProjects, ...sharedProjects]);

    const unsub = onSnapshot(
      q,
      (snap) => {
        ownProjects = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          ownerId: user.uid,
          role: "owner",
        })) as Project[];
        sync();
        setLoading(false);
      },
      (error) => {
        if (error.code === "permission-denied") return; // çıkış sonrası beklenen hata
        console.error(error);
      },
    );

    const unsubShared = onSnapshot(
      collection(db, "users", user.uid, "projectAccess"),
      (snap) => {
        sharedProjects = snap.docs.map((d) => ({
          id: d.data().projectId,
          name: d.data().projectName,
          ownerId: d.data().ownerId,
          role: normalizeProjectRole(d.data().role),
          shared: true,
          totalCost: 0,
          createdAt: d.data().joinedAt,
        })) as Project[];
        sync();
        setLoading(false);
      },
      (error) => {
        if (error.code !== "permission-denied")
          console.error("Paylaşılan şantiyeler yüklenemedi:", error);
        setLoading(false);
      },
    );

    return () => {
      unsub();
      unsubShared();
    };
  }, [user]); // ✅ user değişince listener yeniden kurulur
  const handleAdd = async () => {
    if (!newName.trim() || !user) return;
    setAdding(true);
    try {
      if (editingProject) {
        await updateDoc(
          doc(db, "users", user.uid, "projects", editingProject.id),
          { name: newName.trim() },
        );
      } else {
        const projectRef = await addDoc(
          collection(db, "users", user.uid, "projects"),
          {
            name: newName.trim(),
            ownerId: user.uid,
            createdAt: serverTimestamp(),
            totalCost: 0,
          },
        );
        await setDoc(doc(projectRef, "members", user.uid), {
          uid: user.uid,
          email: user.email ?? "",
          displayName: user.displayName ?? "Proje sahibi",
          role: "owner",
          joinedAt: serverTimestamp(),
        });
      }
      setNewName("");
      setEditingProject(null);
      setModalVisible(false);
    } catch {
      Alert.alert(
        "İşlem Başarısız",
        "Şantiye adı kaydedilemedi. Tekrar deneyin.",
      );
    } finally {
      setAdding(false);
    }
  };

  const handleJoin = async () => {
    if (!user || !inviteCode.trim()) return;
    setAdding(true);
    try {
      const code = inviteCode.trim().toUpperCase();
      let joinedProjectName = "Şantiye";
      await runTransaction(db, async (transaction) => {
        const inviteRef = doc(db, "projectInvites", code);
        const inviteSnap = await transaction.get(inviteRef);
        if (!inviteSnap.exists()) throw new Error("INVITE_NOT_FOUND");

        const invite = inviteSnap.data();
        if (invite.active !== true || invite.redeemedBy) {
          throw new Error("INVITE_USED");
        }
        if (invite.expiresAt?.toDate?.() < new Date()) {
          throw new Error("INVITE_EXPIRED");
        }

        joinedProjectName = invite.projectName;
        const accessId = projectAccessId(invite.ownerId, invite.projectId);
        transaction.set(
          doc(
            db,
            "users",
            invite.ownerId,
            "projects",
            invite.projectId,
            "members",
            user.uid,
          ),
          {
            uid: user.uid,
            email: user.email ?? "",
            displayName: user.displayName ?? user.email ?? "Ekip üyesi",
            role: invite.role,
            inviteCode: code,
            joinedAt: serverTimestamp(),
          },
        );
        transaction.set(doc(db, "users", user.uid, "projectAccess", accessId), {
          ownerId: invite.ownerId,
          projectId: invite.projectId,
          projectName: invite.projectName,
          role: invite.role,
          inviteCode: code,
          joinedAt: serverTimestamp(),
        });
        transaction.update(inviteRef, {
          active: false,
          redeemedBy: user.uid,
          redeemedAt: serverTimestamp(),
        });
      });
      setInviteCode("");
      setJoinVisible(false);
      Alert.alert(
        "Şantiyeye katıldınız",
        `${joinedProjectName} artık listenizde. Davet kodu kullanıldı ve kapatıldı.`,
      );
    } catch (error) {
      console.error(error);
      const reason = error instanceof Error ? error.message : "";
      if (reason === "INVITE_USED") {
        Alert.alert(
          "Kod daha önce kullanılmış",
          "Her davet kodu yalnızca bir kişi tarafından kullanılabilir.",
        );
      } else if (reason === "INVITE_EXPIRED") {
        Alert.alert(
          "Kodun süresi dolmuş",
          "Yöneticiden yeni bir davet kodu isteyin.",
        );
      } else if (reason === "INVITE_NOT_FOUND") {
        Alert.alert(
          "Kod geçersiz",
          "Davet kodunu kontrol edip tekrar deneyin.",
        );
      } else {
        Alert.alert(
          "Katılım başarısız",
          "Kod kullanılamadı. Bağlantınızı kontrol edip tekrar deneyin.",
        );
      }
    } finally {
      setAdding(false);
    }
  };

  const openCreateModal = () => {
    setEditingProject(null);
    setNewName("");
    setModalVisible(true);
  };

  const openRenameModal = (project: Project) => {
    setEditingProject(project);
    setNewName(project.name);
    setModalVisible(true);
  };

  const closeModal = () => {
    if (adding) return;
    setModalVisible(false);
    setEditingProject(null);
    setNewName("");
  };

  const handleDelete = (project: Project) => {
    Alert.alert("Şantiyeyi Sil", `"${project.name}" silinecek. Emin misiniz?`, [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "users", user!.uid, "projects", project.id));
        },
      },
    ]);
  };

  const costVisibleProjects = projects.filter((project) => canSeeCosts(project.role));
  const totalAll = costVisibleProjects.reduce(
    (sum, project) => sum + (project.totalCost ?? 0),
    0,
  );
  const hasCostAccess = costVisibleProjects.length > 0;
  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <Header
        title="Şantiyeler"
        rightIcon="account-cog-outline"
        onRightIconPress={() => router.push("/account")}
      />
      <Animated.View style={[styles.header, { opacity: headerFade }]}>
        <View style={styles.headerTop}>
          <Text style={styles.greeting}>
            Hoş geldin, {user?.displayName?.split(" ")[0] ?? "Kullanıcı"} 👋
          </Text>

          {/* <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color="#64748b" />
          </TouchableOpacity> */}
        </View>

        {/* Özet şerit */}
        <View style={styles.summaryStrip}>
          {hasCostAccess && (
            <>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>Toplam Maliyet</Text>
                <Text style={styles.summaryItemValue}>
                  ₺{totalAll.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
            </>
          )}
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>Şantiye Sayısı</Text>
            <Text style={styles.summaryItemValue}>{projects.length}</Text>
          </View>
        </View>
      </Animated.View>

      <TouchableOpacity
        style={styles.joinButton}
        onPress={() => setJoinVisible(true)}
      >
        <MaterialCommunityIcons
          name="account-plus-outline"
          size={18}
          color={COLORS.primary}
        />
        <Text style={styles.joinButtonText}>Davet koduyla şantiyeye katıl</Text>
      </TouchableOpacity>

      {/* ── Liste başlığı ── */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          TÜM ŞANTİYELER
        </Text>
        <View style={styles.listHeaderLine} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0058be" />
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <MaterialCommunityIcons
                  name="office-building-outline"
                  size={44}
                  color="#bfdbfe"
                />
              </View>
              <Text style={styles.emptyTitle}>
                Henüz şantiye eklenmedi
              </Text>
              <Text style={styles.emptySub}>
                Sağ alttaki + butonuna basarak{"\n"}ilk şantiyenizi oluşturun
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <ProjectCard
              item={item}
              index={index}
              onPress={async () => {
                const ownerId = item.ownerId ?? user!.uid;
                const role = normalizeProjectRole(item.role);
                await saveActiveProject({
                  id: item.id,
                  ownerId,
                  role,
                  name: item.name,
                });
                const pathname = role === "office" ? "/(tabs)/daily" : "/(tabs)";
                router.replace({
                  pathname,
                  params: {
                    projectId: item.id,
                    ownerId,
                    role,
                    projectName: item.name,
                  },
                } as never);
              }}
              onEditPress={
                item.shared ? undefined : () => openRenameModal(item)
              }
              onLongPress={item.shared ? undefined : () => handleDelete(item)}
              onTeamPress={
                item.shared
                  ? undefined
                  : () =>
                      router.push({
                        pathname: "/project-team",
                        params: {
                          projectId: item.id,
                          ownerId: user!.uid,
                          projectName: item.name,
                        },
                      } as never)
              }
            />
          )}
        />
      )}

      {/* ── FAB ── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={openCreateModal}
        activeOpacity={0.88}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── Modal ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={closeModal} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={styles.modalIconBox}>
                <MaterialCommunityIcons
                  name={
                    editingProject
                      ? "pencil-outline"
                      : "office-building-plus-outline"
                  }
                  size={20}
                  color="#0058be"
                />
              </View>
              <View>
                <Text style={styles.modalTitle}>
                  {editingProject ? "Şantiye İsmini Değiştir" : "Yeni Şantiye"}
                </Text>
                <Text style={styles.modalSub}>
                  {editingProject
                    ? "Yeni şantiye ismini yazın"
                    : "Şantiyenize bir isim verin"}
                </Text>
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={18}
                color="#94a3b8"
                style={{ marginRight: 10 }}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Örn: Kızılay Konut Projesi"
                placeholderTextColor="#c0cfe0"
                value={newName}
                onChangeText={setNewName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleAdd}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.modalAddBtn,
                (!newName.trim() || adding) && { opacity: 0.5 },
              ]}
              onPress={handleAdd}
              disabled={!newName.trim() || adding}
              activeOpacity={0.85}
            >
              {adding ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={
                      editingProject
                        ? "checkmark-circle-outline"
                        : "add-circle-outline"
                    }
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.modalAddText}>
                    {editingProject ? "İsmi Kaydet" : "Şantiyeyi Ekle"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={joinVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJoinVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setJoinVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Şantiyeye Katıl</Text>
            <Text style={styles.modalSub}>
              Yöneticinin paylaştığı davet kodunu girin.
            </Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons
                name="key-outline"
                size={18}
                color="#94a3b8"
              />
              <TextInput
                style={styles.modalInput}
                value={inviteCode}
                onChangeText={(text) => setInviteCode(text.toUpperCase())}
                autoCapitalize="characters"
                placeholder="Örn: A1B2C3D4"
              />
            </View>
            <TouchableOpacity
              style={[
                styles.modalAddBtn,
                (!inviteCode.trim() || adding) && { opacity: 0.5 },
              ]}
              onPress={handleJoin}
              disabled={!inviteCode.trim() || adding}
            >
              {adding ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalAddText}>Katıl</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    backgroundColor: COLORS.white,
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 0,

    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },

  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  greeting: {
    fontSize: 17,
    color: COLORS.primary,
    fontFamily: "Inter",
    marginBottom: 2,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
    fontFamily: "Manrope",
    letterSpacing: -0.6,
  },

  logoutBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  // Summary
  summaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    marginTop: 4,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },

  summaryItem: {
    flex: 1,
    alignItems: "center",
  },

  summaryItemLabel: {
    fontSize: 11,
    color: COLORS.primary,
    fontFamily: "Inter",
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },

  summaryItemValue: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.primary,
    fontFamily: "Manrope",
    letterSpacing: -0.3,
  },

  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
  },

  // Liste Başlığı
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,

    gap: 10,
  },
  joinButton: {
    marginHorizontal: 24,
    marginTop: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  joinButtonText: { color: COLORS.primary, fontWeight: "700", fontSize: 13 },

  listHeaderText: {
    fontSize: 11,
    fontWeight: "700",

    color: COLORS.textSecondary,

    fontFamily: "Inter",
    letterSpacing: 1,
  },

  listHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },

  // Loading
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // List
  list: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 120,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",

    paddingTop: 72,

    gap: 14,
  },

  emptyIconWrap: {
    width: 88,
    height: 88,

    borderRadius: 28,

    backgroundColor: COLORS.primaryLight,

    alignItems: "center",
    justifyContent: "center",

    marginBottom: 4,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",

    color: COLORS.textSecondary,

    fontFamily: "Manrope",
  },

  emptySub: {
    fontSize: 13,
    color: COLORS.placeholder,

    textAlign: "center",

    lineHeight: 20,

    fontFamily: "Inter",
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,

    width: 60,
    height: 60,

    borderRadius: 20,

    backgroundColor: COLORS.primary,

    alignItems: "center",
    justifyContent: "center",

    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,

    elevation: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },

  modalSheet: {
    backgroundColor: COLORS.white,

    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,

    paddingHorizontal: 24,
    paddingBottom: 44,

    borderTopWidth: 1,
    borderColor: COLORS.borderLight,
  },

  modalHandle: {
    width: 40,
    height: 5,

    backgroundColor: COLORS.border,

    borderRadius: 999,

    alignSelf: "center",

    marginTop: 12,
    marginBottom: 24,
  },

  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",

    gap: 14,
    marginBottom: 22,
  },

  modalIconBox: {
    width: 48,
    height: 48,

    borderRadius: 16,

    backgroundColor: COLORS.primaryLight,

    alignItems: "center",
    justifyContent: "center",
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "800",

    color: COLORS.text,

    fontFamily: "Manrope",

    letterSpacing: -0.3,
  },

  modalSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontFamily: "Inter",
    marginTop: 2,
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",

    borderWidth: 1.5,
    borderColor: COLORS.border,

    borderRadius: 16,

    paddingHorizontal: 14,

    backgroundColor: COLORS.background,

    marginBottom: 14,
  },

  modalInput: {
    flex: 1,

    paddingVertical: 14,

    fontSize: 15,

    color: COLORS.text,

    fontFamily: "Inter",
  },

  modalAddBtn: {
    backgroundColor: COLORS.primary,

    height: 54,

    borderRadius: 18,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 8,

    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },

  modalAddText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Manrope",
    letterSpacing: -0.1,
  },
});
