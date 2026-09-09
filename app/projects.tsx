import Header from "@/components/Header";
import ProjectCard from "@/components/ProjectCard";
import SearchBar from "@/components/SearchBar";
import { COLORS } from "@/constants/theme";
import { auth, db } from "@/firebaseConfig";
import { Project } from "@/types/projects";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
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
  }, []);
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

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Project[];
        setProjects(data);
        setLoading(false);
      },
      (error) => {
        if (error.code === "permission-denied") return; // çıkış sonrası beklenen hata
        console.error(error);
      },
    );

    return unsub;
  }, [user?.uid]); // ✅ user değişince listener yeniden kurulur
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
        await addDoc(collection(db, "users", user.uid, "projects"), {
          name: newName.trim(),
          createdAt: serverTimestamp(),
          totalCost: 0,
        });
      }
      setNewName("");
      setEditingProject(null);
      setModalVisible(false);
    } catch {
      Alert.alert("İşlem Başarısız", "Şantiye adı kaydedilemedi. Tekrar deneyin.");
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

  const totalAll = projects.reduce((s, p) => s + (p.totalCost ?? 0), 0);
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c");

  const filteredProjects = useMemo(() => {
    const term = normalize(search.trim());
    if (!term) return projects;

    return projects.filter((project) => normalize(project.name).includes(term));
  }, [projects, search]);

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
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>Toplam Maliyet</Text>
            <Text style={styles.summaryItemValue}>
              ₺{totalAll.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>Şantiye Sayısı</Text>
            <Text style={styles.summaryItemValue}>{projects.length}</Text>
          </View>
        </View>
      </Animated.View>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Şantiye ara..."
      />

      {/* ── Liste başlığı ── */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          {search.trim() ? "ARAMA SONUÇLARI" : "TÜM ŞANTİYELER"}
        </Text>
        <View style={styles.listHeaderLine} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0058be" />
        </View>
      ) : (
        <FlatList
          data={filteredProjects}
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
                {search.trim()
                  ? "Eşleşen şantiye bulunamadı"
                  : "Henüz şantiye eklenmedi"}
              </Text>
              <Text style={styles.emptySub}>
                {search.trim()
                  ? "Farklı bir arama deneyin veya yeni bir şantiye ekleyin"
                  : "Sağ alttaki + butonuna basarak\nilk şantiyenizi oluşturun"}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <ProjectCard
              item={item}
              index={index}
              onPress={async () => {
                await AsyncStorage.setItem("activeProjectId", item.id);

                router.push(`/(tabs)?projectId=${item.id}`);
              }}
              onEditPress={() => openRenameModal(item)}
              onLongPress={() => handleDelete(item)}
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
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={closeModal}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={styles.modalIconBox}>
                <MaterialCommunityIcons
                  name={editingProject ? "pencil-outline" : "office-building-plus-outline"}
                  size={20}
                  color="#0058be"
                />
              </View>
              <View>
                <Text style={styles.modalTitle}>
                  {editingProject ? "Şantiye İsmini Değiştir" : "Yeni Şantiye"}
                </Text>
                <Text style={styles.modalSub}>
                  {editingProject ? "Yeni şantiye ismini yazın" : "Şantiyenize bir isim verin"}
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
                    name={editingProject ? "checkmark-circle-outline" : "add-circle-outline"}
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
