import { CATEGORY_CONFIG } from "@/config/categoryConfig";
import { COLORS } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import CategoryScreen from "./CategoryScreen";

export default function CategoryPage() {
  const params = useLocalSearchParams<{ category?: string }>();
  const router = useRouter();

  const category = Array.isArray(params.category)
    ? params.category[0]
    : params.category;

  const config = category ? CATEGORY_CONFIG[category] : undefined;

  if (!config) return null;

  return (
    <>
      <Stack.Screen
        options={{
          title: config.title,
          headerTintColor: COLORS.primary,

          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons
                name="chevron-back"
                size={26}
                color={COLORS.primary}
                onPress={() => router.back()}
              />
            </TouchableOpacity>
          ),

          headerBackVisible: false, // default back iconu kapat
        }}
      />

      <CategoryScreen config={config} />
    </>
  );
}
