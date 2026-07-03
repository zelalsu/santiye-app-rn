import Header from "@/components/Header";
import { COLORS } from "@/constants/theme";
import { auth, db } from "@/firebaseConfig";
import { resetChatSession, sendAiMessage } from "@/services/aiService";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc } from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const SUGGESTIONS = [
  "İnşaat aşamaları nelerdir?",
  "Hangi belgeler zorunludur?",
  "Maliyet hesabında nelere dikkat etmeliyim?",
  "Ruhsat süreci nasıl işler?",
];

export default function AiScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [projectName, setProjectName] = useState<string | undefined>();
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const loadProject = async () => {
      const user = auth.currentUser;
      const projectId = await AsyncStorage.getItem("activeProjectId");
      if (!user || !projectId) return;

      try {
        const snap = await getDoc(
          doc(db, "users", user.uid, "projects", projectId),
        );
        if (snap.exists()) {
          setProjectName(snap.data().name);
        }
      } catch {
        // Proje adı yüklenemezse asistan yine de çalışır
      }
    };

    loadProject();
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const handleSend = async (text?: string) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || loading) return;

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      role: "user",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    scrollToBottom();

    try {
      const reply = await sendAiMessage(trimmed, projectName);
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-assistant`, role: "assistant", text: reply },
      ]);
    } catch (error) {
      console.error("AI error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          text: "Üzgünüm, şu an yanıt veremiyorum. Firebase AI Logic'in etkin olduğundan emin olun ve tekrar deneyin.",
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const handleClear = () => {
    Alert.alert("Sohbeti Temizle", "Tüm mesajlar silinecek. Emin misiniz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Temizle",
        style: "destructive",
        onPress: () => {
          resetChatSession();
          setMessages([]);
        },
      },
    ]);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.messageRowUser : styles.messageRowAssistant,
        ]}
      >
        {!isUser && (
          <View style={styles.avatar}>
            <Ionicons name="sparkles" size={16} color={COLORS.primary} />
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant,
            ]}
          >
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header
        title="AI Asistan"
        subtitle={projectName ?? "Proje seçilmedi"}
        rightIcon="delete-outline"
        onRightIconPress={handleClear}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="sparkles" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>Merhaba!</Text>
            <Text style={styles.emptySub}>
              İnşaat projeleriniz, belgeler ve maliyet hesapları hakkında soru
              sorabilirsiniz.
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestionChip}
                  onPress={() => handleSend(suggestion)}
                  disabled={loading}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
          />
        )}

        {loading && (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.typingText}>Yanıt yazılıyor...</Text>
          </View>
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Bir soru sorun..."
            placeholderTextColor="#94A3B8"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1000}
            editable={!loading}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!input.trim() || loading) && styles.sendBtnDisabled,
            ]}
            onPress={() => handleSend()}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  flex: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  messageRow: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-end",
    gap: 8,
  },
  messageRowUser: { justifyContent: "flex-end" },
  messageRowAssistant: { justifyContent: "flex-start" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: "#fff" },
  bubbleTextAssistant: { color: "#1E293B" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  suggestions: { width: "100%", gap: 8 },
  suggestionChip: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  suggestionText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "600",
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  typingText: { fontSize: 13, color: "#94A3B8" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: "#F1F5F9",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1E293B",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
});
