import type { ReactNode } from 'react';
import { Card } from '@ui/card';
import { Text } from '@ui/text';
import { Box } from '@ui/box';

type Props = {
  title: string;
  children: ReactNode;
};

export function SettingsSection({ title, children }: Props) {
  return (
    <Box className="mb-5">
      <Text size="xs" bold className="text-typography-500 uppercase mb-2 tracking-wider px-1">
        {title}
      </Text>
      <Card variant="elevated" className="rounded-2xl overflow-hidden p-0">
        {children}
      </Card>
    </Box>
  );
}
