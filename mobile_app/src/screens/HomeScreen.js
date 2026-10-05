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
  Image,
  Modal,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../api/client';

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [capturingScreen, setCapturingScreen] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [screenshotModalVisible, setScreenshotModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      console.log('Load Error:', err.message);
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

  const handleRequestScreenshot = async () => {
    setCapturingScreen(true);
    try {
      await api.requestScreenshot();
      Alert.alert('Capture Dispatched', 'Taking live screenshot on child PC in ~3 seconds.');
      setTimeout(loadData, 3500);
      setTimeout(loadData, 7000);
    } catch (e) {
      Alert.alert('Error', 'Failed to request screenshot: ' + e.message);
    } finally {
      setTimeout(() => setCapturingScreen(false), 2000);
    }
  };

  const openScreenshotViewer = (shot) => {
    setSelectedScreenshot(shot);
    setScreenshotModalVisible(true);
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

      {/* Live Screen Monitoring & Screenshot Card */}
      <View style={styles.screenshotCard}>
        <View style={styles.screenshotHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenshotCardTitle}>Live Screen (পর্দার সরাসরি ছবি)</Text>
            <Text style={styles.screenshotCardSub}>Real-time visual monitoring</Text>
          </View>
          <TouchableOpacity
            style={[styles.captureBtn, capturingScreen && { opacity: 0.7 }]}
            onPress={handleRequestScreenshot}
            disabled={capturingScreen}
          >
            {capturingScreen ? (
              <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
            ) : null}
            <Text style={styles.captureBtnText}>
              {capturingScreen ? 'Capturing...' : '📸 Capture Now'}
            </Text>
          </TouchableOpacity>
        </View>

        {data?.latest_screenshot ? (
          <View>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.screenshotPreviewWrapper}
              onPress={() => openScreenshotViewer(data.latest_screenshot)}
            >
              <Image
                source={{ uri: data.latest_screenshot.image_data }}
                style={styles.screenshotMainImage}
                resizeMode="cover"
              />
              <View style={styles.screenshotOverlay}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.screenshotOverlayApp} numberOfLines={1}>
                    {data.latest_screenshot.process_name}
                  </Text>
                  <Text style={styles.screenshotOverlayTitle} numberOfLines={1}>
                    {data.latest_screenshot.window_title || 'Active Window'}
                  </Text>
                </View>
                <View style={styles.screenshotTimeBadge}>
                  <Text style={styles.screenshotTimeText}>
                    {data.latest_screenshot.time_str}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Horizontal Recent Screenshots Strip */}
            {data?.recent_screenshots?.length > 1 ? (
              <View style={styles.galleryStripWrapper}>
                <Text style={styles.galleryStripTitle}>Recent Captures</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryStripScroll}>
                  {data.recent_screenshots.map((s, idx) => (
                    <TouchableOpacity
                      key={s.id || idx}
                      style={styles.galleryThumbItem}
                      onPress={() => openScreenshotViewer(s)}
                    >
                      <Image
                        source={{ uri: s.thumbnail_data || s.image_data }}
                        style={styles.galleryThumbImg}
                        resizeMode="cover"
                      />
                      <Text style={styles.galleryThumbTime} numberOfLines={1}>
                        {s.time_str}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.noScreenshotBox}>
            <Text style={styles.noScreenshotText}>No screenshot recorded yet.</Text>
            <TouchableOpacity
              style={styles.emptyCaptureBtn}
              onPress={handleRequestScreenshot}
            >
              <Text style={styles.emptyCaptureBtnText}>Capture Screen Now</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Fullscreen Screenshot Modal */}
      <Modal
        visible={screenshotModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setScreenshotModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalAppName}>
                {selectedScreenshot?.process_name || 'Active Screen'}
              </Text>
              <Text style={styles.modalAppTitle} numberOfLines={1}>
                {selectedScreenshot?.window_title || ''}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setScreenshotModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>✕ Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalImageContainer}>
            {selectedScreenshot ? (
              <Image
                source={{ uri: selectedScreenshot.image_data || selectedScreenshot.thumbnail_data }}
                style={styles.modalFullImage}
                resizeMode="contain"
              />
            ) : null}
          </View>

          <View style={styles.modalFooter}>
            <Text style={styles.modalFooterText}>
              Captured at: {selectedScreenshot?.time_str || ''} • Category: {selectedScreenshot?.category_name || 'Other'}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Typed Text & Keystroke History Card */}
      <View style={styles.keystrokeCard}>
        <View style={styles.keystrokeHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.keystrokeCardTitle}>⌨️ Typed Text & Keystrokes (লেখা ও ক্লিপবোর্ড)</Text>
            <Text style={styles.keystrokeCardSub}>Recorded text, searches & clipboard history</Text>
          </View>
          <View style={styles.keystrokeCountBadge}>
            <Text style={styles.keystrokeCountText}>
              {(data?.recent_keystrokes || []).length} Logs
            </Text>
          </View>
        </View>

        {(data?.recent_keystrokes && data.recent_keystrokes.length > 0) ? (
          <View style={styles.keystrokeList}>
            {data.recent_keystrokes.slice(0, 6).map((item, idx) => (
              <View key={item.id || idx} style={styles.keystrokeItem}>
                <View style={styles.keystrokeItemHeader}>
                  <View style={styles.keystrokeTagRow}>
                    <Text style={styles.keystrokeAppBadge}>{item.process_name}</Text>
                    {item.log_type === 'clipboard' ? (
                      <Text style={styles.keystrokeTypeClip}>📋 Copied</Text>
                    ) : (
                      <Text style={styles.keystrokeTypeKey}>⌨️ Typed</Text>
                    )}
                  </View>
                  <Text style={styles.keystrokeTime}>{item.time_str}</Text>
                </View>
                {item.window_title ? (
                  <Text style={styles.keystrokeTitle} numberOfLines={1}>
                    {item.window_title}
                  </Text>
                ) : null}
                <Text style={styles.keystrokeContent} numberOfLines={3}>
                  {item.content}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.noKeystrokesBox}>
            <Text style={styles.noKeystrokesText}>No typed text or clipboard records yet.</Text>
          </View>
        )}
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
  // Screenshot Styles
  screenshotCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  screenshotHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  screenshotCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  screenshotCardSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentRed,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  captureBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  screenshotPreviewWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    position: 'relative',
    height: 190,
  },
  screenshotMainImage: {
    width: '100%',
    height: '100%',
  },
  screenshotOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenshotOverlayApp: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  screenshotOverlayTitle: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    marginTop: 2,
  },
  screenshotTimeBadge: {
    backgroundColor: 'rgba(239, 35, 60, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 8,
  },
  screenshotTimeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  galleryStripWrapper: {
    marginTop: 12,
  },
  galleryStripTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  galleryStripScroll: {
    flexDirection: 'row',
  },
  galleryThumbItem: {
    width: 90,
    marginRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  galleryThumbImg: {
    width: 90,
    height: 52,
    backgroundColor: '#0f172a',
  },
  galleryThumbTime: {
    fontSize: 9,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 2,
    fontWeight: '600',
  },
  noScreenshotBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noScreenshotText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  emptyCaptureBtn: {
    backgroundColor: colors.accentRed,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  emptyCaptureBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    justifyContent: 'space-between',
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
  },
  modalAppName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  modalAppTitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modalCloseText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFullImage: {
    width: '100%',
    height: '100%',
  },
  modalFooter: {
    paddingTop: 10,
    alignItems: 'center',
  },
  modalFooterText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  keystrokeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  keystrokeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  keystrokeCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  keystrokeCardSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  keystrokeCountBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  keystrokeCountText: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '700',
  },
  keystrokeList: {
    gap: 8,
  },
  keystrokeItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  keystrokeItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  keystrokeTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  keystrokeAppBadge: {
    backgroundColor: '#e2e8f0',
    color: '#1e293b',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  keystrokeTypeClip: {
    color: '#16a34a',
    fontSize: 10,
    fontWeight: '700',
  },
  keystrokeTypeKey: {
    color: '#2563eb',
    fontSize: 10,
    fontWeight: '700',
  },
  keystrokeTime: {
    color: '#94a3b8',
    fontSize: 10,
  },
  keystrokeTitle: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 4,
  },
  keystrokeContent: {
    color: '#0f172a',
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: '#ffffff',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  noKeystrokesBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  noKeystrokesText: {
    color: '#94a3b8',
    fontSize: 12,
  },
});

