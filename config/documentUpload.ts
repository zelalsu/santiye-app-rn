import { db, storage } from "@/firebaseConfig";
import * as FileSystem from "expo-file-system/legacy";
import { addDoc, collection } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import uuid from "react-native-uuid";

interface UploadResult {
  success: boolean;
  document?: {
    id: string;
    name: string;
    type: string;
    url: string;
    size: number;
    createdAt: Date;
  };
  error?: string;
}

export const uploadDocument = async (
  fileUri: string,
  fileName: string,
  fileType: string,
  userId: string,
  projectId: string,
  phaseId: string,
  requiredDocumentId?: string,
): Promise<UploadResult> => {
  try {
    // Dosya bilgilerini al - Yeni API ile
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    const fileSize = fileInfo.exists && "size" in fileInfo ? fileInfo.size : 0;

    if (fileSize > 20 * 1024 * 1024) {
      return {
        success: false,
        error: "Dosya 20 MB'dan büyük olamaz. Daha küçük bir dosya seçin.",
      };
    }

    // Storage path oluştur
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageName = `${Date.now()}_${String(uuid.v4()).slice(0, 8)}_${safeFileName}`;
    const storagePath = `users/${userId}/projects/${projectId}/phases/${phaseId}/documents/${storageName}`;
    const storageRef = ref(storage, storagePath);

    // Dosyayı yükle
    const response = await fetch(fileUri);
    const blob = await response.blob();

    const uploadTask = await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);

    // Firestore'a kaydet
    const documentType = fileType.startsWith("image/")
      ? "image"
      : fileType.includes("spreadsheet") || fileType.includes("excel") || fileName.toLowerCase().endsWith(".xlsx")
        ? "spreadsheet"
        : "pdf";
    const docData = {
      name: fileName,
      type: documentType,
      url: downloadUrl,
      size: fileSize,
      createdAt: new Date(),
      originalName: fileName,
      ...(requiredDocumentId && { requiredDocumentId }), // ← sadece varsa ekle
    };

    const docsRef = collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "phases",
      phaseId,
      "documents",
    );

    const docRef = await addDoc(docsRef, docData);

    return {
      success: true,
      document: {
        id: docRef.id,
        ...docData,
      },
    };
  } catch (error: any) {
    console.error("Dosya yükleme hatası:", error);
    return {
      success: false,
      error: error.message || "Dosya yüklenirken bir hata oluştu",
    };
  }
};
