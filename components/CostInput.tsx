import { StyleSheet, Text, TextInput, View } from "react-native";

export const CostInput = ({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = "numeric",
  prefix,
}: any) => (
  <View style={styles.container}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputWrapper}>
      {prefix && <Text style={styles.prefix}>{prefix}</Text>}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { marginBottom: 15 },
  label: { fontSize: 11, fontWeight: "700", color: "#A0A0A0", marginBottom: 8 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    paddingHorizontal: 15,
    height: 50,
  },
  input: { flex: 1, fontSize: 15, color: "#333" },
  prefix: { color: "#8e8e93", marginRight: 5 },
});
