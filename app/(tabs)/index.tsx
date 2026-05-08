import CostGrid from "@/components/CostGrid";
import Header from "@/components/Header";
import SearchBar from "@/components/SearchBar";
import SummaryCard from "@/components/SummaryCard";
import { COST_ITEMS } from "@/data/CostItems";
import { auth, db } from "@/firebaseConfig";
import { router, useLocalSearchParams } from "expo-router";
import { signOut } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Dimensions, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const COLUMN_WIDTH = (width - 48) / 2;

export default function HomeScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const user = auth.currentUser;
  const [search, setSearch] = useState("");
  const [categoryTotals, setCategoryTotals] = useState<Record<string, number>>(
    {},
  );

  useEffect(() => {
    if (!user || !projectId) return;

    const unsub = onSnapshot(
      collection(db, "users", user.uid, "projects", projectId, "categories"),
      (snap) => {
        const totals: Record<string, number> = {};
        snap.docs.forEach((d) => {
          totals[d.id] = d.data().total ?? 0;
        });
        setCategoryTotals(totals);
      },
    );

    return unsub;
  }, [projectId]);

  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c");

  const filteredItems = useMemo(() => {
    if (!search) return COST_ITEMS;
    return COST_ITEMS.filter((item) =>
      normalize(item.title).includes(normalize(search)),
    );
  }, [search]);

  const grandTotal = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
  const handleLogout = () => {
    Alert.alert("Çıkış Yap", "Hesabınızdan çıkmak istiyor musunuz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Çıkış Yap",
        style: "destructive",
        onPress: async () => {
          await signOut(auth);
          router.replace("/(auth)");
        },
      },
    ]);
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <Header
        title="Proje Maliyeti"
        rightIcon="logout"
        onRightIconPress={handleLogout}
        leftMenuIcon
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 50 }}
      >
        <SummaryCard projectId={projectId} total={grandTotal} />
        <SearchBar value={search} onChange={setSearch} />
        <CostGrid
          items={filteredItems}
          columnWidth={COLUMN_WIDTH}
          categoryTotals={categoryTotals}
          projectId={projectId}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
