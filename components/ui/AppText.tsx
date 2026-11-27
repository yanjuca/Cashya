import React from 'react';
import { Text as RNText, TextProps } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';

function translateChildren(children: React.ReactNode, t: (text: string) => string): React.ReactNode {
  if (typeof children === 'string') return t(children);
  if (Array.isArray(children)) {
    return children.map((child) => translateChildren(child, t));
  }
  return children;
}

export default function Text({ children, ...rest }: TextProps) {
  const { t } = useLanguage();
  return <RNText {...rest}>{translateChildren(children, t)}</RNText>;
}
