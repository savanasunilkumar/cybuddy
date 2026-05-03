import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  CameraView,
  useCameraPermissions,
  type CameraType,
} from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { palette, spacing, radii } from '../theme/tokens';
import { cameraDescribeService } from '../services/cameraDescribe';
import { cloudflareTTSService } from '../services/cloudflareTTS';

const AUTO_INTERVAL_MS = 7000;

// Crude similarity check so the auto loop doesn't re-speak nearly-identical
// descriptions every 7s. Compares the first 60 characters lowercased.
const isSimilar = (a: string, b: string): boolean => {
  if (!a || !b) return false;
  return a.slice(0, 60).toLowerCase() === b.slice(0, 60).toLowerCase();
};

export const VisionScreen: React.FC = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [facing] = useState<CameraType>('back');

  // Default OFF — user must explicitly Start, which respects user control
  // and matches the accessibility-first framing.
  const [autoMode, setAutoMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState<string>('');
  const lastSpokenRef = useRef<string>('');
  const inFlightRef = useRef(false);
  const isFocusedRef = useRef(false);

  const captureAndDescribe = useCallback(async (speak: boolean = true) => {
    if (!cameraRef.current) return;
    if (inFlightRef.current) return; // never queue overlapping captures
    inFlightRef.current = true;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        skipProcessing: true,
        exif: false,
      });
      if (!photo?.uri) {
        throw new Error('Camera returned no photo');
      }

      // Resize to ~1024px wide JPEG before upload — keeps round-trip fast and
      // vision-token cost low. Manipulator returns base64 directly.
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!manipulated.base64) throw new Error('Manipulator returned no base64');

      // Always pass speak:false to the service so dedup happens HERE — the
      // service has no concept of "did we just say this 7 seconds ago."
      const text = await cameraDescribeService.describeImageBase64(manipulated.base64, {
        speak: false,
      });

      setDescription(text);

      if (speak && !isSimilar(text, lastSpokenRef.current)) {
        lastSpokenRef.current = text;
        try {
          await cloudflareTTSService.speak(text);
        } catch (e) {
          console.error('TTS error in vision loop:', e);
        }
      } else if (!speak) {
        lastSpokenRef.current = text;
      }
    } catch (err) {
      console.error('Vision capture error:', err);
    } finally {
      setBusy(false);
      inFlightRef.current = false;
    }
  }, []);

  // Auto-describe loop: runs only while the screen is focused AND autoMode is on.
  useEffect(() => {
    if (!autoMode || !permission?.granted) return;
    if (!isFocusedRef.current) return;

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (!isFocusedRef.current) return;
      if (AppState.currentState !== 'active') return;
      // captureAndDescribe is internally guarded against overlap.
      await captureAndDescribe(true);
    };

    // Fire one immediately so the user gets feedback fast.
    void tick();
    const id = setInterval(tick, AUTO_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [autoMode, permission?.granted, captureAndDescribe]);

  // Track focus so the loop pauses when user navigates away. Also auto-stop
  // the loop on tab leave so users don't come back to a still-running camera.
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      return () => {
        isFocusedRef.current = false;
        setAutoMode(false);
        cloudflareTTSService.stop().catch(() => {});
      };
    }, [])
  );

  // Permission gate
  if (!permission) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerBox}>
          <ActivityIndicator color={palette.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Vision</Text>
          <Text style={styles.subtitle}>Cy describes what's in front of you, out loud.</Text>
        </View>
        <View style={styles.centerBox}>
          <Ionicons name="camera" size={56} color={palette.brand} />
          <Text style={styles.permissionText}>
            Cybuddy needs camera access to describe what's in front of you.
          </Text>
          <Pressable
            onPress={() => {
              requestPermission().catch((e) => Alert.alert('Permission error', String(e)));
            }}
            accessibilityRole="button"
            accessibilityLabel="Allow camera access"
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Allow camera</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Vision</Text>
        <Text style={styles.subtitle}>
          {autoMode
            ? "Live — Cy is describing the scene every few seconds."
            : "Tap Start to have Cy describe what's around you, or Describe once for a single look."}
        </Text>
      </View>

      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          // Disable any UI controls — this is a passive describe surface.
          enableTorch={false}
        />
        {busy && (
          <View
            style={styles.busyBadge}
            accessible
            accessibilityLabel="Cy is looking at the scene"
          >
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.busyBadgeText}>Looking…</Text>
          </View>
        )}
      </View>

      {/* Controls row — Start/Stop is primary; Describe Once is secondary. */}
      <View style={styles.controls}>
        <Pressable
          onPress={() => {
            setAutoMode((prev) => {
              const next = !prev;
              if (!next) {
                cloudflareTTSService.stop().catch(() => {});
                lastSpokenRef.current = ''; // reset so a re-Start describes fresh
              }
              return next;
            });
          }}
          accessibilityRole="button"
          accessibilityLabel={autoMode ? 'Stop describing' : 'Start describing'}
          accessibilityHint={
            autoMode
              ? 'Stops the auto-describe loop. The camera preview stays on.'
              : 'Starts the auto-describe loop. Cy will describe the scene every few seconds.'
          }
          style={({ pressed }) => [
            styles.startStopButton,
            autoMode ? styles.stopButton : styles.startButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Ionicons
            name={autoMode ? 'stop-circle' : 'play-circle'}
            size={22}
            color="#FFFFFF"
          />
          <Text style={styles.primaryButtonText}>{autoMode ? 'Stop' : 'Start'}</Text>
        </Pressable>

        <Pressable
          onPress={() => captureAndDescribe(true)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Describe once"
          accessibilityHint="Captures the current view one time and describes it out loud."
          style={({ pressed }) => [
            styles.secondaryButton,
            busy && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Ionicons name="camera" size={18} color={palette.brand} />
          <Text style={styles.secondaryButtonText}>{busy ? 'Working…' : 'Describe once'}</Text>
        </Pressable>
      </View>

      {/* Description overlay panel */}
      <View
        style={styles.descriptionBox}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={description ? `Cy sees: ${description}` : 'Waiting for first description.'}
      >
        <Text style={styles.descriptionLabel}>Cy sees</Text>
        <Text style={styles.descriptionText}>
          {description || (autoMode ? "Looking around — first description in a few seconds…" : "Tap “Describe now” to start.")}
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#082F2C',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#4F6E68',
  },
  cameraWrap: {
    marginHorizontal: spacing.lg,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#000',
    aspectRatio: 3 / 4,
  },
  camera: {
    flex: 1,
  },
  busyBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  busyBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  permissionText: {
    fontSize: 15,
    color: '#4F6E68',
    textAlign: 'center',
    lineHeight: 21,
  },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  startStopButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radii.lg,
    minHeight: 52,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  startButton: {
    backgroundColor: palette.brand,
    shadowColor: palette.brand,
  },
  stopButton: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radii.lg,
    minHeight: 52,
    backgroundColor: 'rgba(12, 159, 133, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(12, 159, 133, 0.4)',
  },
  secondaryButtonText: {
    color: palette.brand,
    fontWeight: '700',
    fontSize: 14,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.brand,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.lg,
    minHeight: 44,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  descriptionBox: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: 100, // clear floating tab bar
    backgroundColor: 'rgba(12, 159, 133, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: palette.brand,
    borderRadius: radii.lg,
    padding: spacing.md,
    minHeight: 90,
  },
  descriptionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.brand,
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 16,
    color: '#082F2C',
    lineHeight: 22,
  },
});
