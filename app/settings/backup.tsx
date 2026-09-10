import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { backupSummary, exportBackup, type ImportResult } from '@/db/backup';
import { useDbQuery } from '@/db/useQuery';
import {
  listRemoteBackups,
  restoreFromFile,
  restoreFromRemote,
  shareBackupFile,
  uploadBackup,
  type RemoteBackup,
} from '@/lib/backupFile';
import { n } from '@/lib/num';
import { isConfigured } from '@/lib/supabase';
import { space } from '@/theme';

export default function BackupScreen() {
  const router = useRouter();
  const summary = useDbQuery(() => backupSummary(exportBackup()), []);
  const [busy, setBusy] = useState(false);
  const [remote, setRemote] = useState<RemoteBackup[] | null>(null);

  const configured = isConfigured();
  const totalRows = summary.reduce((total, entry) => total + entry.rows, 0);

  const announce = (result: ImportResult | { ok: false; reason: 'cancelled' }) => {
    if (result.ok) {
      Alert.alert('تم الاسترجاع', `${n(result.rows)} صف.`);
      return;
    }
    if (result.reason === 'cancelled') return;

    const message =
      result.reason === 'bad_shape'
        ? 'الملف ليس نسخة احتياطية صالحة.'
        : result.reason === 'unsupported_version'
          ? 'النسخة الاحتياطية من إصدار أحدث من التطبيق.'
          : ('message' in result && result.message) || 'فشل الاسترجاع.';

    Alert.alert('لم يتم الاسترجاع', `${message}\n\nبياناتك الحالية لم تتغيّر.`);
  };

  const confirmRestore = (run: () => Promise<ImportResult | { ok: false; reason: 'cancelled' }>) => {
    Alert.alert(
      'استرجاع نسخة',
      'سيُستبدل كل ما في التطبيق ببيانات النسخة. لا يمكن التراجع.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'استرجع',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            announce(await run());
            setBusy(false);
          },
        },
      ],
    );
  };

  return (
    <Screen
      title="النسخ الاحتياطي"
      subtitle="بياناتك على جهازك؛ هذه طرق نقلها"
      action={
        <PressableScale onPress={() => router.back()} haptic="light" accessibilityLabel="رجوع">
          <Text variant="label" color="accent">
            تم
          </Text>
        </PressableScale>
      }
    >
      <View style={{ gap: space.xl }}>
        <Card>
          <View style={{ gap: space.sm }}>
            <Text variant="heading">{`${n(totalRows)} صف في ${n(summary.length)} جدول`}</Text>
            <Text variant="caption" color="textDim">
              {summary.map((entry) => `${entry.table} ${n(entry.rows)}`).join(' · ')}
            </Text>
          </View>
        </Card>

        {/* ------------------------------------------------------ as a file */}
        <View style={{ gap: space.md }}>
          <Text variant="heading">ملف JSON</Text>
          <Button
            title="صدّر وشارك"
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              const result = await shareBackupFile();
              setBusy(false);
              if (!result.ok) Alert.alert('تعذّر التصدير', result.message ?? '');
            }}
          />
          <Button
            title="استرجع من ملف"
            variant="secondary"
            disabled={busy}
            onPress={() => confirmRestore(restoreFromFile)}
          />
        </View>

        {/* ------------------------------------------------------- supabase */}
        <View style={{ gap: space.md }}>
          <Text variant="heading">Supabase</Text>

          {!configured ? (
            <Card>
              <Text variant="caption" color="textDim">
                لم تُضبط إعدادات Supabase. أضف supabaseUrl و supabaseAnonKey في app.json تحت
                expo.extra لتفعيل الرفع والاسترجاع السحابي.
              </Text>
            </Card>
          ) : (
            <>
              <Button
                title="ارفع نسخة"
                variant="secondary"
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  const result = await uploadBackup();
                  setBusy(false);
                  Alert.alert(
                    result.ok ? 'تم الرفع' : 'تعذّر الرفع',
                    result.message ?? '',
                  );
                }}
              />
              <Button
                title="اعرض النسخ المرفوعة"
                variant="secondary"
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  setRemote(await listRemoteBackups());
                  setBusy(false);
                }}
              />

              {remote?.length === 0 ? (
                <Card>
                  <Text variant="caption" color="textDim">
                    لا توجد نسخ مرفوعة.
                  </Text>
                </Card>
              ) : null}

              {remote?.map((entry) => (
                <PressableScale
                  key={entry.name}
                  haptic="light"
                  onPress={() => confirmRestore(() => restoreFromRemote(entry.name))}
                >
                  <Card>
                    <Text variant="body" numberOfLines={1}>
                      {entry.name}
                    </Text>
                  </Card>
                </PressableScale>
              ))}
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}
