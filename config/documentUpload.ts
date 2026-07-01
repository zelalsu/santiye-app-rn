import { db, storage } from "@/firebaseConfig";
import * as FileSystem from "expo-file-system/legacy";
import { addDoc, collection } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

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
    const fileSize = fileInfo.size || 0;

    // Storage path oluştur
    const storagePath = `users/${userId}/projects/${projectId}/phases/${phaseId}/documents/${fileName}`;
    const storageRef = ref(storage, storagePath);

    // Dosyayı yükle
    const response = await fetch(fileUri);
    const blob = await response.blob();

    const uploadTask = await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);

    // Firestore'a kaydet
    const docData = {
      name: fileName,
      type: fileType.startsWith("image/") ? "image" : "pdf",
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
