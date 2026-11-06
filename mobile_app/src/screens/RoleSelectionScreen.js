import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { colors } from '../theme/colors';
import { useDevices } from '../context/DeviceContext';

export default function RoleSelectionScreen() {
  const { setAppMode } = useDevices();

  const handleSelectRole = (mode) => {
    setAppMode(mode);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>🛡️</Text>
          </View>
          <Text style={styles.title}>Parental Screen Tracker</Text>
          <Text style={styles.subtitle}>
            ডিভাইসের ভূমিকা নির্বাচন করুন{'\n'}
            <Text style={styles.subEnglish}>Select How This Device Will Be Used</Text>
          </Text>
        </View>

        {/* Option 1: Parent Main Controller */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.roleIconCircle, { backgroundColor: '#fef3c7' }]}>
              <Text style={styles.roleEmoji}>👑</Text>
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.roleTitle}>Main Controller (অভিভাবক)</Text>
              <Text style={styles.roleSub}>Parent Admin Device</Text>
            </View>
          </View>

          <Text style={styles.roleDesc}>
            এই ফোন দিয়ে আপনি সন্তানের সকল ডিভাইস (ল্যাপটপ, মোবাইল) মনিটর করবেন, লাইভ স্ক্রিন দেখবেন, রুলস সেট করবেন এবং দূর থেকেই জরুরি লক করতে পারবেন।
          </Text>

          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>✓ সন্তানের লাইভ স্ক্রিন ও টাইমলাইন মনিটরিং</Text>
            <Text style={styles.bulletItem}>✓ এক ক্লিকে রিমোট স্ক্রিন লক ও স্টাডি মোড</Text>
            <Text style={styles.bulletItem}>✓ নতুন সাব-ডিভাইস যোগ ও রুলস নিয়ন্ত্রণ</Text>
          </View>

          <TouchableOpacity
            style={styles.parentBtn}
            activeOpacity={0.8}
            onPress={() => handleSelectRole('master')}
          >
            <Text style={styles.parentBtnText}>অভিভাবক কন্ট্রোলার হিসেবে শুরু করুন  👑</Text>
          </TouchableOpacity>
        </View>

        {/* Option 2: Child Sub-Device */}
        <View style={[styles.card, styles.childCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.roleIconCircle, { backgroundColor: '#e0f2fe' }]}>
              <Text style={styles.roleEmoji}>📱</Text>
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.roleTitle}>Child Sub-Device (সন্তানের ফোন)</Text>
              <Text style={styles.roleSub}>Galaxy A16 / Monitored Phone</Text>
            </View>
          </View>

          <Text style={styles.roleDesc}>
            এই মোবাইলটি সন্তানের ব্যবহারের জন্য সেট হবে। এই ফোনে কোনো কন্ট্রোল বাটন (+ Add Sub, Lock Screen, Rules) থাকবে না। এটি শুধুমাত্র অভিভাবকের ফোন থেকে নিয়ন্ত্রিত হবে।
          </Text>

          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>🛡️ কোনো কন্ট্রোল বাটন থাকবে না (সম্পূর্ণ সুরক্ষিত)</Text>
            <Text style={styles.bulletItem}>🛡️ অভিভাবক লক করলে মোবাইল স্ক্রিন লক হয়ে যাবে</Text>
            <Text style={styles.bulletItem}>🛡️ স্বয়ংক্রিয় লাইভ স্ট্যাটাস অভিভাবকদের ফোনে পৌঁছাবে</Text>
          </View>

          <TouchableOpacity
            style={styles.childBtn}
            activeOpacity={0.8}
            onPress={() => handleSelectRole('sub')}
          >
            <Text style={styles.childBtnText}>সন্তানের মোবাইল হিসেবে লক করুন  📱</Text>
          </TouchableOpacity>
        </View>

        {/* Footer Note */}
        <View style={styles.footerNote}>
          <Text style={styles.footerNoteText}>
            🔒 পরবর্তী সময়ে মোড পরিবর্তন করতে হলে অভিভাবকের গোপন পিন (Default: 1234) প্রয়োজন হবে।
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginVertical: 16,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  logoIcon: {
    fontSize: 34,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 22,
  },
  subEnglish: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  childCard: {
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  roleEmoji: {
    fontSize: 24,
  },
  cardHeaderText: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  roleSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  roleDesc: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 14,
  },
  bulletList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 6,
  },
  bulletItem: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: 18,
  },
  parentBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  parentBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  childBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  childBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  footerNote: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  footerNoteText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '500',
  },
});
