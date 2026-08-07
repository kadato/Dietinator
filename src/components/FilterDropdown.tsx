import { useState } from 'react';
import { Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Text } from '@ui/text';
import { Card } from '@ui/card';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};

export function FilterDropdown<T extends string>({ value, options, onChange }: Props<T>) {
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();
  const selected = options.find((o) => o.value === value) ?? options[0];

  return (
    <>
      <Pressable
        className="flex-1 flex-row items-center justify-between rounded-xl border border-outline-300 bg-background-50 px-4 py-3"
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Filter: ${selected.label}`}
      >
        <Text size="md" bold className="text-typography-900">
          {selected.label}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          className="flex-1 bg-black/30 justify-center p-8"
          onPress={() => setOpen(false)}
        >
          <Card variant="outline" className="rounded-2xl overflow-hidden p-1">
            {options.map((option) => {
              const active = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  className={`px-4 py-3.5 rounded-xl ${active ? 'bg-background-100' : ''}`}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    size="md"
                    bold={active}
                    className={active ? 'text-typography-900' : 'text-typography-700'}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
        </Pressable>
      </Modal>
    </>
  );
}
