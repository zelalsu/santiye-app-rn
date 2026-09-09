import Header from "@/components/Header";
import { uploadDocument } from "@/config/documentUpload";
import { COLORS } from "@/constants/theme";
import { auth, db, storage } from "@/firebaseConfig";
import { RequiredDocument } from "@/types/phases";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { cacheDirectory, downloadAsync } from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { deleteObject, getMetadata, ref } from "firebase/storage";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

// ─── TYPES ────────────────────────────────────────────

interface Document {
  id: string;
  name: string;
  type: "image" | "pdf";
  url: string;
  createdAt: Date;
  size?: number;
  requiredDocumentId?: string;
}

// ─── SCREEN ───────────────────────────────────────────

export default function DocumentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const phaseId = Array.isArray(params.phaseId)
    ? params.phaseId[0]
    : params.phaseId;
  const phaseTitle = Array.isArray(params.phaseTitle)
    ? params.phaseTitle[0]
    : params.phaseTitle;
  const projectId = Array.isArray(params.projectId)
    ? params.projectId[0]
    : params.projectId;

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingForId, setUploadingForId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const [pendingFile, setPendingFile] = useState<{
    uri: string;
    type: "image" | "pdf";
    requiredDocumentId?: string;
  } | null>(null);

  const user = auth.currentUser;

  useEffect(() => {
    if (!phaseId || !projectId) {
      Alert.alert("Hata", "Geçersiz parametreler");
      router.back();
      return;
    }
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    if (!user || !projectId || !phaseId) return;
    try {
      const docsRef = collection(
        db,
        "users",
        user.uid,
        "projects",
        projectId,
        "phases",
        phaseId,
        "documents",
      );
      const q = query(docsRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const docs: Document[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        docs.push({
          id: d.id,
          name: data.name,
          type: data.type,
          url: data.url,
          createdAt: data.createdAt?.toDate() || new Date(),
          size: data.size,
          requiredDocumentId: data.requiredDocumentId,
        });
      });
      setDocuments(docs);
    } catch (error) {
      console.error("Belgeler yüklenirken hata:", error);
      Alert.alert("Hata", "Belgeler yüklenirken bir sorun oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadForRequired = useCallback(
    async (reqDoc: RequiredDocument) => {
      Alert.alert(
        reqDoc.name,
        "Nasıl eklemek istersiniz?",
        [
          { text: "İptal", style: "cancel" },
          { text: "Fotoğraf Çek", onPress: () => pickCamera(reqDoc.id) },
          { text: "Galeriden Seç", onPress: () => pickImage(reqDoc.id) },
          { text: "PDF Dosyası", onPress: () => pickPDF(reqDoc.id) },
        ],
        { cancelable: true },
      );
    },
    [],
  );

  // Serbest belge ekleme (FAB)
  const handleAddDocument = useCallback(async () => {
    Alert.alert(
      "Belge Ekle",
      "Ne tür bir belge eklemek istiyorsunuz?",
      [
        { text: "İptal", style: "cancel" },
        { text: "Fotoğraf Çek", onPress: () => pickCamera() },
        { text: "Galeriden Seç", onPress: () => pickImage() },
        { text: "PDF Dosyası", onPress: () => pickPDF() },
      ],
      { cancelable: true },
    );
  }, []);

  const pickImage = async (requiredDocumentId?: string) => {
    const { status, canAskAgain } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Fotoğraf İzni Gerekli",
        "Galerinizden bir belge seçebilmek için fotoğraf erişimine izin vermeniz gerekir.",
        canAskAgain
          ? [{ text: "Tamam" }]
          : [
              { text: "Vazgeç", style: "cancel" },
              { text: "Ayarları Aç", onPress: () => Linking.openSettings() },
            ],
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingFile({
        uri: result.assets[0].uri,
        type: "image",
        requiredDocumentId,
      });

      setDocumentName("");
      setShowNameModal(true);
    }
  };

  const pickCamera = async (requiredDocumentId?: string) => {
    const { status, canAskAgain } =
      await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Kamera İzni Gerekli",
        "Belgenizin fotoğrafını çekebilmek için kamera erişimine izin vermeniz gerekir.",
        canAskAgain
          ? [{ text: "Tamam" }]
          : [
              { text: "Vazgeç", style: "cancel" },
              { text: "Ayarları Aç", onPress: () => Linking.openSettings() },
            ],
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingFile({
        uri: result.assets[0].uri,
        type: "image",
        requiredDocumentId,
      });
      setDocumentName("");
      setShowNameModal(true);
    }
  };

  const pickPDF = async (requiredDocumentId?: string) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingFile({
        uri: result.assets[0].uri,
        type: "pdf",
        requiredDocumentId,
      });

      setDocumentName("");
      setShowNameModal(true);
    }
  };

  const uploadSelectedFile = async (
    uri: string,
    type: "image" | "pdf",
    requiredDocumentId?: string,
    name?: string,
  ) => {
    if (!user || !projectId || !phaseId) return false;

    if (requiredDocumentId) setUploadingForId(requiredDocumentId);
    else setUploading(true);

    try {
      const fileName =
        name?.trim() ||
        `${Date.now()}_${type === "image" ? "image" : "document"}`;
      const fileType = type === "image" ? "image/jpeg" : "application/pdf";

      const result = await uploadDocument(
        uri,
        fileName,
        fileType,
        user.uid,
        projectId,
        phaseId,
        requiredDocumentId, // ← yeni parametre
      );

      if (result.success && result.document) {
        await loadDocuments();
        Alert.alert("Başarılı", "Belge başarıyla eklendi.");
        return true;
      } else {
        throw new Error(result.error || "Yükleme başarısız");
      }
    } catch (error) {
      console.error("Yükleme hatası:", error);
      Alert.alert(
        "Belge Yüklenemedi",
        error instanceof Error
          ? error.message
          : "Bağlantınızı kontrol edip tekrar deneyin.",
      );
      return false;
    } finally {
      setUploadingForId(null);
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (document: Document) => {
    Alert.alert(
      "Belgeyi Sil",
      `"${document.name}" belgesini silmek istediğinizden emin misiniz?`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            if (!user || !projectId || !phaseId) return;
            try {
              const storageRef = ref(storage, document.url);
              try {
                await getMetadata(storageRef);
                await deleteObject(storageRef);
              } catch (storageError) {
                console.log("Storage dosyası bulunamadı", storageError);
              }
              const docRef = doc(
                db,
                "users",
                user.uid,
                "projects",
                projectId,
                "phases",
                phaseId,
                "documents",
                document.id,
              );
              await deleteDoc(docRef);
              setDocuments((prev) => prev.filter((d) => d.id !== document.id));
              Alert.alert("Başarılı", "Belge silindi.");
            } catch (error) {
              console.error("Silme hatası:", error);
              Alert.alert("Hata", "Belge silinirken bir sorun oluştu.");
            }
          },
        },
      ],
    );
  };

  const handleOpenDocument = (document: Document) => {
    setSelectedDoc(document);
    setModalVisible(true);
  };

  const handleShareDocument = async () => {
    if (!selectedDoc || sharing) return;

    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Paylaşım desteklenmiyor",
          "Bu cihazda paylaşım özelliği kullanılamıyor.",
        );
        return;
      }

      setSharing(true);
      let uri = selectedDoc.url;

      if (!uri.startsWith("file://")) {
        if (!cacheDirectory) throw new Error("Geçici depolama alanı bulunamadı.");

        const safeName = selectedDoc.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const expectedExtension = selectedDoc.type === "pdf" ? ".pdf" : ".jpg";
        const fileName = safeName.toLowerCase().endsWith(expectedExtension)
          ? safeName
          : `${safeName}${expectedExtension}`;
        const destination = `${cacheDirectory}shared-${Date.now()}-${fileName}`;
        const download = await downloadAsync(uri, destination);
        if (download.status !== 200) {
          throw new Error(`Belge indirilemedi (HTTP ${download.status})`);
        }
        uri = download.uri;
      }

      await Sharing.shareAsync(uri, {
        mimeType:
          selectedDoc.type === "pdf" ? "application/pdf" : "image/jpeg",
        UTI: selectedDoc.type === "pdf" ? "com.adobe.pdf" : "public.jpeg",
        dialogTitle: "Belgeyi paylaş veya kaydet",
      });
    } catch (error) {
      console.error("Belge paylaşım hatası:", error);
      Alert.alert("Hata", "Belge paylaşılırken bir sorun oluştu.");
    } finally {
      setSharing(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderDocument = ({ item }: { item: Document }) => (
    <TouchableOpacity
      style={styles.documentCard}
      onPress={() => handleOpenDocument(item)}
      activeOpacity={0.7}
    >
      <View style={styles.documentIcon}>
        {item.type === "image" ? (
          <Image
            source={{ uri: item.url }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <MaterialCommunityIcons
            name="file-pdf-box"
            size={28}
            color="#EF4444"
          />
        )}
      </View>
      <View style={styles.documentInfo}>
        <Text style={styles.documentName} numberOfLines={2}>
          {item.name.replace(/^\d+_/, "")}
        </Text>
        <View style={styles.documentMeta}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {item.type === "image" ? "GÖRSEL" : "PDF"}
            </Text>
          </View>
          {item.size && (
            <>
              <Text style={styles.documentMetaDot}>•</Text>
              <Text style={styles.documentMetaText}>
                {formatFileSize(item.size)}
              </Text>
            </>
          )}
          <Text style={styles.documentMetaDot}>•</Text>
          <Text style={styles.documentMetaText}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteDocument(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={20} color="#EF4444" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  // Serbest (requiredDocumentId olmayan) belgeler
  const freeDocs = documents.filter((d) => !d.requiredDocumentId);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header
        backIcon
        title="Belgeler"
        subtitle={`${documents.length} belge`}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── DİĞER BELGELER ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diğer Belgeler</Text>
          {freeDocs.length === 0 ? (
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons
                name="folder-open"
                size={48}
                color="#CBD5E1"
              />
              <Text style={styles.emptySub}>Henüz ek belge yok</Text>
            </View>
          ) : (
            freeDocs.map((item) => (
              <View key={item.id}>{renderDocument({ item })}</View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {uploading && (
        <View style={styles.uploadingOverlay}>
          <View style={styles.uploadingCard}>
            <ActivityIndicator color={COLORS.primary} size="large" />
            <Text style={styles.uploadingText}>Belge yükleniyor...</Text>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.fab} onPress={handleAddDocument}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.previewContainer} edges={["top", "bottom"]}>
          <View style={styles.previewHeader}>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.previewCloseButton}
              accessibilityLabel="Önizlemeyi kapat"
            >
              <Ionicons name="close" size={24} color="#334155" />
            </TouchableOpacity>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {selectedDoc?.name.replace(/^\d+_/, "") ?? "Belge Önizleme"}
            </Text>
            <TouchableOpacity
              onPress={handleShareDocument}
              style={styles.previewShareButton}
              disabled={sharing || !selectedDoc}
              accessibilityLabel="Belgeyi paylaş"
            >
              {sharing ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons name="share-outline" size={22} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          </View>

          {selectedDoc?.type === "image" ? (
            <View style={styles.imagePreviewWrap}>
              <Image
                source={{ uri: selectedDoc.url }}
                style={styles.imagePreview}
                resizeMode="contain"
              />
            </View>
          ) : selectedDoc?.url ? (
            <WebView
              source={{ uri: selectedDoc.url }}
              originWhitelist={["*"]}
              style={styles.pdfPreview}
            />
          ) : (
            <View style={styles.previewEmpty}>
              <MaterialCommunityIcons
                name="file-alert-outline"
                size={48}
                color="#94A3B8"
              />
              <Text style={styles.previewEmptyText}>Belge önizlenemedi.</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      <Modal visible={showNameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.nameModal}>
            <Text style={styles.modalTitle}>Belge Adı</Text>

            <TextInput
              style={styles.nameInput}
              placeholder="Örn: Statik Proje"
              value={documentName}
              onChangeText={setDocumentName}
              editable={!isSavingDocument}
            />

            <TouchableOpacity
              style={[
                styles.saveButton,
                isSavingDocument && styles.saveButtonLoading,
              ]}
              disabled={isSavingDocument}
              onPress={async () => {
                if (!pendingFile || isSavingDocument) return;

                setIsSavingDocument(true);
                try {
                  const saved = await uploadSelectedFile(
                    pendingFile.uri,
                    pendingFile.type,
                    pendingFile.requiredDocumentId,
                    documentName.trim(),
                  );

                  if (!saved) return;
                  setPendingFile(null);
                  setDocumentName("");
                  setShowNameModal(false);
                } finally {
                  setIsSavingDocument(false);
                }
              }}
            >
              {isSavingDocument ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.saveButtonText}>Kaydediliyor...</Text>
                </>
              ) : (
                <Text style={styles.saveButtonText}>Kaydet</Text>
              )}
            </TouchableOpacity>
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
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 12,
    fontWeight: "500",
  },

  // Gerekli belgeler
  requiredRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#94A3B8",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  requiredStatus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  requiredStatusDone: { backgroundColor: "#DCFCE7" },
  requiredInfo: { flex: 1 },
  requiredName: { fontSize: 14, fontWeight: "600", color: "#475569" },
  requiredNameDone: { color: "#1E293B" },
  requiredUploaded: {
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 2,
    fontWeight: "500",
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  uploadBtnText: { fontSize: 12, fontWeight: "600", color: COLORS.primary },

  // Diğer belgeler
  list: { paddingBottom: 80 },
  documentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },

  nameModal: {
    width: "88%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
  },

  nameInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
    color: COLORS.text,
  },

  saveButton: {
    marginTop: 18,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  saveButtonLoading: { opacity: 0.8 },

  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  documentIcon: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  documentInfo: { flex: 1 },
  documentName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 6,
  },
  documentMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  thumbnail: { width: "100%", height: "100%", borderRadius: 10 },
  typeBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  documentMetaText: { fontSize: 11, color: "#94A3B8" },
  documentMetaDot: { fontSize: 11, color: "#CBD5E1" },
  deleteButton: { padding: 8, marginLeft: 8 },
  previewContainer: { flex: 1, backgroundColor: "#F8FAFC" },
  previewHeader: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  previewCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  previewTitle: {
    flex: 1,
    marginHorizontal: 12,
    color: "#1E293B",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  previewShareButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight,
  },
  imagePreviewWrap: { flex: 1, padding: 16, justifyContent: "center" },
  imagePreview: { width: "100%", height: "100%" },
  pdfPreview: { flex: 1, backgroundColor: "#fff" },
  previewEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  previewEmptyText: { color: "#64748B", fontSize: 15 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyWrap: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptySub: { fontSize: 13, color: "#94A3B8", textAlign: "center" },
  webviewLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadingCard: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    gap: 12,
  },
  uploadingText: { fontSize: 14, color: "#475569", fontWeight: "500" },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    height: "80%",
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: { flex: 1, backgroundColor: "#000" },
  modalImage: { width: "100%", height: "100%" },
});
