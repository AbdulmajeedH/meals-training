import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Text } from '@/components/Text';
import { db, migrations } from '@/db/client';
import { seedNutrition } from '@/db/seed/nutrition';
import { seedProgram } from '@/db/seed/program';
import { configureNotificationHandler } from '@/notifications/reminders';
import { applyRtl, needsRtlReload, reloadForRtl } from '@/lib/rtl';
import { space, useColors, useScheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden — nothing to do.
});

// A reminder that arrives while the app is open should still be visible.
configureNotificationHandler();

export default function RootLayout() {
  const colors = useColors();
  const scheme = useScheme();

  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });

  const { success: migrated, error: migrationError } = useMigrations(db, migrations);

  // Whether RTL is already on is knowable synchronously, so it seeds the state
  // rather than being written back from an effect.
  const [rtl, setRtl] = useState<'ok' | 'reloading' | 'blocked'>(() =>
    needsRtlReload() ? 'reloading' : 'ok',
  );

  useEffect(() => {
    if (rtl !== 'reloading') return;
    let cancelled = false;
    applyRtl();
    reloadForRtl().then((reloaded) => {
      // A successful reload tears down this tree, so only failure lands here.
      if (!cancelled && !reloaded) setRtl('blocked');
    });
    return () => {
      cancelled = true;
    };
  }, [rtl]);

  // Both plans are written once, into an empty database. Each seed refuses to
  // run if its own tables already hold anything, so neither can clobber edits.
  useEffect(() => {
    if (!migrated) return;
    seedNutrition();
    seedProgram();
  }, [migrated]);

  const ready = (fontsLoaded || Boolean(fontError)) && migrated && rtl === 'ok';

  useEffect(() => {
    if (ready || migrationError) SplashScreen.hideAsync().catch(() => {});
  }, [ready, migrationError]);

  if (migrationError) {
    return <Fatal message="تعذّر تجهيز قاعدة البيانات" detail={migrationError.message} />;
  }

  if (rtl === 'blocked') {
    return <Fatal message="أعد فتح التطبيق" detail="لتفعيل الاتجاه من اليمين لليسار." />;
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_left', // RTL: forward motion travels leftwards
          }}
        >
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Fatal({ message, detail }: { message: string; detail?: string }) {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: space.xl,
        gap: space.sm,
      }}
    >
      <Text variant="title" align="center">
        {message}
      </Text>
      {detail ? (
        <Text variant="caption" color="textDim" align="center">
          {detail}
        </Text>
      ) : null}
    </View>
  );
}
