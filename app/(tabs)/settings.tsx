import { Link } from 'expo-router';
import { View } from 'react-native';

import { Card } from '@/components/Card';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { radius, space, useColors } from '@/theme';

type Row = { href: string; title: string; subtitle: string };

const ROWS: Row[] = [
  {
    href: '/settings/targets',
    title: 'الأهداف',
    subtitle: 'السعرات والماكروز لكل نوع يوم',
  },
  {
    href: '/settings/program',
    title: 'محرّر البرنامج',
    subtitle: 'أيام البرنامج، التمارين، وجدول الأسبوع',
  },
  {
    href: '/settings/templates',
    title: 'قوالب الأيام',
    subtitle: 'يوم كامل من الوجبات، يُعاد استخدامه',
  },
  {
    href: '/settings/reminders',
    title: 'التذكيرات',
    subtitle: 'أوقات الوجبات والتمرين ومراجعة الخميس',
  },
];

export default function SettingsScreen() {
  return (
    <Screen title="الإعدادات">
      <View style={{ gap: space.md }}>
        {ROWS.map((row) => (
          <SettingsRow key={row.href} {...row} />
        ))}
      </View>
    </Screen>
  );
}

function SettingsRow({ href, title, subtitle }: Row) {
  const colors = useColors();
  return (
    <Link href={href as never} asChild>
      <PressableScale haptic="light">
        <Card>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: space.md,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading">{title}</Text>
              <Text variant="caption" color="textDim">
                {subtitle}
              </Text>
            </View>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: radius.pill,
                backgroundColor: colors.track,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* RTL: forward is leftwards */}
              <Text variant="label" color="textDim">
                ‹
              </Text>
            </View>
          </View>
        </Card>
      </PressableScale>
    </Link>
  );
}
