import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TextInput, View } from "react-native";

interface Props {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Kategori ara...",
}: Props) {
  return (
    <View style={styles.searchSection}>
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          value={value}
          onChangeText={onChange}
        />
        {value.length > 0 && (
          <Ionicons
            name="close-circle"
            size={20}
            color="#cbd5e1"
            onPress={() => onChange("")}
          />
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  searchSection: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    alignItems: "center",
    paddingHorizontal: 15,
    height: 50,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14 },
  filterButton: {
    backgroundColor: "#FFFFFF",
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
});
