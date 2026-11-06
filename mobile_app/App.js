import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform, LogBox, ActivityIndicator } from 'react-native';
import { colors } from './src/theme/colors';
import { DeviceProvider, useDevices } from './src/context/DeviceContext';

// Ignore non-critical deprecation logs in development
LogBox.ignoreLogs(['SafeAreaView has been deprecated']);

// Screens
import HomeScreen from './src/screens/HomeScreen';
import RulesScreen from './src/screens/RulesScreen';
import TimelineScreen from './src/screens/TimelineScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ChildClientScreen from './src/screens/ChildClientScreen';
import RoleSelectionScreen from './src/screens/RoleSelectionScreen';

const TABS = [
  { key: 'home', label: 'Overview', icon: '📊' },
  { key: 'rules', label: 'Rules', icon: '⚙️' },
  { key: 'timeline', label: 'Timeline', icon: '⏱️' },
  { key: 'alerts', label: 'Alerts', icon: '🔔' },
  { key: 'settings', label: 'Settings', icon: '🛠️' },
];

function MainNavigator() {
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
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Active Screen Content */}
      <View style={styles.contentContainer}>
        {renderScreen()}
      </View>

      {/* Elevated Bottom Navigation Bar with Safe Area Inset */}
      <View style={styles.bottomNav}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.6}
              hitSlop={{ top: 12, bottom: 8, left: 6, right: 6 }}
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
    </View>
  );
}

function RootApp() {
  const { isInitialized, appMode } = useDevices();

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={styles.loadingText}>Initializing Parental Screen Tracker...</Text>
      </View>
    );
  }

  // If no role has been chosen yet, show Role Selection Screen
  if (!appMode) {
    return <RoleSelectionScreen />;
  }

  // If Child Sub-Device mode, render strictly Child Client Screen
  if (appMode === 'sub') {
    return <ChildClientScreen />;
  }

  // Parent Main Controller mode
  return <MainNavigator />;
}

export default function App() {
  return (
    <DeviceProvider>
      <RootApp />
    </DeviceProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
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
    paddingTop: 8,
    // Provide generous bottom clearance on Android so soft navigation buttons never overlap
    paddingBottom: Platform.OS === 'android' ? 42 : (Platform.OS === 'ios' ? 24 : 10),
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 12,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 46,
  },
  navItemActive: {
    backgroundColor: '#f1f5f9',
  },
  navIcon: {
    fontSize: 19,
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 11,
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
