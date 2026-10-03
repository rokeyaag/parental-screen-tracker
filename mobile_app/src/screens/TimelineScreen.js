import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../api/client';

export default function TimelineScreen() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = useCallback(async () => {
    try {
      const data = await api.getDashboard();
      setLogs(data.recent_logs || []);
    } catch (e) {
      console.warn('Error fetching logs:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 6000);
    return () => clearInterval(interval);
  }, [loadLogs]);

  const onRefresh = () => {
    setRefreshing(true);
    loadLogs();
  };

  const renderLog = ({ item }) => (
    <View style={styles.logCard}>
      <View style={styles.logTop}>
        <Text style={styles.logTime}>{item.time_str}</Text>
        <View style={styles.badgeWrap}>
          <Text style={styles.badgeText}>{item.category_name}</Text>
        </View>
      </View>
      <Text style={styles.appName}>{item.app_name}</Text>
      <Text style={styles.windowTitle} numberOfLines={2}>
        {item.window_title}
      </Text>
      <View style={styles.durationRow}>
        <Text style={styles.processName}>{item.process_name}</Text>
        <Text style={styles.durationBadge}>+{item.duration_seconds}s</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Activity Timeline</Text>
        <Text style={styles.subTitle}>Detailed chronological log of opened windows and apps</Text>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={colors.accentYellow} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderLog}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accentYellow]} />
          }
          contentContainerStyle={{ paddingBottom: 30 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  header: {
    marginBottom: 16,
    paddingTop: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logTime: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  badgeWrap: {
    backgroundColor: colors.browsingBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.browsingText,
  },
  appName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  windowTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  processName: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  durationBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentYellowDark,
    backgroundColor: colors.accentYellowLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
