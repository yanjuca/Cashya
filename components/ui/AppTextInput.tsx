import React from 'react';
import { TextInput as RNTextInput, TextInputProps } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';

export default function TextInput({
  placeholder,
  ...rest
}: TextInputProps & { ref?: React.Ref<any> }) {
  const { t } = useLanguage();
  return <RNTextInput {...rest} placeholder={placeholder ? t(placeholder) : placeholder} />;
}
