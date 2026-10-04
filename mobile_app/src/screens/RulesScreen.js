import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../api/client';

export default function RulesScreen() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // New Rule Form State
  const [friendlyName, setFriendlyName] = useState('');
  const [processName, setProcessName] = useState('');
  const [categoryName, setCategoryName] = useState('Gaming');
  const [limitMins, setLimitMins] = useState('45');
  const [isBlocked, setIsBlocked] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      const data = await api.getDashboard();
      setRules(data.rules || []);
    } catch (e) {
      console.log('Error fetching rules:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleToggleBlock = async (rule, value) => {
    try {
      await api.saveRule({
        process_name: rule.process_name,
        friendly_name: rule.friendly_name,
        category_name: rule.category_name,
        daily_limit_minutes: rule.daily_limit_minutes,
        is_blocked: value,
      });
      loadRules();
    } catch (e) {
      Alert.alert('Error', 'Failed to save changes: ' + e.message);
    }
  };

  const handleDeleteRule = (pname) => {
    Alert.alert('Delete Rule', `Delete the rule for '${pname}'?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteRule(pname);
            loadRules();
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleCreateRule = async () => {
    if (!processName.trim()) {
      Alert.alert('Warning', 'Process file name (.exe) is required');
      return;
    }
    setSaving(true);
    try {
      await api.saveRule({
        process_name: processName.trim().toLowerCase(),
        friendly_name: friendlyName.trim() || processName.trim(),
        category_name: categoryName,
        daily_limit_minutes: parseInt(limitMins, 10) || 0,
        is_blocked: isBlocked,
      });
      setModalVisible(false);
      setProcessName('');
      setFriendlyName('');
      setLimitMins('45');
      setIsBlocked(false);
      loadRules();
      Alert.alert('Success', 'App rule saved successfully!');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.ruleCard}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.appName}>{item.friendly_name}</Text>
          <Text style={styles.processCode}>{item.process_name}</Text>
        </View>
        <View
          style={[
            styles.catBadge,
            item.category_name === 'Gaming' ? styles.catGaming : styles.catOther,
          ]}
        >
          <Text
            style={[
              styles.catText,
              item.category_name === 'Gaming' ? styles.catTextGaming : styles.catTextOther,
            ]}
          >
            {item.category_name}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.limitLabel}>Daily Time Limit</Text>
          <Text style={styles.limitValue}>
            {item.daily_limit_minutes > 0 ? `${item.daily_limit_minutes} mins` : 'Unlimited'}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <View style={styles.switchWrapper}>
            <Text style={styles.blockLabel}>Block:</Text>
            <Switch
              value={item.is_blocked}
              onValueChange={(val) => handleToggleBlock(item, val)}
              trackColor={{ false: '#e2e8f0', true: colors.accentRed }}
              thumbColor={item.is_blocked ? '#ffffff' : '#f8fafc'}
            />
          </View>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDeleteRule(item.process_name)}
          >
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header + Add button */}
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>App & Game Rules ({rules.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ Add Rule</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accentYellow} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rules}
          keyExtractor={(item) => item.process_name}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 30 }}
        />
      )}

      {/* Add New Rule Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add New Rule</Text>

            <Text style={styles.inputLabel}>App / Game Friendly Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Roblox or Minecraft"
              value={friendlyName}
              onChangeText={setFriendlyName}
            />

            <Text style={styles.inputLabel}>Process File Name (.exe)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., robloxplayerbeta.exe"
              value={processName}
              onChangeText={setProcessName}
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Daily Time Limit (mins)</Text>
            <TextInput
              style={styles.input}
              placeholder="45"
              keyboardType="numeric"
              value={limitMins}
              onChangeText={setLimitMins}
            />

            <View style={styles.modalSwitchRow}>
              <Text style={styles.inputLabel}>Permanently Block App</Text>
              <Switch
                value={isBlocked}
                onValueChange={setIsBlocked}
                trackColor={{ false: '#e2e8f0', true: colors.accentRed }}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCreateRule}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Rule</Text>
                )}
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
    backgroundColor: colors.background,
    padding: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 8,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  addBtn: {
    backgroundColor: colors.accentYellow,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    fontWeight: '800',
    fontSize: 12,
    color: '#000000',
  },
  ruleCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  appName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  processCode: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  catGaming: {
    backgroundColor: colors.gamingBg,
  },
  catOther: {
    backgroundColor: colors.otherBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catText: {
    fontSize: 10,
    fontWeight: '700',
  },
  catTextGaming: {
    color: colors.gamingText,
  },
  catTextOther: {
    color: colors.otherText,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  limitLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  limitValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  blockLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  deleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#fee2e2',
  },
  deleteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentRed,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 12,
    color: colors.textPrimary,
  },
  modalSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.accentYellow,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    fontWeight: '800',
    color: '#000000',
  },
});
