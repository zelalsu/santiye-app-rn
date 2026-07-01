import { Stack } from "expo-router";

export default function DocumentsStackLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false, // Ana listede header gösterme
        }}
      />
      <Stack.Screen
        name="[doc]"
        options={{
          headerShown: false, // Detay sayfasında header gösterme
        }}
      />
    </Stack>
  );
}
