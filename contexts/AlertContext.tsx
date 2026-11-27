import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { Alert } from 'react-native';
import CustomAlertModal, {
  AlertButton,
  AlertConfig,
  AlertType,
} from '../components/ui/CustomAlertModal';

export { AlertButton, AlertConfig, AlertType };

export interface AlertContextData {
  showAlert: {
    (config: AlertConfig): void;
    (
      title: string,
      message?: string,
      buttons?: AlertButton[],
      type?: AlertType
    ): void;
  };
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextData | undefined>(undefined);

// Global handler for calling alerts outside React components if needed
let globalShowAlert:
  | ((
      titleOrConfig: string | AlertConfig,
      message?: string,
      buttons?: AlertButton[],
      type?: AlertType
    ) => void)
  | null = null;

export const customAlert = (
  titleOrConfig: string | AlertConfig,
  message?: string,
  buttons?: AlertButton[],
  type?: AlertType
) => {
  if (globalShowAlert) {
    globalShowAlert(titleOrConfig, message, buttons, type);
  } else {
    // Fallback if context is not yet mounted
    if (typeof titleOrConfig === 'string') {
      Alert.alert(titleOrConfig, message, buttons as any);
    } else {
      Alert.alert(
        titleOrConfig.title,
        titleOrConfig.message,
        titleOrConfig.buttons as any
      );
    }
  }
};

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const hideAlert = useCallback(() => {
    setVisible(false);
  }, []);

  const showAlert = useCallback(
    (
      titleOrConfig: string | AlertConfig,
      message?: string,
      buttons?: AlertButton[],
      type?: AlertType
    ) => {
      let resolvedConfig: AlertConfig;

      if (typeof titleOrConfig === 'object') {
        resolvedConfig = titleOrConfig;
      } else {
        resolvedConfig = {
          title: titleOrConfig,
          message,
          buttons,
          type,
        };
      }

      setAlertConfig(resolvedConfig);
      setVisible(true);
    },
    []
  );

  // Register global handler
  React.useEffect(() => {
    globalShowAlert = showAlert;
    return () => {
      globalShowAlert = null;
    };
  }, [showAlert]);

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <CustomAlertModal
        visible={visible}
        config={alertConfig}
        onClose={hideAlert}
      />
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextData {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}
