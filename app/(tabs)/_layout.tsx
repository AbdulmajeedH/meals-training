import { Tabs } from 'expo-router';

import { Icon, type IconName } from '@/components/Icon';
import { font, useColors } from '@/theme';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'اليوم', icon: 'today' },
  { name: 'meals', title: 'الوجبات', icon: 'meals' },
  { name: 'training', title: 'التمارين', icon: 'training' },
  { name: 'progress', title: 'التقدم', icon: 'progress' },
  { name: 'settings', title: 'الإعدادات', icon: 'settings' },
];

export default function TabsLayout() {
  const colors = useColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 88,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
      }}
    >
      {TABS.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color }) => <Icon name={icon} color={String(color)} />,
          }}
        />
      ))}
    </Tabs>
  );
}
