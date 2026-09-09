// app/(tabs)/documents/index.tsx
import Header from "@/components/Header";
import { RenderIcon } from "@/components/RenderIcon";
import { COLORS } from "@/constants/theme";
import { auth, db } from "@/firebaseConfig";
import { PhaseInfo } from "@/types/phases";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── SCREEN ───────────────────────────────────────────

type DocumentSection = PhaseInfo & {
  completedCount: number;
  order: number;
};

const DEFAULT_SECTIONS: Omit<DocumentSection, "docCount" | "completedCount">[] = [
  {
    id: "general",
    title: "Genel Belgeler",
    iconName: "folder-multiple-outline",
    iconPack: "MaterialCommunityIcons",
    order: 0,
  },
  {
    id: "official",
    title: "Resmî Belgeler",
    iconName: "file-document-outline",
    iconPack: "MaterialCommunityIcons",
    order: 1,
  },
  {
    id: "other",
    title: "Diğer Belgeler",
    iconName: "folder-outline",
    iconPack: "Ionicons",
    order: 2,
  },
];

const LEGACY_SECTION_IDS = ["1", "2", "3", "4", "5", "6"];

export default function DocumentsScreen() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [phases, setPhases] = useState<DocumentSection[]>([]);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingSection, setEditingSection] = useState<DocumentSection | null>(
    null,
  );
  const [sectionTitle, setSectionTitle] = useState("");
  const [savingSection, setSavingSection] = useState(false);

  const user = auth.currentUser;

  useEffect(() => {
    const load = async () => {
      try {
        const id = await AsyncStorage.getItem("activeProjectId");
        setProjectId(id);
        if (!id) setLoading(false);
      } catch {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (projectId && user) loadSections();
  }, [projectId]);

  const loadSections = async () => {
    try {
      setLoading(true);
      const sectionsRef = collection(
        db,
        "users",
        user!.uid,
        "projects",
        projectId!,
        "documentSections",
      );
      const snapshot = await getDocs(sectionsRef);
      const legacySections = snapshot.docs.filter((section) =>
        LEGACY_SECTION_IDS.includes(section.id),
      );

      let sections = snapshot.docs.map((section) => ({
        id: section.id,
        title: section.data().title,
        iconName: section.data().iconName ?? "folder-outline",
        iconPack: section.data().iconPack ?? "Ionicons",
        order: section.data().order ?? 0,
      })) as Omit<DocumentSection, "docCount" | "completedCount">[];

      if (sections.length === 0) {
        sections = DEFAULT_SECTIONS;
        await Promise.all(
          sections.map((section) =>
            setDoc(doc(sectionsRef, section.id), {
              title: section.title,
              iconName: section.iconName,
              iconPack: section.iconPack,
              order: section.order,
              createdAt: serverTimestamp(),
            }),
          ),
        );
      } else if (legacySections.length > 0) {
        const legacyDocuments = await Promise.all(
          legacySections.map((section) =>
            getDocs(
              collection(
                db,
                "users",
                user!.uid,
                "projects",
                projectId!,
                "phases",
                section.id,
                "documents",
              ),
            ),
          ),
        );

        // Eski aşamalar boşsa, kullanıcı için daha sade varsayılanlara geçir.
        if (legacyDocuments.every((documents) => documents.empty)) {
          const batch = writeBatch(db);
          legacySections.forEach((section) => batch.delete(section.ref));
          DEFAULT_SECTIONS.forEach((section) =>
            batch.set(
              doc(sectionsRef, section.id),
              {
                title: section.title,
                iconName: section.iconName,
                iconPack: section.iconPack,
                order: section.order,
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            ),
          );
          await batch.commit();
          sections = DEFAULT_SECTIONS;
        }
      }

      const sectionsWithCounts = await Promise.all(
        sections.map(async (section) => {
          const documentsSnapshot = await getDocs(
            collection(
              db,
              "users",
              user!.uid,
              "projects",
              projectId!,
              "phases",
              section.id,
              "documents",
            ),
          );

          return {
            ...section,
            docCount: documentsSnapshot.size,
            completedCount: 0,
          } as DocumentSection;
        }),
      );

      setPhases(sectionsWithCounts.sort((a, b) => a.order - b.order));
    } catch (e) {
      console.error("Belge kategorileri yüklenemedi:", e);
      Alert.alert("Hata", "Belge kategorileri yüklenirken bir sorun oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const openEditor = (section?: DocumentSection) => {
    setEditingSection(section ?? null);
    setSectionTitle(section?.title ?? "");
    setEditorVisible(true);
  };

  const saveSection = async () => {
    const title = sectionTitle.trim();
    if (!title || !projectId || !user) {
      Alert.alert("İsim gerekli", "Belge kategorisi için bir isim girin.");
      return;
    }

    try {
      setSavingSection(true);
      const sectionsRef = collection(
        db,
        "users",
        user.uid,
        "projects",
        projectId,
        "documentSections",
      );

      if (editingSection) {
        await setDoc(
          doc(sectionsRef, editingSection.id),
          { title, updatedAt: serverTimestamp() },
          { merge: true },
        );
        setPhases((current) =>
          current.map((section) =>
            section.id === editingSection.id ? { ...section, title } : section,
          ),
        );
      } else {
        const newSectionRef = doc(sectionsRef);
        const section: DocumentSection = {
          id: newSectionRef.id,
          title,
          iconName: "folder-outline",
          iconPack: "Ionicons",
          order: phases.length,
          docCount: 0,
          completedCount: 0,
        };
        await setDoc(newSectionRef, {
          title: section.title,
          iconName: section.iconName,
          iconPack: section.iconPack,
          order: section.order,
          createdAt: serverTimestamp(),
        });
        setPhases((current) => [...current, section]);
      }

      setEditorVisible(false);
    } catch (error) {
      console.error("Belge kategorisi kaydedilemedi:", error);
      Alert.alert("Hata", "Belge kategorisi kaydedilemedi.");
    } finally {
      setSavingSection(false);
    }
  };

  const deleteSection = (section: DocumentSection) => {
    if (phases.length <= 1) {
      Alert.alert(
        "Son kategori silinemez",
        "Belgelerinizi düzenlemek için en az bir kategori kalmalı.",
      );
      return;
    }

    Alert.alert(
      "Kategoriyi Sil",
      `“${section.title}” kategorisini silmek istiyor musunuz?`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            if (!projectId || !user) return;
            try {
              const documentsSnapshot = await getDocs(
                collection(
                  db,
                  "users",
                  user.uid,
                  "projects",
                  projectId,
                  "phases",
                  section.id,
                  "documents",
                ),
              );

              if (!documentsSnapshot.empty) {
                Alert.alert(
                  "Önce belgeleri silin",
                  "Bu kategoride belge var. Kategoriyi silmeden önce içindeki belgeleri kaldırın.",
                );
                return;
              }

              await deleteDoc(
                doc(
                  db,
                  "users",
                  user.uid,
                  "projects",
                  projectId,
                  "documentSections",
                  section.id,
                ),
              );
              setPhases((current) =>
                current.filter((currentSection) => currentSection.id !== section.id),
              );
            } catch (error) {
              console.error("Belge kategorisi silinemedi:", error);
              Alert.alert("Hata", "Belge kategorisi silinemedi.");
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header
        title="Proje belgeleri"
        rightIcon="plus"
        onRightIconPress={() => openEditor()}
      />

      {!projectId ? (
        <View style={styles.emptyFull}>
          <Ionicons name="folder-open-outline" size={64} color="#94A3B8" />
          <Text style={styles.emptyFullTitle}>Proje Seçilmedi</Text>
          <Text style={styles.emptyFullSub}>
            Belgeleri görmek için önce aktif bir proje seçin.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.listIntro}>
            Kategorileri düzenleyebilir, yeni belge alanları ekleyebilirsiniz.
          </Text>
          {phases.map((phase) => (
            <TouchableOpacity
              key={phase.id}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: "/[doc]",
                  params: {
                    doc: phase.id, // ← bunu ekle
                    id: phase.id,
                    phaseId: phase.id,
                    phaseTitle: phase.title,
                    projectId: projectId,
                  },
                })
              }
            >
              <View style={[styles.iconWrap]}>
                <RenderIcon
                  iconPack={phase.iconPack}
                  iconName={phase.iconName}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardIndex}>BELGE KATEGORİSİ</Text>
                <Text style={styles.cardTitle}>{phase.title}</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.cardAction}
                  onPress={(event) => {
                    event.stopPropagation();
                    openEditor(phase);
                  }}
                  accessibilityLabel={`${phase.title} ismini değiştir`}
                >
                  <Ionicons name="pencil-outline" size={18} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cardAction}
                  onPress={(event) => {
                    event.stopPropagation();
                    deleteSection(phase);
                  }}
                  accessibilityLabel={`${phase.title} kategorisini sil`}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <Modal
        visible={editorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !savingSection && setEditorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editorModal}>
            <Text style={styles.editorTitle}>
              {editingSection ? "Kategori İsmini Değiştir" : "Belge Kategorisi Ekle"}
            </Text>
            <TextInput
              style={styles.editorInput}
              placeholder="Örn: Ruhsat ve İzinler"
              value={sectionTitle}
              onChangeText={setSectionTitle}
              editable={!savingSection}
              autoFocus
              maxLength={50}
            />
            <View style={styles.editorActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditorVisible(false)}
                disabled={savingSection}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, savingSection && styles.saveButtonLoading]}
                onPress={saveSection}
                disabled={savingSection}
              >
                {savingSection ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  header: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 20 },
  headerSub: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#0F172A" },
  headerMeta: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 4,
    fontWeight: "500",
  },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  listIntro: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#94A3B8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
  },
  cardBody: { flex: 1 },
  cardIndex: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardAction: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
  },
  cardRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  countPill: {
    backgroundColor: COLORS.primaryLight ?? "#EFF6FF",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countText: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
  emptyFull: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyFullTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
  emptyFullSub: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
  },
  countPillComplete: {
    backgroundColor: "#DCFCE7",
  },
  countTextComplete: {
    color: "#16A34A",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  editorModal: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: "#fff",
    padding: 20,
  },
  editorTitle: { color: "#0F172A", fontSize: 18, fontWeight: "800" },
  editorInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#0F172A",
    marginTop: 16,
  },
  editorActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 18,
  },
  cancelButton: { paddingHorizontal: 16, justifyContent: "center" },
  cancelButtonText: { color: "#64748B", fontSize: 14, fontWeight: "700" },
  saveButton: {
    minWidth: 92,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  saveButtonLoading: { opacity: 0.75 },
  saveButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
