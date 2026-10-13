import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" options={{ headerShown: true, title: 'Not Found' }} />
    </Stack>
  );
}
