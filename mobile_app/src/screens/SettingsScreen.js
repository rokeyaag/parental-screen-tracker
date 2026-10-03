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
      Alert.alert('সংযুক্ত সফল!', `সার্ভার রেসপন্স করেছে: ডিভাইস ${data.device?.name || 'অনলাইন'}`);
    } catch (e) {
      Alert.alert('কানেকশন ব্যর্থ', `সার্ভারে পৌঁছানো যায়নি: ${e.message}\nল্যাপটপের আইপি (যেমন http://192.168.1.100:8000) সঠিক কিনা চেক করুন।`);
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
      Alert.alert('সফল', 'পড়ার শিডিউল ও সেটিংস সফলভাবে আপডেট হয়েছে!');
    } catch (e) {
      Alert.alert('ত্রুটি', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>শিডিউল ও সার্ভার সেটিংস</Text>
        <Text style={styles.subTitle}>মোবাইল অ্যাপ ও ড্যাশবোর্ড ব্যাকএন্ড কনফিগারেশন</Text>
      </View>

      {/* Backend API Server Connection */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>সার্ভার কানেকশন (API URL)</Text>
        <Text style={styles.label}>
          একই ওয়াইফাই বা ইন্টারনেটের মাধ্যমে ড্যাশবোর্ড অ্যাক্সেস করতে ল্যাপটপের আইপি বা ক্লাউড ইউআরএল দিন:
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
            <Text style={styles.testBtnText}>সার্ভার টেস্ট করুন</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Study Hours Schedule */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>পড়ার সময় নির্ধারণ (Study Hours)</Text>
        <Text style={styles.label}>এই সময়ের মধ্যে গেম ও সোশ্যাল অ্যাপ স্বয়ংক্রিয়ভাবে ব্লক থাকবে।</Text>

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.inputLabel}>শুরু (ঘণ্টা: 0-23)</Text>
            <TextInput
              style={styles.input}
              value={studyStart}
              onChangeText={setStudyStart}
              keyboardType="numeric"
              placeholder="19 (7 PM)"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.inputLabel}>শেষ (ঘণ্টা: 0-23)</Text>
            <TextInput
              style={styles.input}
              value={studyEnd}
              onChangeText={setStudyEnd}
              keyboardType="numeric"
              placeholder="22 (10 PM)"
            />
          </View>
        </View>

        <Text style={styles.inputLabel}>দৈনিক মোট স্ক্রিন টাইম কোটা (মিনিট)</Text>
        <TextInput
          style={styles.input}
          value={dailyQuota}
          onChangeText={setDailyQuota}
          keyboardType="numeric"
          placeholder="240 (4 ঘণ্টা)"
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.saveBtnText}>সেটিংস সংরক্ষণ করুন</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Info Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>সিস্টেম তথ্য</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>ডাটাবেস:</Text>
          <Text style={styles.infoVal}>PostgreSQL 16</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>অফলাইন বাফারিং:</Text>
          <Text style={styles.infoVal}>সক্রিয় (SQLite Cache)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>উইন্ডোজ ক্লায়েন্ট:</Text>
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
