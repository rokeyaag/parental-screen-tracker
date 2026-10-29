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
  TextInput,
  Dimensions,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../api/client';
import { useDevices } from '../context/DeviceContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function HomeScreen() {
  const {
    devices,
    setDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    selectedDevice,
    switchDevice,
    refreshDevices,
  } = useDevices();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [capturingScreen, setCapturingScreen] = useState(false);
  const [screenshotModalVisible, setScreenshotModalVisible] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [zoomScale, setZoomScale] = useState(1.0);
  const [lastTap, setLastTap] = useState(0);

  // Sub-device Modals
  const [switcherModalVisible, setSwitcherModalVisible] = useState(false);
  const [pairingModalVisible, setPairingModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // New sub-device form
  const [selectedDeviceType, setSelectedDeviceType] = useState('Laptop'); // 'Laptop', 'Desktop', 'Mobile'
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newChildName, setNewChildName] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);

  // Editing device
  const [editingDevice, setEditingDevice] = useState(null);
  const [editName, setEditName] = useState('');
  const [editChild, setEditChild] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const getDeviceIcon = (osName, deviceName) => {
    const s = `${osName || ''} ${deviceName || ''}`.toLowerCase();
    if (s.includes('phone') || s.includes('mobile') || s.includes('android') || s.includes('ios')) return '📱';
    if (s.includes('desktop') || s.includes('pc') || s.includes('computer')) return '🖥️';
    return '💻';
  };

  const handleGenerateCode = async () => {
    if (!newDeviceName.trim()) {
      Alert.alert('Required', 'Please enter a device name (e.g. Rahim Laptop, Sammy Phone).');
      return;
    }
    setPairingLoading(true);
    try {
      const res = await api.generatePairingCode(newDeviceName.trim(), newChildName.trim(), selectedDeviceType);
      if (res.success && res.pairing_code) {
        setGeneratedCode(res.pairing_code);
        if (res.device_id) {
          setSelectedDeviceId(res.device_id);
        }
        refreshDevices();
      } else {
        Alert.alert('Error', 'Could not generate code.');
      }
    } catch (err) {
      Alert.alert('Pairing Error', err.message);
    } finally {
      setPairingLoading(false);
    }
  };

  const handleDeleteDevice = (dev) => {
    Alert.alert(
      'Unpair Sub-Device (সাব-ডিভাইস রিমুভ)',
      `Are you sure you want to remove '${dev.device_name}' from this Main Controller? All recorded activity for this device will be erased.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpair & Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteDevice(dev.id);
              Alert.alert('Device Removed', `'${dev.device_name}' has been successfully removed.`);
              if (selectedDeviceId === dev.id) {
                setSelectedDeviceId(null);
              }
              refreshDevices();
              loadData();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleStartEdit = (dev) => {
    setEditingDevice(dev);
    setEditName(dev.device_name || '');
    setEditChild(dev.assigned_child || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingDevice || !editName.trim()) return;
    setEditLoading(true);
    try {
      await api.updateDevice(editingDevice.id, editName.trim(), editChild.trim(), editingDevice.os_name);
      setEditModalVisible(false);
      refreshDevices();
      loadData();
      Alert.alert('Updated', 'Sub-device info updated successfully.');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    try {
      const res = await api.getDashboard(selectedDeviceId);
      setData(res);
      setLoadError(null);
      if (res?.devices && res.devices.length > 0 && devices.length === 0) {
        setDevices(res.devices);
        if (!selectedDeviceId) {
          setSelectedDeviceId(res.devices[0].id);
        }
      }
    } catch (err) {
      console.log('Load Error:', err.message);
      setLoadError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDeviceId, setDevices, setSelectedDeviceId, devices.length]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // 5s live poll
    return () => clearInterval(interval);
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    refreshDevices();
    loadData();
  };

  const handleStudyToggle = async () => {
    setActionLoading(true);
    try {
      const res = await api.toggleStudyMode(selectedDeviceId);
      Alert.alert(
        'Study Mode',
        res.study_mode_active ? 'Study Mode activated for this sub-device!' : 'Study Mode disabled.'
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
      const res = await api.toggleEmergencyLock(selectedDeviceId);
      Alert.alert(
        'Emergency Lock',
        res.emergency_lock ? 'Screen locked on this sub-device!' : 'Screen unlocked on this sub-device.'
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
      await api.requestScreenshot(selectedDeviceId);
      Alert.alert('Capture Dispatched', 'Taking live screenshot on sub-device in ~3 seconds.');
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
    setZoomScale(1.0);
    setScreenshotModalVisible(true);
  };

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(Number((prev + 0.5).toFixed(1)), 4.0));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(Number((prev - 0.5).toFixed(1)), 1.0));
  };

  const handleZoomReset = () => {
    setZoomScale(1.0);
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      setZoomScale((prev) => (prev > 1.2 ? 1.0 : 2.5));
    }
    setLastTap(now);
  };

  if (loading && !data) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accentYellow} />
        <Text style={styles.loadingText}>Loading Main Controller...</Text>
      </View>
    );
  }

  if (!loading && !data && loadError) {
    return (
      <View style={styles.centerContainer}>
        <Text style={{ fontSize: 44, marginBottom: 12 }}>⚠️</Text>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 4 }}>Cannot Reach Server</Text>
        <Text style={{ fontSize: 14, color: '#b45309', fontWeight: '700', marginBottom: 10 }}>সার্ভারে কানেক্ট হতে পারছে না</Text>
        <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginHorizontal: 20, marginBottom: 18 }}>
          {loadError}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#0f172a', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 }}
          onPress={() => {
            setLoading(true);
            loadData();
          }}
        >
          <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14 }}>🔄 Retry Connection (পুনরায় চেষ্টা করুন)</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 18, lineHeight: 18, marginHorizontal: 20 }}>
          টিপস: পিসিতে start.bat চালু আছে কিনা দেখুন, এবং মোবাইল ও পিসি একই ওয়াইফাইতে যুক্ত কিনা নিশ্চিত করুন।
        </Text>
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
      contentContainerStyle={{ paddingBottom: 110 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accentYellow]} />
      }
    >
      {loadError && (
        <View style={{ backgroundColor: '#fef3c7', borderRadius: 8, padding: 8, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: '#b45309', fontWeight: '600', flex: 1 }}>⚠️ Server connection issue: {loadError}</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={{ fontSize: 11, color: '#b45309', fontWeight: '800', marginLeft: 8 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 👑 Master Controller Top Bar */}
      <View style={styles.masterHeaderRow}>
        <View style={styles.masterBadgeWrap}>
          <Text style={styles.masterCrown}>👑</Text>
          <View>
            <Text style={styles.masterBadgeTitle}>MAIN CONTROLLER</Text>
            <Text style={styles.masterBadgeSub}>Parent Super-Admin (অভিভাবক কন্ট্রোলার)</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addSubBtn}
          onPress={() => {
            setGeneratedCode('');
            setSelectedDeviceType('Laptop');
            setNewDeviceName('');
            setNewChildName('');
            setPairingModalVisible(true);
          }}
        >
          <Text style={styles.addSubBtnText}>+ Add Sub</Text>
        </TouchableOpacity>
      </View>

      {/* Active Sub-Device Selector Card */}
      <TouchableOpacity
        style={styles.activeDeviceCard}
        activeOpacity={0.8}
        onPress={() => setSwitcherModalVisible(true)}
      >
        <View style={styles.activeDeviceLeft}>
          <View style={styles.deviceIconCircle}>
            <Text style={styles.deviceIconText}>
              {getDeviceIcon(device.os_name, device.name)}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.activeDeviceLabel}>CONTROLLING SUB-DEVICE:</Text>
              <View
                style={[
                  styles.deviceTypePill,
                  { backgroundColor: (device.os_name?.toLowerCase().includes('mobile') || device.os_name?.toLowerCase().includes('android')) ? '#eff6ff' : '#f0fdf4' }
                ]}
              >
                <Text
                  style={[
                    styles.deviceTypePillText,
                    { color: (device.os_name?.toLowerCase().includes('mobile') || device.os_name?.toLowerCase().includes('android')) ? '#2563eb' : '#16a34a' }
                  ]}
                >
                  {device.os_name || 'PC'}
                </Text>
              </View>
            </View>
            <Text style={styles.activeDeviceName} numberOfLines={1}>
              {device.name || 'Select a Sub-Device'}
            </Text>
            <Text style={styles.activeDeviceChild} numberOfLines={1}>
              Child: {device.assigned_child || 'Unassigned'}
            </Text>
          </View>
        </View>

        <View style={styles.activeDeviceRight}>
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

          <View style={styles.switchButtonSmall}>
            <Text style={styles.switchButtonSmallText}>⇄ Switch</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Live Active App Ticker */}
      <View style={styles.liveCard}>
        <View style={styles.liveHeaderRow}>
          <Text style={styles.liveLabel}>Currently Active Application</Text>
          <View style={styles.badgeBrowsing}>
            <Text style={styles.badgeBrowsingText}>{device.current_category || 'Idle / Other'}</Text>
          </View>
        </View>
        <Text style={styles.liveAppName}>{device.current_app || 'No Application Active'}</Text>
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={styles.galleryStripTitle}>Recent Captures (ব্যাকআপ স্ন্যাপশট)</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b' }}>{data.recent_screenshots.length} saved</Text>
                </View>
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

          {/* Zoom Control Bar */}
          <View style={styles.zoomControlBar}>
            <View style={styles.zoomInfoLeft}>
              <View style={styles.zoomBadge}>
                <Text style={styles.zoomBadgeText}>{Math.round(zoomScale * 100)}%</Text>
              </View>
              <Text style={styles.zoomHintText}>
                {zoomScale > 1.0 ? 'Pinch/Drag to pan' : 'Double tap or + to zoom'}
              </Text>
            </View>

            <View style={styles.zoomButtonsGroup}>
              <TouchableOpacity
                style={[styles.zoomActionBtn, zoomScale <= 1.0 && styles.zoomActionBtnDisabled]}
                onPress={handleZoomOut}
                disabled={zoomScale <= 1.0}
                activeOpacity={0.7}
              >
                <Text style={styles.zoomActionBtnText}>−</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.zoomActionBtn, styles.zoomResetBtn]}
                onPress={handleZoomReset}
                activeOpacity={0.7}
              >
                <Text style={styles.zoomResetBtnText}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.zoomActionBtn, zoomScale >= 4.0 && styles.zoomActionBtnDisabled]}
                onPress={handleZoomIn}
                disabled={zoomScale >= 4.0}
                activeOpacity={0.7}
              >
                <Text style={styles.zoomActionBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.modalImageContainer}>
            {selectedScreenshot ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={zoomScale > 1.0}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  minWidth: '100%',
                  minHeight: '100%',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <ScrollView
                  showsVerticalScrollIndicator={zoomScale > 1.0}
                  showsHorizontalScrollIndicator={false}
                  maximumZoomScale={5.0}
                  minimumZoomScale={1.0}
                  zoomScale={zoomScale}
                  contentContainerStyle={{
                    minWidth: '100%',
                    minHeight: '100%',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  centerContent={true}
                >
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={handleDoubleTap}
                  >
                    <Image
                      source={{ uri: selectedScreenshot.image_data || selectedScreenshot.thumbnail_data }}
                      style={{
                        width: (SCREEN_WIDTH - 24) * zoomScale,
                        height: (SCREEN_HEIGHT * 0.65) * zoomScale,
                      }}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </ScrollView>
              </ScrollView>
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
            {summary.total_formatted || '0m'}
          </Text>
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${summary.total_pct || 0}%`, backgroundColor: colors.accentYellow }
              ]}
            />
          </View>
          <Text style={styles.metricSub}>Limit: {summary.daily_limit_mins || 0} mins ({summary.total_pct || 0}%)</Text>
        </View>

        {/* Gaming Time */}
        <View style={[styles.metricCard, styles.borderRed]}>
          <Text style={styles.metricLabel}>Gaming Usage</Text>
          <Text style={[styles.metricValue, { color: colors.accentRed }]}>
            {summary.gaming_formatted || '0m'}
          </Text>
          <Text style={styles.metricSub}>Auto-block on limit</Text>
        </View>

        {/* Study Time */}
        <View style={[styles.metricCard, styles.borderYellow]}>
          <Text style={styles.metricLabel}>Study & Productivity</Text>
          <Text style={[styles.metricValue, { color: colors.accentYellowDark }]}>
            {summary.study_formatted || '0m'}
          </Text>
          <Text style={styles.metricSub}>VS Code, Zoom, Docs</Text>
        </View>

        {/* Browsing Time */}
        <View style={[styles.metricCard, styles.borderWhite]}>
          <Text style={styles.metricLabel}>Browsing & Media</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
            {summary.browsing_formatted || '0m'}
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

      {/* Modal 1: Sub-Devices Switcher & Management Modal */}
      <Modal
        visible={switcherModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSwitcherModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.switcherModalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.switcherModalTitle}>Sub-Devices (সাব-ডিভাইস সমূহ)</Text>
                <Text style={styles.switcherModalSub}>
                  Select a device to monitor & control ({devices.length} registered):
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSwitcherModalVisible(false)}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380, marginTop: 10 }}>
              {devices.length === 0 ? (
                <View style={styles.emptyDevicesBox}>
                  <Text style={styles.emptyDevicesText}>No sub-devices paired yet.</Text>
                  <Text style={styles.emptyDevicesSub}>Add your first Laptop, Desktop or Child Mobile below!</Text>
                </View>
              ) : (
                devices.map((dev) => {
                  const isCurrent = dev.id === device.id;
                  const isOnline = !!dev.is_online;
                  return (
                    <TouchableOpacity
                      key={dev.id}
                      style={[styles.deviceItemCard, isCurrent && styles.deviceItemCardActive]}
                      onPress={() => {
                        switchDevice(dev.id);
                        setSwitcherModalVisible(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.deviceItemLeft}>
                        <View style={styles.deviceItemIconWrap}>
                          <Text style={styles.deviceItemIcon}>
                            {getDeviceIcon(dev.os_name, dev.device_name)}
                          </Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.deviceItemName} numberOfLines={1}>
                              {dev.device_name}
                            </Text>
                            {isCurrent && (
                              <View style={styles.activeBadgeSmall}>
                                <Text style={styles.activeBadgeSmallText}>ACTIVE</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.deviceItemChild} numberOfLines={1}>
                            Child: {dev.assigned_child || 'Unassigned'} • {dev.os_name || 'PC'}
                          </Text>
                          <Text style={styles.deviceItemLastSeen}>
                            Last seen: {dev.last_seen_str || 'Recently'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.deviceItemRight}>
                        <View
                          style={[
                            styles.statusDotSmall,
                            { backgroundColor: isOnline ? colors.onlineGreen : colors.offlineRed }
                          ]}
                        />
                        <TouchableOpacity
                          style={styles.actionIconBtn}
                          onPress={() => handleStartEdit(dev)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={{ fontSize: 13 }}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionIconBtn}
                          onPress={() => handleDeleteDevice(dev)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={{ fontSize: 13 }}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.addDeviceFromSwitcherBtn}
              onPress={() => {
                setSwitcherModalVisible(false);
                setGeneratedCode('');
                setSelectedDeviceType('Laptop');
                setNewDeviceName('');
                setNewChildName('');
                setPairingModalVisible(true);
              }}
            >
              <Text style={styles.addDeviceFromSwitcherBtnText}>
                ➕ Add New Sub-Device (ল্যাপটপ / ডেক্সটপ / মোবাইল)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal 2: Add New Sub-Device Wizard Modal */}
      <Modal
        visible={pairingModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPairingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pairingModalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.pairingModalTitle}>Add New Sub-Device (নতুন সাব-ডিভাইস)</Text>
                <Text style={styles.pairingModalSub}>
                  Connect a Laptop, Desktop or Child Mobile to your Main Controller.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setPairingModalVisible(false)}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {generatedCode ? (
              <View style={styles.codeContainer}>
                <Text style={styles.codeLabel}>YOUR 6-DIGIT PAIRING CODE:</Text>
                <Text style={styles.codeValue}>{generatedCode}</Text>
                
                <View style={styles.codeInstructions}>
                  <Text style={styles.instHeader}>
                    {selectedDeviceType === 'Mobile' ? '📱 বাচ্চার মোবাইল কানেক্ট করার নিয়ম:' : '💻 বাচ্চার ল্যাপটপ বা ডেক্সটপ কানেক্ট করার নিয়ম:'}
                  </Text>
                  {selectedDeviceType === 'Mobile' ? (
                    <Text style={styles.instText}>
                      ১. বাচ্চার মোবাইলে এই Parental Screen Tracker অ্যাপটি ইন্সটল করুন।{'\n'}
                      ২. Settings থেকে 'Switch to Sub-Device Mode' চাপুন অথবা প্রথমবার অ্যাপ খুললে 'Connect as Sub-Device' নির্বাচন করুন।{'\n'}
                      ৩. এই ৬-সংখ্যার কোডটি দিয়ে Submit চাপলেই মোবাইলটি আপনার মেইন কন্ট্রোলারের সাথে যুক্ত হয়ে যাবে।
                    </Text>
                  ) : (
                    <Text style={styles.instText}>
                      ১. বাচ্চার ল্যাপটপ বা ডেক্সটপে Parental Screen Tracker চালু করুন।{'\n'}
                      ২. স্ক্রিনের প্রম্পট বক্সে এই ৬-সংখ্যার কোডটি লিখুন, অথবা কমান্ড দিন:{'\n'}
                      <Text style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>ParentalScreenTracker.exe --pair {generatedCode}</Text>{'\n'}
                      ৩. কোডটির মেয়াদ ১৫ মিনিট। কোড সাবমিট করা মাত্রই কম্পিউটারটি আজীবনের জন্য কানেক্ট হয়ে যাবে।
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.pairingDoneBtn}
                  onPress={() => {
                    setPairingModalVisible(false);
                    setGeneratedCode('');
                    refreshDevices();
                    loadData();
                  }}
                >
                  <Text style={styles.pairingDoneBtnText}>Done & Refresh (সম্পন্ন হয়েছে)</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.inputLabel}>1. Select Device Type (ডিভাইসের ধরন):</Text>
                <View style={styles.deviceTypeSelectorRow}>
                  {[
                    { key: 'Laptop', label: 'Laptop', icon: '💻' },
                    { key: 'Desktop', label: 'Desktop PC', icon: '🖥️' },
                    { key: 'Mobile', label: 'Child Mobile', icon: '📱' },
                  ].map((t) => {
                    const isSelected = selectedDeviceType === t.key;
                    return (
                      <TouchableOpacity
                        key={t.key}
                        style={[styles.typeOptionBtn, isSelected && styles.typeOptionBtnActive]}
                        onPress={() => setSelectedDeviceType(t.key)}
                      >
                        <Text style={styles.typeOptionIcon}>{t.icon}</Text>
                        <Text style={[styles.typeOptionLabel, isSelected && styles.typeOptionLabelActive]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                  2. Device Name ({selectedDeviceType === 'Mobile' ? 'মোবাইলের নাম' : 'কম্পিউটারের নাম'}):
                </Text>
                <TextInput
                  style={styles.pairingInput}
                  placeholder={selectedDeviceType === 'Mobile' ? 'e.g. Rahim Phone' : 'e.g. Study Laptop, Karim PC'}
                  placeholderTextColor="#999"
                  value={newDeviceName}
                  onChangeText={setNewDeviceName}
                />

                <Text style={[styles.inputLabel, { marginTop: 10 }]}>3. Child's Name (সন্তানের নাম):</Text>
                <TextInput
                  style={styles.pairingInput}
                  placeholder="e.g. Samiul, Ayan, Rahim"
                  placeholderTextColor="#999"
                  value={newChildName}
                  onChangeText={setNewChildName}
                />

                <TouchableOpacity
                  style={[styles.generateCodeBtn, pairingLoading && { opacity: 0.6 }]}
                  onPress={handleGenerateCode}
                  disabled={pairingLoading}
                >
                  {pairingLoading ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={styles.generateCodeBtnText}>
                      Generate 6-Digit Code (পেয়ারিং কোড তৈরি করুন)
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setPairingModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal 3: Edit Sub-Device Info Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pairingModalCard}>
            <Text style={styles.pairingModalTitle}>Edit Sub-Device (তথ্য পরিবর্তন)</Text>
            <Text style={styles.pairingModalSub}>Update device name and assigned child.</Text>

            <View style={{ marginTop: 14 }}>
              <Text style={styles.inputLabel}>Device Name:</Text>
              <TextInput
                style={styles.pairingInput}
                value={editName}
                onChangeText={setEditName}
              />

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>Assigned Child:</Text>
              <TextInput
                style={styles.pairingInput}
                value={editChild}
                onChangeText={setEditChild}
              />

              <TouchableOpacity
                style={[styles.generateCodeBtn, { backgroundColor: '#0284c7' }]}
                onPress={handleSaveEdit}
                disabled={editLoading}
              >
                {editLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.generateCodeBtnText, { color: '#ffffff' }]}>Save Changes (সংরক্ষণ করুন)</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  masterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 4,
  },
  masterBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  masterCrown: {
    fontSize: 24,
    marginRight: 8,
  },
  masterBadgeTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  masterBadgeSub: {
    fontSize: 11,
    color: '#d97706',
    fontWeight: '700',
  },
  addSubBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  addSubBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  activeDeviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  activeDeviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  deviceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexShrink: 0,
  },
  deviceIconText: {
    fontSize: 22,
  },
  activeDeviceLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  deviceTypePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  deviceTypePillText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  activeDeviceName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  activeDeviceChild: {
    fontSize: 12,
    color: '#64748b',
  },
  activeDeviceRight: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  switchButtonSmall: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  switchButtonSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  switcherModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  switcherModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  switcherModalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: 'bold',
  },
  emptyDevicesBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDevicesText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  emptyDevicesSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  deviceItemCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceItemCardActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  deviceItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceItemIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deviceItemIcon: {
    fontSize: 18,
  },
  deviceItemName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  activeBadgeSmall: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  activeBadgeSmallText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
  },
  deviceItemChild: {
    fontSize: 11,
    color: '#475569',
  },
  deviceItemLastSeen: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  deviceItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 6,
  },
  statusDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  addDeviceFromSwitcherBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  addDeviceFromSwitcherBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  deviceTypeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  typeOptionBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  typeOptionBtnActive: {
    borderColor: '#0284c7',
    backgroundColor: '#e0f2fe',
  },
  typeOptionIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  typeOptionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  typeOptionLabelActive: {
    color: '#0284c7',
    fontWeight: '800',
  },
  instHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369a1',
    marginBottom: 4,
  },
  instText: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 17,
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
  zoomControlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  zoomInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zoomBadge: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  zoomBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  zoomHintText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  zoomButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zoomActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomActionBtnDisabled: {
    opacity: 0.35,
  },
  zoomActionBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  zoomResetBtn: {
    width: 'auto',
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  zoomResetBtnText: {
    color: '#ffffff',
    fontSize: 11,
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
  addPcBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPcBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pairingModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  pairingModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  pairingModalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  pairingInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0f172a',
  },
  generateCodeBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  generateCodeBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  codeContainer: {
    marginTop: 18,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 1,
  },
  codeValue: {
    fontSize: 34,
    fontWeight: '900',
    color: '#0284c7',
    letterSpacing: 6,
    marginVertical: 10,
  },
  codeInstructions: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
    textAlign: 'left',
    marginTop: 4,
    backgroundColor: '#e0f2fe',
    padding: 10,
    borderRadius: 8,
  },
  pairingDoneBtn: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 24,
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  pairingDoneBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});

