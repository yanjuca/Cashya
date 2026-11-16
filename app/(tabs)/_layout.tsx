import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import PagerView, { PagerViewOnPageSelectedEvent } from 'react-native-pager-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import AddCardModal from '../../components/cards/AddCardModal';
import AddExpenseScreen from '../../components/screens/AddExpenseScreen';
import SettingsScreen from '../../components/screens/SettingsScreen';
import StatisticsTabScreen from '../../components/screens/StatisticsTabScreen';
import TransactionsScreen, { ViewMode } from '../../components/screens/TransactionsScreen';
import WalletHomeScreen from '../../components/screens/WalletHomeScreen';
import FAB from '../../components/ui/FAB';
import { useAlert } from '../../contexts/AlertContext';
import { useExpenses } from '../../contexts/ExpensesContext';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, hexToRgba, ThemeColors } from '../../theme';

interface TabItemConfig {
  key: string;
  label: string;
  headerTitle: string;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
}

const TABS: TabItemConfig[] = [
  {
    key: 'home',
    label: 'Home',
    headerTitle: 'cash',
    iconActive: 'wallet',
    iconInactive: 'wallet-outline',
  },
  {
    key: 'transactions',
    label: 'Transactions',
    headerTitle: 'transactions',
    iconActive: 'swap-horizontal',
    iconInactive: 'swap-horizontal-outline',
  },
  {
    key: 'statistics',
    label: 'Analytics',
    headerTitle: 'analytics',
    iconActive: 'pie-chart',
    iconInactive: 'pie-chart-outline',
  },
  {
    key: 'settings',
    label: 'Settings',
    headerTitle: 'settings',
    iconActive: 'settings',
    iconInactive: 'settings-outline',
  },
];

export default function TabsLayout() {
  const pagerRef = useRef<PagerView>(null);
  const { removeExpenses } = useExpenses();
  const { showAlert } = useAlert();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [isCalendarSwiping, setIsCalendarSwiping] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());

  const toggleOpacity = useRef(new Animated.Value(0)).current;
  const editBarAnim = useRef(new Animated.Value(0)).current;
  const toggleSlideAnim = useRef(new Animated.Value(viewMode === 'calendar' ? 1 : 0)).current;

  // FAB should only be visible on Home (0) and Transactions (1) and when not in edit mode
  const isFabVisible = (currentPage === 0 || currentPage === 1) && !isEditMode;

  useEffect(() => {
    Animated.timing(toggleSlideAnim, {
      toValue: viewMode === 'calendar' ? 1 : 0,
      duration: 320,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start();
  }, [viewMode, toggleSlideAnim]);

  useEffect(() => {
    Animated.spring(editBarAnim, {
      toValue: isEditMode ? 1 : 0,
      tension: 65,
      friction: 11,
      useNativeDriver: false,
    }).start();
  }, [isEditMode, editBarAnim]);

  useEffect(() => {
    if (!isEditMode) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleExitEditMode();
      return true;
    });
    return () => backHandler.remove();
  }, [isEditMode]);

  useEffect(() => {
    Animated.timing(toggleOpacity, {
      toValue: currentPage === 1 ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [currentPage]);

  // Track scroll position per tab for the top gradient fade
  const scrollYMap = useRef<{ [key: number]: number }>({ 0: 0, 1: 0, 2: 0, 3: 0 });
  const topGradientAnim = useRef(new Animated.Value(0)).current;

  // Calculates opacity (0 to 1) based on scroll offset y
  // Starts fading at y = 0 and reaches 100% opacity smoothly at y = 60
  const calculateOpacity = (y: number) => {
    return Math.min(1, Math.max(0, y / 60));
  };

  const handleScroll = (pageIndex: number, y: number) => {
    scrollYMap.current[pageIndex] = y;
    if (pageIndex === currentPage) {
      topGradientAnim.setValue(calculateOpacity(y));
    }
  };

  const handleExitEditMode = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
    setIsEditMode(false);
    setSelectedExpenseIds(new Set());
  };

  const handleDeleteSelected = () => {
    const count = selectedExpenseIds.size;
    if (count === 0) return;

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }

    showAlert({
      title: 'Delete Transactions',
      message: `Are you sure you want to delete ${count} ${
        count === 1 ? 'transaction' : 'transactions'
      }? This action cannot be undone.`,
      type: 'danger',
      icon: 'trash-outline',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const idsToDelete = Array.from(selectedExpenseIds);
            await removeExpenses(idsToDelete);
            setIsEditMode(false);
            setSelectedExpenseIds(new Set());
            showAlert({
              title: 'Deleted',
              message: `${count} ${
                count === 1 ? 'transaction' : 'transactions'
              } deleted successfully.`,
              type: 'success',
            });
          },
        },
      ],
    });
  };

  const handleToggleSelect = (id: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
    setSelectedExpenseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) {
        setIsEditMode(false);
      }
      return next;
    });
  };

  const handleStartEditMode = (id: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    setIsEditMode(true);
    setSelectedExpenseIds(new Set([id]));
  };

  const handleBatchSelect = (ids: string[], select: boolean) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
    setSelectedExpenseIds((prev) => {
      const next = new Set(prev);
      if (select) {
        ids.forEach((id) => next.add(id));
      } else {
        ids.forEach((id) => next.delete(id));
      }
      if (next.size === 0) {
        setIsEditMode(false);
      }
      return next;
    });
  };

  const handleTabPress = (index: number) => {
    if (isEditMode) {
      handleExitEditMode();
    }
    setCurrentPage(index);
    pagerRef.current?.setPage(index);
    Animated.timing(topGradientAnim, {
      toValue: calculateOpacity(scrollYMap.current[index] || 0),
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const handlePageSelected = (e: PagerViewOnPageSelectedEvent) => {
    const nextIndex = e.nativeEvent.position;
    if (isEditMode) {
      handleExitEditMode();
    }
    if (nextIndex !== currentPage) {
      setCurrentPage(nextIndex);
      Animated.timing(topGradientAnim, {
        toValue: calculateOpacity(scrollYMap.current[nextIndex] || 0),
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    if (mode === viewMode) return;
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {
        // Silently ignore
      }
    }
    setViewMode(mode);
  };

  const dockHeight = editBarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [64, 118],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} />

      {/* Persistent Header across tabs */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{TABS[currentPage]?.headerTitle || 'cash'}</Text>

        {/* View Mode Toggle Switch (only visible on Transactions page) */}
        <Animated.View
          style={[
            styles.toggleWrapper,
            { opacity: toggleOpacity },
          ]}
          pointerEvents={currentPage === 1 ? 'auto' : 'none'}
        >
          <View style={styles.toggleContainer}>
            <Animated.View
              style={[
                styles.toggleSlidingPill,
                {
                  transform: [
                    {
                      translateX: toggleSlideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 42],
                      }),
                    },
                  ],
                },
              ]}
              pointerEvents="none"
            />
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => handleViewModeChange('list')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="list"
                size={18}
                color={viewMode === 'list' ? colors.text : colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => handleViewModeChange('calendar')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="calendar"
                size={18}
                color={viewMode === 'calendar' ? colors.text : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={handlePageSelected}
        offscreenPageLimit={3}
        scrollEnabled={!isCalendarSwiping && !isEditMode}
      >
        <View key="home" style={styles.pageContainer}>
          <WalletHomeScreen
            onScroll={(e) => handleScroll(0, e.nativeEvent.contentOffset.y)}
            isEditMode={currentPage === 0 && isEditMode}
            selectedExpenseIds={currentPage === 0 ? selectedExpenseIds : new Set()}
            onToggleSelect={handleToggleSelect}
            onStartEditMode={handleStartEditMode}
          />
        </View>

        <View key="transactions" style={styles.pageContainer}>
          <TransactionsScreen
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onCalendarGestureActive={setIsCalendarSwiping}
            onScroll={(e) => handleScroll(1, e.nativeEvent.contentOffset.y)}
          />
        </View>

        <View key="statistics" style={styles.pageContainer}>
          <StatisticsTabScreen onScroll={(e) => handleScroll(2, e.nativeEvent.contentOffset.y)} />
        </View>

        <View key="settings" style={styles.pageContainer}>
          <SettingsScreen onScroll={(e) => handleScroll(3, e.nativeEvent.contentOffset.y)} />
        </View>
      </PagerView>

      {/* Top Gradient Fade Overlay (soft fade beneath header only when scrolled) */}
      <Animated.View
        style={[
          styles.topGradient,
          {
            opacity: topGradientAnim,
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[
            colors.background,
            hexToRgba(colors.background, 0.8),
            hexToRgba(colors.background, 0.3),
            hexToRgba(colors.background, 0),
          ]}
          locations={[0, 0.35, 0.7, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </Animated.View>

      {/* Bottom Gradient Fade Overlay */}
      <LinearGradient
        colors={[
          hexToRgba(colors.background, 0),
          hexToRgba(colors.background, 0.3),
          hexToRgba(colors.background, 0.8),
          colors.background,
        ]}
        locations={[0, 0.3, 0.65, 1]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Floating Bottom Navigation Bar / Edit Action Dock */}
      <Animated.View style={[styles.tabBar, { height: dockHeight }]}>
        {/* Top Tier: Batch Selection Bar (slides in & fades when entering edit mode) */}
        <Animated.View
          style={[
            styles.dockEditBar,
            {
              opacity: editBarAnim,
              maxHeight: editBarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 52],
              }),
              transform: [
                {
                  translateY: editBarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents={isEditMode ? 'auto' : 'none'}
        >
          <View style={styles.dockEditLeft}>
            <TouchableOpacity
              style={styles.dockCloseBtn}
              onPress={handleExitEditMode}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={16} color={colors.dockCloseIcon} />
            </TouchableOpacity>
            <Text style={styles.dockCountText}>
              {selectedExpenseIds.size} SELECTED
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.dockDeleteBtn,
              selectedExpenseIds.size === 0 && styles.dockDeleteBtnDisabled,
            ]}
            onPress={handleDeleteSelected}
            disabled={selectedExpenseIds.size === 0}
            activeOpacity={0.8}
          >
            <Ionicons
              name="trash-outline"
              size={14}
              color={selectedExpenseIds.size > 0 ? colors.primaryText : colors.textMuted}
            />
            <Text
              style={[
                styles.dockDeleteText,
                selectedExpenseIds.size === 0 && styles.dockDeleteTextDisabled,
              ]}
            >
              DELETE
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Hairline Divider inside the dock */}
        <Animated.View
          style={[
            styles.dockDivider,
            {
              opacity: editBarAnim,
              height: editBarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
          ]}
        />

        {/* Bottom Tier: Normal Tab Items */}
        <View style={styles.dockTabsRow}>
          {TABS.map((tab, index) => {
            const focused = currentPage === index;
            const color = focused ? colors.primary : colors.textMuted;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tabBarItem}
                onPress={() => handleTabPress(index)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={focused ? tab.iconActive : tab.iconInactive}
                  size={20}
                  color={color}
                  style={styles.tabBarIcon}
                />
                <Text style={[styles.tabBarLabel, { color }]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>

      {/* Speed Dial Floating Action Button */}
      <FAB
        visible={isFabVisible}
        bottomOffset={95}
        actions={[
          {
            id: 'card',
            label: 'Add Card',
            icon: 'card-outline',
            onPress: () => setShowAddCard(true),
          },
          {
            id: 'expense',
            label: 'Add Expense',
            icon: 'receipt-outline',
            onPress: () => setShowAddExpense(true),
          },
        ]}
      />

      {/* Global Add Expense Modal */}
      <AddExpenseScreen
        visible={showAddExpense}
        onClose={() => setShowAddExpense(false)}
      />

      {/* Global Add Card Modal */}
      <AddCardModal
        visible={showAddCard}
        onClose={() => setShowAddCard(false)}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 22,
      paddingTop: 10,
      paddingBottom: 12,
      minHeight: 56,
      backgroundColor: colors.background,
      zIndex: 10,
      elevation: 10,
    },
    headerTitle: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 28,
      color: colors.text,
      letterSpacing: 1.5,
    },
    toggleWrapper: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    toggleContainer: {
      position: 'relative',
      flexDirection: 'row',
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.full,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toggleSlidingPill: {
      position: 'absolute',
      top: 3,
      left: 3,
      width: 42,
      height: 30,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.cardBackgroundLight,
    },
    toggleButton: {
      width: 42,
      height: 30,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: BORDER_RADIUS.full,
      zIndex: 1,
    },
    pager: {
      flex: 1,
    },
    pageContainer: {
      flex: 1,
    },
    topGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 56,
      height: 90,
      zIndex: 5,
    },
    bottomGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 140,
      zIndex: 1,
    },
    tabBar: {
      position: 'absolute',
      left: 18,
      right: 18,
      bottom: 10,
      borderRadius: 24,
      backgroundColor: colors.dockBackground,
      borderWidth: 1,
      borderColor: colors.dockBorder,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      overflow: 'hidden',
      zIndex: 10,
    },
    dockEditBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      height: 52,
    },
    dockEditLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    dockCloseBtn: {
      width: 28,
      height: 28,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.dockCloseBtn,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dockCountText: {
      fontFamily: FONTS.ndotCaps || FONTS.system,
      fontSize: 12,
      color: colors.text,
      letterSpacing: 1,
    },
    dockDeleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.primary,
    },
    dockDeleteBtnDisabled: {
      opacity: 0.5,
    },
    dockDeleteText: {
      fontFamily: FONTS.bold,
      fontSize: 11,
      color: colors.primaryText,
      letterSpacing: 0.5,
    },
    dockDeleteTextDisabled: {
      opacity: 0.6,
    },
    dockDivider: {
      backgroundColor: colors.dockBorder,
      marginHorizontal: 16,
    },
    dockTabsRow: {
      height: 64,
      flexDirection: 'row',
    },
    tabBarItem: {
      flex: 1,
      height: 64,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 6,
      paddingBottom: 6,
    },
    tabBarIcon: {
      marginBottom: 0,
    },
    tabBarLabel: {
      fontFamily: FONTS.medium,
      fontSize: 10,
      marginTop: 2,
      marginBottom: 0,
    },
  });
}