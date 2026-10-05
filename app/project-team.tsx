import Header from "@/components/Header";
import { ROLE_LABELS, normalizeProjectRole, projectAccessId } from "@/config/projectAccess";
import { COLORS } from "@/constants/theme";
import { auth, db } from "@/firebaseConfig";
import { ProjectRole } from "@/types/projects";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import uuid from "react-native-uuid";

type Member = { uid: string; displayName?: string; email?: string; role: ProjectRole };

const makeCode = () => String(uuid.v4()).replaceAll("-", "").slice(0, 10).toUpperCase();

export default function ProjectTeamScreen() {
  const { projectId, ownerId, projectName } = useLocalSearchParams<{ projectId: string; ownerId: string; projectName: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [role, setRole] = useState<ProjectRole>("chief");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!projectId || !ownerId) return;
    return onSnapshot(
      collection(db, "users", ownerId, "projects", projectId, "members"),
      (snap) => {
        setMembers(snap.docs.map((item) => item.data() as Member));
      },
      (error) => console.error("Ekip üyeleri yüklenemedi:", error),
    );
  }, [ownerId, projectId]);

  const createInvite = async () => {
    if (!auth.currentUser || !projectId || !ownerId) return;
    setCreating(true);
    try {
      const code = makeCode();
      await setDoc(doc(db, "projectInvites", code), {
        ownerId,
        projectId,
        projectName,
        role,
        active: true,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      });
      await Share.share({ message: code });
    } catch {
      Alert.alert("Davet oluşturulamadı", "Lütfen tekrar deneyin.");
    } finally {
      setCreating(false);
    }
  };

  const changeRole = async (member: Member, nextRole: ProjectRole) => {
    const accessId = projectAccessId(ownerId, projectId);
    await updateDoc(doc(db, "users", ownerId, "projects", projectId, "members", member.uid), { role: nextRole });
    await updateDoc(doc(db, "users", member.uid, "projectAccess", accessId), { role: nextRole });
  };

  const removeMember = (member: Member) => {
    Alert.alert("Ekipten çıkar", `${member.displayName || member.email || "Bu kişi"} ekipten çıkarılsın mı?`, [
      { text: "İptal", style: "cancel" },
      { text: "Çıkar", style: "destructive", onPress: async () => {
        await deleteDoc(doc(db, "users", ownerId, "projects", projectId, "members", member.uid));
        await deleteDoc(doc(db, "users", member.uid, "projectAccess", projectAccessId(ownerId, projectId)));
      } },
    ]);
  };

  return <SafeAreaView style={styles.container}>
    <Header title="Ekip ve Yetkiler" />
    <View style={styles.inviteCard}>
      <Text style={styles.title}>Yeni ekip üyesi davet et</Text>
      <Text style={styles.caption}>Şantiye şefi günlük kayıt ve metraj girer. Ofis personeli raporları dışa aktarır ve belgeleri görüntüler. Maliyet, belge yönetimi ve ödemeler yalnızca yöneticidedir. Davet kodu tek kullanımlıktır ve 7 gün geçerlidir.</Text>
      <View style={styles.roles}>
        {(["chief", "office"] as ProjectRole[]).map((item) => <TouchableOpacity key={item} style={[styles.roleButton, role === item && styles.roleActive]} onPress={() => setRole(item)}>
          <Text style={[styles.roleText, role === item && styles.roleTextActive]}>{ROLE_LABELS[item]}</Text>
        </TouchableOpacity>)}
      </View>
      <TouchableOpacity style={styles.shareButton} onPress={createInvite} disabled={creating}>
        {creating ? <ActivityIndicator color="#fff" /> : <><MaterialCommunityIcons name="share-variant-outline" size={19} color="#fff" /><Text style={styles.shareText}>Tek kullanımlık davet oluştur</Text></>}
      </TouchableOpacity>
    </View>
    <Text style={styles.section}>EKİP ÜYELERİ</Text>
    <FlatList data={members} keyExtractor={(item) => item.uid} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>Henüz ekip üyesi yok.</Text>} renderItem={({ item }) => <View style={styles.memberCard}>
      <View style={styles.avatar}><MaterialCommunityIcons name="account-outline" size={22} color={COLORS.primary} /></View>
      <View style={{ flex: 1 }}><Text style={styles.memberName}>{item.displayName || item.email || "Ekip üyesi"}</Text><Text style={styles.memberRole}>{ROLE_LABELS[normalizeProjectRole(item.role)]}</Text></View>
      {item.role !== "owner" && <View style={styles.actions}>
        <TouchableOpacity onPress={() => {
          const roles: ProjectRole[] = ["chief", "office"];
          const currentRole = normalizeProjectRole(item.role);
          changeRole(item, roles[(roles.indexOf(currentRole) + 1) % roles.length]);
        }}><MaterialCommunityIcons name="account-switch-outline" size={21} color={COLORS.primary} /></TouchableOpacity>
        <TouchableOpacity onPress={() => removeMember(item)}><MaterialCommunityIcons name="account-remove-outline" size={21} color="#EF4444" /></TouchableOpacity>
      </View>}
    </View>} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inviteCard: { margin: 16, padding: 18, borderRadius: 18, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  title: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  caption: { fontSize: 13, lineHeight: 19, color: COLORS.textSecondary, marginTop: 6 },
  roles: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 14 },
  roleButton: { flexGrow: 1, minWidth: "30%", padding: 11, alignItems: "center", borderRadius: 11, borderWidth: 1, borderColor: COLORS.border },
  roleActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  roleText: { color: COLORS.textSecondary, fontWeight: "700", fontSize: 12 },
  roleTextActive: { color: COLORS.primary },
  shareButton: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 13, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7 },
  shareText: { color: "#fff", fontWeight: "800" },
  section: { marginHorizontal: 20, marginBottom: 8, fontSize: 11, letterSpacing: 1, color: COLORS.textSecondary, fontWeight: "800" },
  list: { paddingHorizontal: 16, gap: 10, paddingBottom: 30 },
  memberCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.white, borderRadius: 15, padding: 14, borderWidth: 1, borderColor: COLORS.borderLight },
  avatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center" },
  memberName: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  memberRole: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  actions: { flexDirection: "row", gap: 15 },
  empty: { textAlign: "center", color: COLORS.textSecondary, marginTop: 24 },
});
