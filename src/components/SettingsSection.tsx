import type { ReactNode } from "react"
import { Card } from "@ui/card"
import { Text } from "@ui/text"
import { Box } from "@ui/box"

type Props = {
  title: string
  children: ReactNode
}

export function SettingsSection({ title, children }: Props) {
  return (
    <Box className="mb-5">
      <Text size="xs" bold className="mb-2 px-1 uppercase tracking-wider text-typography-500">
        {title}
      </Text>
      <Card variant="elevated" className="overflow-hidden rounded-2xl p-0">
        {children}
      </Card>
    </Box>
  )
}
