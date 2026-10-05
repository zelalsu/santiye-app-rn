import Header from "@/components/Header";
import { COLORS } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PdfViewerScreen() {
  const { uri } = useLocalSearchParams<{
    uri: string;
  }>();

  useEffect(() => {
    if (uri) {
      WebBrowser.openBrowserAsync(uri);
    }
  }, [uri]);

  const handleShare = async () => {
    if (!uri) return;

    await Sharing.shareAsync(uri);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="PDF Hazır" backIcon />

      <View style={styles.content}>
        <MaterialCommunityIcons
          name="file-pdf-box"
          size={80}
          color={COLORS.primary}
        />

        <Text style={styles.title}>PDF başarıyla oluşturuldu</Text>

        <Text style={styles.subtitle}>PDF görüntüleyici açıldı.</Text>

        <TouchableOpacity style={styles.button} onPress={handleShare}>
          <MaterialCommunityIcons name="download" size={20} color="#fff" />

          <Text style={styles.buttonText}>Paylaş / İndir</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  title: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 24,
    color: COLORS.text,
  },

  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.textMuted,
  },

  button: {
    marginTop: 30,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 18,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
