import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Animated,
  PanResponder,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  StatusBar,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const calcDistance = (x1, y1, x2, y2) => {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
};

export default function ZoomableImageViewer({
  visible,
  screenshot,
  onClose,
}) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;

  const scaleValue = useRef(1);
  const panValue = useRef({ x: 0, y: 0 });
  const initialDistance = useRef(0);
  const initialScale = useRef(1);
  const lastTap = useRef(0);
  const [zoomDisplay, setZoomDisplay] = useState('1.0x');

  useEffect(() => {
    const scaleSub = scale.addListener((v) => {
      scaleValue.current = v.value;
      setZoomDisplay(`${v.value.toFixed(1)}x`);
    });
    const panSub = pan.addListener((v) => {
      panValue.current = v;
    });
    return () => {
      scale.removeListener(scaleSub);
      pan.removeListener(panSub);
    };
  }, [scale, pan]);

  useEffect(() => {
    if (visible) {
      resetZoom(false);
    }
  }, [visible]);

  const resetZoom = (animated = true) => {
    if (animated) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: false, friction: 7 }),
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 7 }),
      ]).start();
    } else {
      scale.setValue(1);
      pan.setValue({ x: 0, y: 0 });
      scaleValue.current = 1;
      panValue.current = { x: 0, y: 0 };
    }
  };

  const handleDoubleTap = () => {
    if (scaleValue.current > 1.2) {
      resetZoom(true);
    } else {
      Animated.parallel([
        Animated.spring(scale, { toValue: 2.8, useNativeDriver: false, friction: 7 }),
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 7 }),
      ]).start();
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          initialDistance.current = calcDistance(
            touches[0].pageX,
            touches[0].pageY,
            touches[1].pageX,
            touches[1].pageY
          );
          initialScale.current = scaleValue.current;
        } else if (touches.length === 1) {
          pan.setOffset({
            x: panValue.current.x,
            y: panValue.current.y,
          });
          pan.setValue({ x: 0, y: 0 });
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          // ✌️ Two finger pinch-to-zoom
          const currentDist = calcDistance(
            touches[0].pageX,
            touches[0].pageY,
            touches[1].pageX,
            touches[1].pageY
          );
          if (initialDistance.current > 0) {
            const factor = currentDist / initialDistance.current;
            const newScale = Math.min(Math.max(initialScale.current * factor, 0.8), 5.0);
            scale.setValue(newScale);
          }
        } else if (touches.length === 1 && scaleValue.current > 1.05) {
          // 👆 One finger panning when zoomed in
          pan.setValue({
            x: gestureState.dx,
            y: gestureState.dy,
          });
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        pan.flattenOffset();
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;

        // Double tap detection
        if (
          Math.abs(gestureState.dx) < 8 &&
          Math.abs(gestureState.dy) < 8 &&
          evt.nativeEvent.touches.length === 0
        ) {
          if (now - lastTap.current < DOUBLE_TAP_DELAY) {
            handleDoubleTap();
            lastTap.current = 0;
            return;
          }
          lastTap.current = now;
        }

        // Spring back if pinched too small
        if (scaleValue.current < 1.0) {
          resetZoom(true);
        } else if (scaleValue.current === 1.0) {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  if (!visible || !screenshot) return null;

  const imageUri = screenshot.image_data || screenshot.thumbnail_data;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#020617" />
      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.appName} numberOfLines={1}>
                {screenshot.process_name || 'Active Screen'}
              </Text>
              {screenshot.category_name ? (
                <View style={styles.catBadge}>
                  <Text style={styles.catBadgeText}>{screenshot.category_name}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.appTitle} numberOfLines={1}>
              {screenshot.window_title || 'Desktop Window'}
            </Text>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeBtnText}>✕ Close</Text>
          </TouchableOpacity>
        </View>

        {/* Gesture Hint & Zoom Badge Toolbar */}
        <View style={styles.hintBar}>
          <View style={styles.hintTextWrap}>
            <Text style={styles.hintText}>✌️ Pinch to zoom • 👆 Double-tap</Text>
          </View>

          {scaleValue.current > 1.05 && (
            <TouchableOpacity style={styles.zoomPill} onPress={() => resetZoom(true)} activeOpacity={0.8}>
              <Text style={styles.zoomPillText}>🔍 {zoomDisplay} (Tap to Reset)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Zoomable Image Canvas */}
        <View style={styles.canvasContainer} {...panResponder.panHandlers}>
          <Animated.View
            style={[
              styles.imageWrapper,
              {
                transform: [
                  { translateX: pan.x },
                  { translateY: pan.y },
                  { scale: scale },
                ],
              },
            ]}
          >
            <Image
              source={{ uri: imageUri }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Bottom Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTime}>
            📅 {screenshot.time_str || 'Today'}
          </Text>
          <Text style={styles.footerHelp}>
            Tip: Double-tap anywhere to inspect text details
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  appName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  catBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  catBadgeText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  appTitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  hintBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  hintTextWrap: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  hintText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  zoomPill: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  zoomPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  canvasContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  footerTime: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700',
  },
  footerHelp: {
    color: '#64748b',
    fontSize: 10,
  },
});
