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

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await api.getDashboard();
      setAlerts(data.recent_alerts || []);
    } catch (e) {
      console.warn('Error fetching alerts:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 8000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAlerts();
  };

  const getBadgeStyle = (type) => {
    switch (type) {
      case 'limit_warning':
        return { bg: colors.accentYellowLight, text: colors.accentYellowDark, label: '৫ মিনিট বাকি' };
      case 'limit_exceeded':
        return { bg: colors.accentRedLight, text: colors.accentRed, label: 'সময় শেষ' };
      case 'study_mode_block':
        return { bg: colors.accentYellowLight, text: colors.accentYellowDark, label: 'পড়ার সময়' };
      case 'emergency_lock':
        return { bg: colors.accentRed, text: '#ffffff', label: 'প্যারেন্ট লক' };
      default:
        return { bg: colors.browsingBg, text: colors.textSecondary, label: type };
    }
  };

  const renderAlert = ({ item }) => {
    const badge = getBadgeStyle(item.alert_type);
    return (
      <View style={styles.alertCard}>
        <View style={styles.alertHeader}>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
          <Text style={styles.timeText}>
            {item.date_str} {item.time_str}
          </Text>
        </View>

        <Text style={styles.messageText}>{item.message}</Text>
        <Text style={styles.processCode}>{item.process_name}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>সতর্কতা ও ভায়োলেশন হিস্ট্রি</Text>
        <Text style={styles.subTitle}>বাচ্চার স্ক্রিনে পাঠানো সতর্কতা ও অ্যাপ ব্লকিং বার্তা</Text>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={colors.accentYellow} style={{ marginTop: 40 }} />
      ) : alerts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>কোনো ভায়োলেশন নেই</Text>
          <Text style={styles.emptySub}>সব অ্যাপ নিয়ম অনুযায়ী চলছে।</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderAlert}
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
  alertCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  messageText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 18,
  },
  processCode: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'monospace',
    marginTop: 6,
  },
  emptyContainer: {
    marginTop: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
