import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AddExpenseScreen from '../../components/screens/AddExpenseScreen';
import { BORDER_RADIUS, COLORS } from '../../theme';

export default function TabsLayout() {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: '#666672',
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarItemStyle: styles.tabBarItem,
          tabBarIconStyle: styles.tabBarIcon,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Início',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={20}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendário',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'calendar' : 'calendar-outline'}
                size={20}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="expenses"
          options={{
            title: 'Despesas',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'pie-chart' : 'pie-chart-outline'}
                size={20}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="statistics"
          options={{
            title: 'Novo',
            tabBarItemStyle: {
              height: 70,
              paddingTop: 0,
              paddingBottom: 0,
              paddingLeft: 0,
              paddingRight: 0,
              margin: 0,
            },
            tabBarButton: () => (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setShowAddModal(true)}
                style={styles.addTabButton}
              >
                <Ionicons name="add" size={32} color="#ffffff" />
              </TouchableOpacity>
            ),
          }}
        />
      </Tabs>

      <Modal visible={showAddModal} animationType="slide" presentationStyle="fullScreen">
        <AddExpenseScreen onClose={() => setShowAddModal(false)} />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 20,  // Âncora esquerda
    right: 20, // Âncora direita (centraliza e define a largura automaticamente)
    height: 70,
    borderRadius: 25,
    backgroundColor: '#15151a',
    borderWidth: 1,
    borderColor: '#262630',
    margin: 30,
    paddingTop: 0,
    paddingBottom: 0,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    overflow: 'hidden',
  },
  tabBarItem: {
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 6,
  },
  tabBarIcon: {
    marginBottom: 0,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 0,
  },
  addTabButton: {
    flex: 1,
    height: 70,
    left: 5,
    alignSelf: 'stretch',
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});