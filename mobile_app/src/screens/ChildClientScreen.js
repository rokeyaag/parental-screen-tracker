import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../api/client';
import { useDevices } from '../context/DeviceContext';

export default function ChildClientScreen() {
  const {
    subDeviceToken,
    setSubDeviceToken,
    subDeviceName,
    setSubDeviceName,
    subChildName,
    setSubChildName,
    setAppMode,
  } = useDevices();

  const [pairingCode, setPairingCode] = useState('');
  const [phoneName, setPhoneName] = useState(subDeviceName || 'Galaxy A16');
  const [childName, setChildName] = useState(subChildName || 'Shajidur Rahman');
  const [pairingLoading, setPairingLoading] = useState(false);

  // Status & Lock state
  const [isLocked, setIsLocked] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('');
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');

  // Handle pairing with 6-digit code
  const handlePair = async () => {
    if (!pairingCode.trim()) {
      Alert.alert('Required', 'Please enter the 6-digit code from your parent Main Controller.');
      return;
    }
    setPairingLoading(true);
    try {
      const res = await api.pairDevice(pairingCode.trim(), 'Mobile-UUID-' + Date.now(), 'Android');
      if (res.success && res.device) {
        await setSubDeviceToken(res.device.device_token || 'paired');
        await setSubDeviceName(res.device.device_name || phoneName);
        await setSubChildName(res.device.assigned_child || childName);
        Alert.alert('Success (সফল)', `This mobile is now linked to the Main Controller as '${res.device.device_name}'!`);
      } else {
        Alert.alert('Pairing Failed', 'Invalid or expired code. Please generate a fresh code from the Main Controller.');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setPairingLoading(false);
    }
  };

  // Direct quick link for Galaxy A16 (device ID 214)
  const handleQuickLinkGalaxyA16 = async () => {
    setPairingLoading(true);
    try {
      await setSubDeviceToken('ce7de6027cd8eb0544dae0f712c52a80bf464f7c');
      await setSubDeviceName('Galaxy A16');
      await setSubChildName('Shajidur Rahman');
      Alert.alert('Success (সফল)', 'Galaxy A16 (Shajidur Rahman) এর সাথে সরাসরি যুক্ত করা হয়েছে!');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setPairingLoading(false);
    }
  };

  // Heartbeat loop for sub-mobile (rapid 3.5s poll for instant lock response)
  useEffect(() => {
    if (!subDeviceToken) return;

    let mounted = true;
    const sendBeat = async () => {
      try {
        const currentApp = isLocked
          ? 'Screen Locked by Parent'
          : studyMode
          ? 'Study Mode Profile'
          : 'Mobile Screen Active';
        const res = await api.sendSubHeartbeat(subDeviceToken, currentApp, 4, true);
        if (mounted && res) {
          setIsLocked(!!res.emergency_lock);
          setStudyMode(!!res.study_mode_active);
          setLastSyncTime(new Date().toLocaleTimeString());
        }
      } catch (err) {
        // silent sync retry
      }
    };

    sendBeat();
    const timer = setInterval(sendBeat, 3500); // 3.5s rapid heartbeat
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [subDeviceToken, isLocked, studyMode]);

  // Handle Parent PIN validation to exit sub-mode
  const handleVerifyPin = async () => {
    if (enteredPin === '1234') {
      setPinModalVisible(false);
      setEnteredPin('');
      await setAppMode('master');
      Alert.alert('Switched (পরিবর্তিত)', 'You are now back in Main Controller mode.');
    } else {
      Alert.alert('Incorrect PIN', 'Please enter the correct Parent PIN (Default: 1234).');
      setEnteredPin('');
    }
  };

  // If Emergency Lock is active, show full-screen lock
  if (isLocked) {
    return (
      <View style={styles.lockScreenContainer}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockTitle}>DEVICE LOCKED BY PARENT</Text>
        <Text style={styles.lockSubTitle}>প্যারেন্টাল লক সক্রিয়</Text>
        <View style={styles.lockCard}>
          <Text style={styles.lockMessage}>
            Your parent has temporarily paused screen access on this device.
            {'\n\n'}
            আপনার অভিভাবক এই মোবাইলের ব্যবহার সাময়িকভাবে বন্ধ রেখেছেন। পড়াশোনায় মনোযোগ দিন।
          </Text>
        </View>
        <Text style={styles.lockNotice}>
          Monitoring Active • Device: {subDeviceName || phoneName} • Sync: {lastSyncTime || 'Live'}
        </Text>
        <TouchableOpacity
          style={styles.unlockPinBtn}
          onPress={() => setPinModalVisible(true)}
        >
          <Text style={styles.unlockPinBtnText}>Parent Unlock (অভিভাবক আনলক)</Text>
        </TouchableOpacity>

        {/* PIN Modal */}
        <Modal
          visible={pinModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPinModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.pinModalBox}>
              <Text style={styles.pinModalTitle}>Enter Parent PIN</Text>
              <TextInput
                style={styles.pinInput}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                value={enteredPin}
                onChangeText={setEnteredPin}
                placeholder="****"
                placeholderTextColor="#999"
              />
              <View style={styles.pinBtnRow}>
                <TouchableOpacity style={styles.pinCancelBtn} onPress={() => setPinModalVisible(false)}>
                  <Text style={styles.pinCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pinSubmitBtn} onPress={handleVerifyPin}>
                  <Text style={styles.pinSubmitText}>Unlock</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // If Not Paired: Pairing Screen
  if (!subDeviceToken) {
    return (
      <ScrollView contentContainerStyle={styles.containerScroll}>
        <View style={styles.header}>
          <Text style={styles.headerBadge}>📱 SUB-DEVICE (CHILD CLIENT)</Text>
          <Text style={styles.headerTitle}>Connect Child Mobile</Text>
          <Text style={styles.headerSub}>
            এই ফোনটি সন্তানের অভিভাবকের মূল অ্যাপের সাথে কানেক্ট করুন।
          </Text>
        </View>

        {/* Quick Connect for Registered Galaxy A16 */}
        <TouchableOpacity
          style={styles.quickConnectCard}
          activeOpacity={0.8}
          onPress={handleQuickLinkGalaxyA16}
          disabled={pairingLoading}
        >
          <View style={styles.quickConnectIconCircle}>
            <Text style={{ fontSize: 24 }}>⚡</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.quickConnectTitle}>সরাসরি যুক্ত করুন: Galaxy A16</Text>
            <Text style={styles.quickConnectSub}>শিশু: Shajidur Rahman (রেজিস্টার্ড সাব-ডিভাইস)</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>অথবা নতুন কোড দিন (OR NEW CODE)</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.card}>
          <Text style={styles.stepTitle}>অভিভাবকের ফোন থেকে ৬ ডিজিটের কোড দিন</Text>
          <Text style={styles.stepDesc}>
            অভিভাবকের ফোনে "+ Add Sub" ট্যাপ করে জেনারেট করা ৬ ডিজিটের পেয়ারিং কোড নিচে লিখুন:
          </Text>

          <Text style={styles.inputLabel}>6-Digit Pairing Code (পেয়ারিং কোড):</Text>
          <TextInput
            style={styles.codeInput}
            placeholder="e.g. 582194"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            maxLength={6}
            value={pairingCode}
            onChangeText={setPairingCode}
          />

          <TouchableOpacity
            style={[styles.pairBtn, pairingLoading && { opacity: 0.6 }]}
            onPress={handlePair}
            disabled={pairingLoading}
          >
            {pairingLoading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.pairBtnText}>Connect as Sub-Device (কানেক্ট করুন)</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.switchBackBtn}
          onPress={() => setAppMode('master')}
        >
          <Text style={styles.switchBackText}>← Back to Main Controller (মেইন কন্ট্রোলার)</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Paired Active Sub-Device Dashboard (No Parent Controls, Clean Protection State)
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerBadge}>📱 SUB-DEVICE ACTIVE</Text>
        <Text style={styles.headerTitle}>{subDeviceName || phoneName}</Text>
        <Text style={styles.headerSub}>
          Controlled by Parent • Assigned to: {subChildName || childName}
        </Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusDotGreen} />
          <Text style={styles.statusTextGreen}>Connected to Parent Main Controller</Text>
        </View>
        <Text style={styles.syncText}>Last heartbeat: {lastSyncTime || 'Syncing...'}</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Sub-Device Protection Active</Text>
        <Text style={styles.infoText}>
          ✓ Screen time tracking active{'\n'}
          ✓ Remote Emergency Lock ready{'\n'}
          ✓ Study Mode status: {studyMode ? '🟢 Active' : '⚪ Standby'}{'\n'}
          ✓ Background protection running
        </Text>
      </View>

      <View style={styles.cleanNoteBox}>
        <Text style={styles.cleanNoteText}>
          🛡️ অভিভাবক কন্ট্রোল সক্রিয় রয়েছে। এই ডিভাইসে কোনো নিয়ন্ত্রণ বাটন নেই।
        </Text>
      </View>

      <TouchableOpacity
        style={styles.exitSubBtn}
        onPress={() => setPinModalVisible(true)}
      >
        <Text style={styles.exitSubBtnText}>⚙️ Exit Sub-Device Mode (Parent PIN Required)</Text>
      </TouchableOpacity>

      {/* PIN Modal to exit Sub mode */}
      <Modal
        visible={pinModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pinModalBox}>
            <Text style={styles.pinModalTitle}>Enter Parent PIN</Text>
            <Text style={styles.pinModalSub}>To exit Sub-Device mode, enter Parent PIN:</Text>
            <TextInput
              style={styles.pinInput}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              value={enteredPin}
              onChangeText={setEnteredPin}
              placeholder="****"
              placeholderTextColor="#999"
            />
            <View style={styles.pinBtnRow}>
              <TouchableOpacity style={styles.pinCancelBtn} onPress={() => setPinModalVisible(false)}>
                <Text style={styles.pinCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pinSubmitBtn} onPress={handleVerifyPin}>
                <Text style={styles.pinSubmitText}>Verify & Exit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 24,
    justifyContent: 'center',
  },
  containerScroll: {
    padding: 24,
    paddingVertical: 48,
    backgroundColor: '#0f172a',
    minHeight: '100%',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: '#38bdf8',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
  quickConnectCard: {
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#38bdf8',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  quickConnectIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickConnectTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  quickConnectSub: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    marginHorizontal: 10,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 6,
  },
  stepDesc: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 19,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  codeInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    borderRadius: 12,
    color: '#38bdf8',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 12,
    marginBottom: 18,
  },
  pairBtn: {
    backgroundColor: '#38bdf8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  pairBtnText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 15,
  },
  switchBackBtn: {
    marginTop: 24,
    alignItems: 'center',
    padding: 12,
  },
  switchBackText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  statusCard: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    marginRight: 8,
  },
  statusTextGreen: {
    color: '#22c55e',
    fontWeight: '700',
    fontSize: 14,
  },
  syncText: {
    color: '#94a3b8',
    fontSize: 12,
    marginLeft: 18,
  },
  infoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoCardTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 10,
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 22,
  },
  cleanNoteBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  cleanNoteText: {
    color: '#7dd3fc',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  exitSubBtn: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  exitSubBtnText: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '600',
  },
  // Emergency Lock Fullscreen styles
  lockScreenContainer: {
    flex: 1,
    backgroundColor: '#b91c1c',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  lockIcon: {
    fontSize: 72,
    marginBottom: 12,
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
    textAlign: 'center',
  },
  lockSubTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fef08a',
    marginTop: 4,
    marginBottom: 20,
  },
  lockCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 24,
  },
  lockMessage: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    fontWeight: '600',
  },
  lockNotice: {
    color: '#fecaca',
    fontSize: 12,
    marginBottom: 24,
    textAlign: 'center',
  },
  unlockPinBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
  },
  unlockPinBtnText: {
    color: '#b91c1c',
    fontWeight: '800',
    fontSize: 14,
  },
  // Modal PIN styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pinModalBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  pinModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  pinModalSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  pinInput: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    width: 140,
    paddingVertical: 10,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    color: '#0f172a',
    letterSpacing: 8,
    marginBottom: 20,
  },
  pinBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  pinCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  pinCancelText: {
    color: '#475569',
    fontWeight: '700',
  },
  pinSubmitBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0284c7',
    alignItems: 'center',
  },
  pinSubmitText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
