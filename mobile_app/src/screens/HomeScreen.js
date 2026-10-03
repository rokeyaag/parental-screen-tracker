import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../api/client';

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      console.warn('Load Error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // 5s live poll
    return () => clearInterval(interval);
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleStudyToggle = async () => {
    setActionLoading(true);
    try {
      const res = await api.toggleStudyMode();
      Alert.alert(
        'Study Mode',
        res.study_mode_active ? 'Study Mode activated!' : 'Study Mode disabled.'
      );
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to send command: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLockToggle = async () => {
    setActionLoading(true);
    try {
      const res = await api.toggleEmergencyLock();
      Alert.alert(
        'Emergency Lock',
        res.emergency_lock ? 'Laptop screen locked!' : 'Laptop unlocked.'
      );
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to send command: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accentYellow} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  const device = data?.device || {};
  const summary = data?.summary || {};
  const settings = data?.settings || {};
  const apps = data?.apps || [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accentYellow]} />
      }
    >
      {/* Header Info */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Parental Monitor</Text>
          <Text style={styles.headerSub}>
            Device: {device.name} • {device.assigned_child}
          </Text>
        </View>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: device.online ? '#ecfdf5' : '#fef2f2', borderColor: device.online ? '#a7f3d0' : '#fecaca' }
          ]}
        >
          <View
            style={[
              styles.dot,
              { backgroundColor: device.online ? colors.onlineGreen : colors.offlineRed }
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: device.online ? colors.onlineGreen : colors.offlineRed }
            ]}
          >
            {device.online ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Live Active App Ticker */}
      <View style={styles.liveCard}>
        <View style={styles.liveHeaderRow}>
          <Text style={styles.liveLabel}>Currently Active Application</Text>
          <View style={styles.badgeBrowsing}>
            <Text style={styles.badgeBrowsingText}>{device.current_category}</Text>
          </View>
        </View>
        <Text style={styles.liveAppName}>{device.current_app}</Text>
        {device.current_title ? (
          <Text style={styles.liveAppTitle} numberOfLines={1}>
            {device.current_title}
          </Text>
        ) : null}
      </View>

      {/* Emergency & Study Mode Quick Controls */}
      <View style={styles.quickControlsRow}>
        <TouchableOpacity
          style={[
            styles.controlBtn,
            settings.study_mode_active ? styles.btnYellowActive : styles.btnYellowOutline
          ]}
          onPress={handleStudyToggle}
          disabled={actionLoading}
        >
          <Text
            style={[
              styles.controlBtnText,
              { color: settings.study_mode_active ? '#000000' : colors.accentYellowDark }
            ]}
          >
            {settings.study_mode_active ? 'Study Mode: Active' : 'Study Mode: Off'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlBtn,
            settings.emergency_lock ? styles.btnRedActive : styles.btnRedOutline
          ]}
          onPress={handleLockToggle}
          disabled={actionLoading}
        >
          <Text
            style={[
              styles.controlBtnText,
              { color: settings.emergency_lock ? '#ffffff' : colors.accentRed }
            ]}
          >
            {settings.emergency_lock ? 'Lock: Active' : 'Lock Screen'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Metric Cards Grid */}
      <View style={styles.metricsGrid}>
        {/* Total Screen Time */}
        <View style={[styles.metricCard, styles.borderWhite]}>
          <Text style={styles.metricLabel}>Today's Total Time</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
            {summary.total_formatted}
          </Text>
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${summary.total_pct}%`, backgroundColor: colors.accentYellow }
              ]}
            />
          </View>
          <Text style={styles.metricSub}>Limit: {summary.daily_limit_mins} mins ({summary.total_pct}%)</Text>
        </View>

        {/* Gaming Time */}
        <View style={[styles.metricCard, styles.borderRed]}>
          <Text style={styles.metricLabel}>Gaming Usage</Text>
          <Text style={[styles.metricValue, { color: colors.accentRed }]}>
            {summary.gaming_formatted}
          </Text>
          <Text style={styles.metricSub}>Auto-block on limit</Text>
        </View>

        {/* Study Time */}
        <View style={[styles.metricCard, styles.borderYellow]}>
          <Text style={styles.metricLabel}>Study & Productivity</Text>
          <Text style={[styles.metricValue, { color: colors.accentYellowDark }]}>
            {summary.study_formatted}
          </Text>
          <Text style={styles.metricSub}>VS Code, Zoom, Docs</Text>
        </View>

        {/* Browsing Time */}
        <View style={[styles.metricCard, styles.borderWhite]}>
          <Text style={styles.metricLabel}>Browsing & Media</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
            {summary.browsing_formatted}
          </Text>
          <Text style={styles.metricSub}>Chrome, YouTube</Text>
        </View>
      </View>

      {/* Today's App Breakdown List */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Active Applications ({apps.length})</Text>
      </View>

      {apps.map((app, index) => (
        <View key={index} style={styles.appRowCard}>
          <View style={styles.appRowLeft}>
            <Text style={styles.appRowName}>{app.name}</Text>
            <Text style={styles.appRowProcess}>{app.process_name}</Text>
          </View>
          <View style={styles.appRowRight}>
            <Text style={styles.appRowTime}>{app.time_formatted}</Text>
            {app.limit_mins > 0 ? (
              <Text style={[styles.appRowLimit, app.pct >= 100 && { color: colors.accentRed }]}>
                {app.pct}% / {app.limit_mins} mins
              </Text>
            ) : (
              <Text style={styles.appRowLimit}>Unlimited</Text>
            )}
          </View>
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  liveCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.accentYellow,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  liveHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  liveLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  liveAppName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  liveAppTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badgeBrowsing: {
    backgroundColor: colors.browsingBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeBrowsingText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.browsingText,
  },
  quickControlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  controlBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnYellowActive: {
    backgroundColor: colors.accentYellow,
    borderWidth: 1.5,
    borderColor: colors.accentYellow,
  },
  btnYellowOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.accentYellow,
  },
  btnRedActive: {
    backgroundColor: colors.accentRed,
    borderWidth: 1.5,
    borderColor: colors.accentRed,
  },
  btnRedOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.accentRed,
  },
  controlBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  borderWhite: {
    borderTopWidth: 3,
    borderTopColor: colors.accentBlack,
  },
  borderRed: {
    borderTopWidth: 3,
    borderTopColor: colors.accentRed,
  },
  borderYellow: {
    borderTopWidth: 3,
    borderTopColor: colors.accentYellow,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  metricSub: {
    fontSize: 10,
    color: colors.textMuted,
  },
  progressContainer: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginVertical: 6,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  appRowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appRowLeft: {
    flex: 1,
  },
  appRowName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  appRowProcess: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  appRowRight: {
    alignItems: 'flex-end',
  },
  appRowTime: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  appRowLimit: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
