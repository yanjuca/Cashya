import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
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
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';

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
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [isCalendarSwiping, setIsCalendarSwiping] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [isTransactionsEditMode, setIsTransactionsEditMode] = useState(false);
  const [isHomeEditMode, setIsHomeEditMode] = useState(false);

  const toggleOpacity = useRef(new Animated.Value(0)).current;

  const isAnyEditMode = isHomeEditMode || isTransactionsEditMode;

  // FAB should only be visible on Home (0) and Transactions (1) and when not in edit mode
  const isFabVisible = (currentPage === 0 || currentPage === 1) && !isAnyEditMode;

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

  const handleTabPress = (index: number) => {
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

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
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
              onPress={() => handleViewModeChange('list')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="list"
                size={18}
                color={viewMode === 'list' ? '#ffffff' : COLORS.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleButton, viewMode === 'calendar' && styles.toggleButtonActive]}
              onPress={() => handleViewModeChange('calendar')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="calendar"
                size={18}
                color={viewMode === 'calendar' ? '#ffffff' : COLORS.textSecondary}
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
        scrollEnabled={!isCalendarSwiping}
      >
        <View key="home" style={styles.pageContainer}>
          <WalletHomeScreen
            onScroll={(e) => handleScroll(0, e.nativeEvent.contentOffset.y)}
            onEditModeChange={setIsHomeEditMode}
          />
        </View>

        <View key="transactions" style={styles.pageContainer}>
          <TransactionsScreen
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onCalendarGestureActive={setIsCalendarSwiping}
            onScroll={(e) => handleScroll(1, e.nativeEvent.contentOffset.y)}
            onEditModeChange={setIsTransactionsEditMode}
          />
        </View>

        <View key="statistics" style={styles.pageContainer}>
          <StatisticsTabScreen onScroll={(e) => handleScroll(2, e.nativeEvent.contentOffset.y)} />
        </View>

        <View key="settings" style={styles.pageContainer}>
          <SettingsScreen onScroll={(e) => handleScroll(3, e.nativeEvent.contentOffset.y)} />
        </View>
      </PagerView>

      {/* Top Gradient Fade Overlay (soft fade beneath header only when scrolled, hidden in edit mode) */}
      {!isAnyEditMode && (
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
            colors={['#000000', 'rgba(0, 0, 0, 0.85)', 'rgba(0, 0, 0, 0.4)', 'transparent']}
            locations={[0, 0.3, 0.65, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </Animated.View>
      )}

      {/* Bottom Gradient Fade Overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.85)', '#000000']}
        locations={[0, 0.35, 0.7, 1]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Floating Bottom Navigation Bar (higher zIndex so FAB slides behind it) */}
      <View style={styles.tabBar}>
        {TABS.map((tab, index) => {
          const focused = currentPage === index;
          const color = focused ? COLORS.primary : '#666672';
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
      <Modal visible={showAddExpense} animationType="slide" presentationStyle="fullScreen">
        <AddExpenseScreen onClose={() => setShowAddExpense(false)} />
      </Modal>

      {/* Global Add Card Modal */}
      <AddCardModal
        visible={showAddCard}
        onClose={() => setShowAddCard(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 12,
    minHeight: 56,
    backgroundColor: '#000000',
    zIndex: 10,
    elevation: 10,
  },
  headerTitle: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 28,
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  toggleWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#16161c',
    borderRadius: BORDER_RADIUS.full,
    padding: 3,
    borderWidth: 1,
    borderColor: '#262630',
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  toggleButtonActive: {
    backgroundColor: '#262630',
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
    height: 150,
    zIndex: 5,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 250,
    zIndex: 1,
  },
  tabBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 10,
    height: 64,
    borderRadius: 24,
    backgroundColor: '#15151a',
    borderWidth: 1,
    borderColor: '#262630',
    flexDirection: 'row',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    overflow: 'hidden',
    zIndex: 10,
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