import { Project } from "@/types/projects";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ProjectCard({
  item,
  index,
  onPress,
  onEditPress,
  onLongPress,
}: {
  item: Project;
  index: number;
  onPress: () => void;
  onEditPress: () => void;
  onLongPress: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay: index * 70,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: index * 70,
        useNativeDriver: true,
        tension: 90,
        friction: 14,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.975,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  const cost = (item.totalCost ?? 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
  });

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
      }}
    >
      <TouchableOpacity
        style={styles.projectCard}
        activeOpacity={1}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.projectIconBox}>
          <MaterialCommunityIcons
            name="office-building"
            size={20}
            color="#0058be"
          />
        </View>

        <View style={styles.projectInfo}>
          <Text style={styles.projectName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.projectCost}>₺{cost}</Text>
        </View>

        <View style={styles.arrowBox}>
          <Ionicons name="chevron-forward" size={16} color="#0058be" />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${item.name} adını değiştir`}
            onPress={onEditPress}
            style={[styles.actionButton, styles.editButton]}
          >
            <MaterialCommunityIcons
              name="pencil-outline"
              size={18}
              color="#1e529c"
            />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${item.name} şantiyesini sil`}
            onPress={onLongPress}
            style={[styles.actionButton, styles.deleteButton]}
          >
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={18}
              color="#ef4444"
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  projectCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#0058be",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  projectIconBox: {
    width: 48,
    height: 48,
    backgroundColor: "#eff6ff",
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  projectInfo: { flex: 1 },
  projectName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Manrope",
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  projectCost: {
    fontSize: 13,
    color: "#64748b",
    fontFamily: "Inter",
    fontWeight: "500",
  },
  arrowBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  editButton: { backgroundColor: "#eff6ff" },
  deleteButton: { backgroundColor: "#fee2e2" },
});
