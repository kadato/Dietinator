import { useMemo } from 'react';
import { Linking, Pressable } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { ColorPalette } from '@/theme';
import { Box } from '@ui/box';
import { Text } from '@ui/text';

/**
 * Lightweight markdown renderer for controlled content (release changelogs).
 * Supports headings, bullet/numbered lists, bold, italic, inline code, fenced
 * code, blockquotes, links and horizontal rules — enough for the notes the
 * release pipeline generates, with full styling control.
 */

type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; url?: string };

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; code: string }
  | { type: 'quote'; text: string }
  | { type: 'hr' }
  | { type: 'paragraph'; text: string };

const INLINE_PATTERN =
  /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
const LINK_PATTERN = /^\[([^\]]+)\]\(([^)]+)\)$/;

function parseInline(source: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  for (const match of source.matchAll(INLINE_PATTERN)) {
    const index = match.index;
    if (index > lastIndex) {
      tokens.push({ type: 'text', text: source.slice(lastIndex, index) });
    }
    const token = match[0];
    if (token.startsWith('**')) {
      tokens.push({ type: 'bold', text: token.slice(2, -2) });
    } else if (token.startsWith('`')) {
      tokens.push({ type: 'code', text: token.slice(1, -1) });
    } else if (token.startsWith('[')) {
      const link = LINK_PATTERN.exec(token);
      tokens.push({
        type: 'link',
        text: link?.[1] ?? token,
        url: link?.[2],
      });
    } else {
      tokens.push({ type: 'italic', text: token.slice(1, -1) });
    }
    lastIndex = index + token.length;
  }
  if (lastIndex < source.length) {
    tokens.push({ type: 'text', text: source.slice(lastIndex) });
  }
  return tokens;
}

const BULLET = /^[-*]\s+(.*)$/;
const NUMBERED = /^\d+\.\s+(.*)$/;
const HEADING = /^(#{1,3})\s+(.*)$/;

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i += 1;
      continue;
    }
    if (trimmed.startsWith('```')) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'code', code: code.join('\n') });
      continue;
    }
    const heading = HEADING.exec(trimmed);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        text: heading[2],
      });
      i += 1;
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }
    if (trimmed.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', text: quote.join(' ') });
      continue;
    }
    const bullet = BULLET.exec(trimmed);
    const numbered = NUMBERED.exec(trimmed);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const items: string[] = [];
      while (i < lines.length) {
        const line = lines[i].trim();
        const item = ordered ? NUMBERED.exec(line) : BULLET.exec(line);
        if (!item) break;
        items.push(item[1]);
        i += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    const paragraph: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (
        !line ||
        HEADING.test(line) ||
        BULLET.test(line) ||
        NUMBERED.test(line) ||
        line.startsWith('>') ||
        line.startsWith('```')
      ) {
        break;
      }
      paragraph.push(line);
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }
  return blocks;
}

function InlineText({
  tokens,
  colors,
}: {
  tokens: InlineToken[];
  colors: ColorPalette;
}) {
  return (
    <>
      {tokens.map((token, index) => {
        switch (token.type) {
          case 'bold':
            return (
              <Text key={index} bold>
                {token.text}
              </Text>
            );
          case 'italic':
            return (
              <Text key={index} style={{ fontStyle: 'italic' }}>
                {token.text}
              </Text>
            );
          case 'code':
            return (
              <Text
                key={index}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: 4,
                  paddingHorizontal: 3,
                }}
              >
                {token.text}
              </Text>
            );
          case 'link':
            return (
              <Pressable
                key={index}
                onPress={() => {
                  if (token.url) Linking.openURL(token.url).catch(() => undefined);
                }}
                accessibilityRole="link"
                accessibilityLabel={token.text}
              >
                <Text
                  style={{
                    color: colors.primary,
                    textDecorationLine: 'underline',
                  }}
                >
                  {token.text}
                </Text>
              </Pressable>
            );
          default:
            return <Text key={index}>{token.text}</Text>;
        }
      })}
    </>
  );
}

function BlockContent({ block, colors }: { block: Block; colors: ColorPalette }) {
  switch (block.type) {
    case 'heading': {
      const size = block.level === 1 ? 'xl' : block.level === 2 ? 'lg' : 'md';
      return (
        <Text size={size} bold className="text-typography-900 mt-1">
          <InlineText tokens={parseInline(block.text)} colors={colors} />
        </Text>
      );
    }
    case 'list':
      return (
        <Box className="gap-1">
          {block.items.map((item, index) => (
            <Box key={index} className="flex-row gap-2">
              <Text size="sm" className="text-typography-500 w-4 text-right">
                {block.ordered ? `${index + 1}.` : '•'}
              </Text>
              <Box className="flex-1">
                <Text size="sm" className="text-typography-900 leading-[20px]">
                  <InlineText tokens={parseInline(item)} colors={colors} />
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      );
    case 'code':
      return (
        <Box className="rounded-lg border border-outline-100 bg-background-100 px-3 py-2">
          <Text
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              color: colors.text,
              lineHeight: 18,
            }}
          >
            {block.code}
          </Text>
        </Box>
      );
    case 'quote':
      return (
        <Box
          className="border-l-2 pl-3"
          style={{ borderLeftColor: colors.primaryMuted }}
        >
          <Text size="sm" className="text-typography-500 leading-[20px]">
            <InlineText tokens={parseInline(block.text)} colors={colors} />
          </Text>
        </Box>
      );
    case 'hr':
      return <Box className="border-t border-outline-200" />;
    default:
      return (
        <Text size="sm" className="text-typography-900 leading-[20px]">
          <InlineText tokens={parseInline(block.text)} colors={colors} />
        </Text>
      );
  }
}

export function Markdown({ source }: { source: string }) {
  const { colors } = useTheme();
  const blocks = useMemo(() => parseBlocks(source), [source]);
  return (
    <Box className="gap-2">
      {blocks.map((block, index) => (
        <BlockContent key={index} block={block} colors={colors} />
      ))}
    </Box>
  );
}
