import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../theme/colors';
import { api, getApiBaseUrl, setApiBaseUrl } from '../api/client';

export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState(getApiBaseUrl());
  const [studyStart, setStudyStart] = useState('19');
  const [studyEnd, setStudyEnd] = useState('22');
  const [dailyQuota, setDailyQuota] = useState('240');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getDashboard();
      if (data?.settings) {
        setStudyStart(String(data.settings.study_start_hour || '19'));
        setStudyEnd(String(data.settings.study_end_hour || '22'));
        setDailyQuota(String(data.settings.daily_total_limit_minutes || '240'));
      }
    } catch (e) {
      console.warn('Settings load error:', e.message);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setApiBaseUrl(serverUrl.trim());
    try {
      const data = await api.getDashboard();
      Alert.alert('Connected Successfully!', `Server responded: Device ${data.device?.name || 'Online'}`);
    } catch (e) {
      Alert.alert('Connection Failed', `Cannot reach server: ${e.message}\nPlease verify laptop IP (e.g. http://192.168.1.100:8000).`);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await api.updateSettings({
        study_start_hour: parseInt(studyStart, 10),
        study_end_hour: parseInt(studyEnd, 10),
        daily_total_limit_minutes: parseInt(dailyQuota, 10),
      });
      Alert.alert('Success', 'Study schedule and settings updated successfully!');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Schedule & Server Settings</Text>
        <Text style={styles.subTitle}>Mobile App & Backend Configuration</Text>
      </View>

      {/* Backend API Server Connection */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Server Connection (API URL)</Text>
        <Text style={styles.label}>
          Enter your laptop IP or cloud URL to connect over local Wi-Fi or internet:
        </Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="http://192.168.0.100:8000"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.testBtn} onPress={handleTestConnection} disabled={testing}>
          {testing ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.testBtnText}>Test Server</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Study Hours Schedule */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Study Hours Schedule</Text>
        <Text style={styles.label}>Gaming and social apps are automatically blocked during this period.</Text>

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.inputLabel}>Start (Hour: 0-23)</Text>
            <TextInput
              style={styles.input}
              value={studyStart}
              onChangeText={setStudyStart}
              keyboardType="numeric"
              placeholder="19 (7 PM)"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.inputLabel}>End (Hour: 0-23)</Text>
            <TextInput
              style={styles.input}
              value={studyEnd}
              onChangeText={setStudyEnd}
              keyboardType="numeric"
              placeholder="22 (10 PM)"
            />
          </View>
        </View>

        <Text style={styles.inputLabel}>Daily Screen Time Quota (mins)</Text>
        <TextInput
          style={styles.input}
          value={dailyQuota}
          onChangeText={setDailyQuota}
          keyboardType="numeric"
          placeholder="240 (4 hours)"
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.saveBtnText}>Save Settings</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Info Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>System Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Database:</Text>
          <Text style={styles.infoVal}>PostgreSQL 16</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Offline Buffering:</Text>
          <Text style={styles.infoVal}>Active (SQLite Cache)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Windows Client:</Text>
          <Text style={styles.infoVal}>ParentalScreenTracker.exe</Text>
        </View>
      </View>

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
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 10,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
  },
  testBtn: {
    backgroundColor: colors.browsingBg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  saveBtn: {
    backgroundColor: colors.accentYellow,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
