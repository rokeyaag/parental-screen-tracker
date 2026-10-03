import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { colors } from './src/theme/colors';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import RulesScreen from './src/screens/RulesScreen';
import TimelineScreen from './src/screens/TimelineScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const TABS = [
  { key: 'home', label: 'ওভারভিউ', icon: '📊' },
  { key: 'rules', label: 'রুলস', icon: '⚙️' },
  { key: 'timeline', label: 'টাইমলাইন', icon: '⏱️' },
  { key: 'alerts', label: 'অ্যালার্ট', icon: '🔔' },
  { key: 'settings', label: 'সেটিংস', icon: '🛠️' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen />;
      case 'rules':
        return <RulesScreen />;
      case 'timeline':
        return <TimelineScreen />;
      case 'alerts':
        return <AlertsScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Active Screen Content */}
      <View style={styles.contentContainer}>
        {renderScreen()}
      </View>

      {/* Sleek Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={styles.navIcon}>{tab.icon}</Text>
              <Text
                style={[
                  styles.navLabel,
                  isActive ? styles.navLabelActive : styles.navLabelInactive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: '#f8fafc',
  },
  navIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  navLabelActive: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  navLabelInactive: {
    color: colors.textSecondary,
  },
});
