import React from 'react';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { textStyle } from './styles';

const lineClampByCount: Record<number, string> = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
};

function lineClampClass(numberOfLines?: number): string | undefined {
  if (numberOfLines == null || numberOfLines < 1) return undefined;
  return lineClampByCount[numberOfLines] ?? lineClampByCount[6];
}

type ITextProps = React.ComponentProps<'span'> &
  VariantProps<typeof textStyle> & {
    numberOfLines?: number;
  };

const Text = React.forwardRef<React.ComponentRef<'span'>, ITextProps>(
  function Text(
    {
      className,
      isTruncated,
      bold,
      underline,
      strikeThrough,
      size = 'md',
      sub,
      italic,
      highlight,
      numberOfLines,
      ...props
    }: { className?: string } & ITextProps,
    ref
  ) {
    const clampClass = lineClampClass(numberOfLines);

    return (
      <span
        className={textStyle({
          isTruncated: isTruncated as boolean,
          bold: bold as boolean,
          underline: underline as boolean,
          strikeThrough: strikeThrough as boolean,
          size,
          sub: sub as boolean,
          italic: italic as boolean,
          highlight: highlight as boolean,
          class: [className, clampClass].filter(Boolean).join(' '),
        })}
        {...props}
        ref={ref}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text };
