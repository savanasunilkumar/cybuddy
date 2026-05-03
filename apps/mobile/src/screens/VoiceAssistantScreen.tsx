import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { radii, spacing } from '../theme/tokens';
import { useVoiceAI, VoiceState } from '../hooks/useVoiceAI';
import { cameraDescribeService, DescribeStage } from '../services/cameraDescribe';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Prism theme (teal/green)
const theme = {
  background: 'linear-gradient(180deg, #F4FFF9 0%, #E8FBF5 100%)',
  backgroundSolid: '#F4FFF9',
  title: '#082F2C',
  subtitle: '#3F5C56',
  ripple: '#40D7BE',
  orbContainer: '#D8F7F0',
  orbContainerBorder: '#A4EBDD',
  orb: '#0C9F85',
  orbActive: '#0A7E69',
  wave: '#0C9F85',
  button: '#0C9F85',
  buttonActive: '#0A7E69',
  buttonText: '#FFFFFF',
  hint: '#4F6E68',
  dotA: '#3FD8C0',
  dotB: '#6BC7FF',
  dotC: '#88EA88',
  dotD: '#9BE2FF',
  // State colors
  listening: '#EF4444',
  processing: '#F59E0B',
  speaking: '#10B981',
  error: '#6B7280',
};

// State-based configurations
const stateConfig: Record<VoiceState, { color: string; label: string; icon: string }> = {
  idle: { color: theme.orb, label: 'Hold to speak', icon: 'mic-outline' },
  listening: { color: theme.listening, label: 'Listening...', icon: 'mic' },
  processing: { color: theme.processing, label: 'Thinking...', icon: 'ellipsis-horizontal' },
  speaking: { color: theme.speaking, label: 'Speaking...', icon: 'volume-high' },
  error: { color: theme.error, label: 'Try again', icon: 'alert-circle' },
};

export const VoiceAssistantScreen: React.FC = () => {
  const navigation = useNavigation();
  const {
    state,
    transcript,
    response,
    error,
    startListening,
    stopListening,
    cancel,
  } = useVoiceAI();

  // Animations
  const idlePulse = useRef(new Animated.Value(1)).current;
  const ringProgress = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const waveBars = useRef(Array.from({ length: 9 }, () => new Animated.Value(0.3))).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Auto-start listening when screen opens
    const timer = setTimeout(() => {
      startListening();
    }, 500);

    return () => {
      clearTimeout(timer);
      cancel();
    };
  }, []);

  // Idle pulse animation
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(idlePulse, {
          toValue: 1.06,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(idlePulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [idlePulse]);

  // Ring ripple animations for active states
  useEffect(() => {
    if (state === 'idle' || state === 'error') {
      ringProgress.forEach((ring) => ring.setValue(0));
      return;
    }

    const animations = ringProgress.map((ring, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 350),
          Animated.timing(ring, {
            toValue: 1,
            duration: 1500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(ring, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      )
    );

    animations.forEach((anim) => anim.start());
    return () => animations.forEach((anim) => anim.stop());
  }, [state, ringProgress]);

  // Wave bar animations
  useEffect(() => {
    if (state !== 'listening' && state !== 'speaking') {
      waveBars.forEach((bar) => bar.setValue(0.3));
      return;
    }

    const animations = waveBars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 60),
          Animated.timing(bar, {
            toValue: 1,
            duration: 200 + index * 15,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.2,
            duration: 200 + index * 15,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      )
    );

    animations.forEach((anim) => anim.start());
    return () => animations.forEach((anim) => anim.stop());
  }, [state, waveBars]);

  const handleClose = async () => {
    await cancel();
    navigation.goBack();
  };

  const handlePressIn = async () => {
    if (state === 'idle' || state === 'error') {
      await startListening();
    }
  };

  const handlePressOut = async () => {
    if (state === 'listening') {
      await stopListening();
    }
  };

  const handleTap = async () => {
    if (state === 'speaking' || state === 'processing') {
      await cancel();
    }
  };

  const [describeStage, setDescribeStage] = useState<DescribeStage>('idle');
  const [describeText, setDescribeText] = useState<string>('');

  const handleDescribe = async () => {
    if (describeStage !== 'idle') {
      cameraDescribeService.cancel();
      setDescribeStage('idle');
      return;
    }
    try {
      // Stop any ongoing voice flow so the camera + describe is the only thing happening.
      await cancel();
      setDescribeText('');
      const result = await cameraDescribeService.captureAndDescribe(setDescribeStage);
      if (!result.cancelled) {
        setDescribeText(result.description);
      }
      setDescribeStage('idle');
    } catch (err) {
      setDescribeStage('idle');
      const message = err instanceof Error ? err.message : 'Could not describe the scene.';
      Alert.alert('Could not describe', message);
    }
  };

  const describeLabel =
    describeStage === 'capturing'
      ? 'Opening camera...'
      : describeStage === 'processing'
        ? 'Looking at your photo...'
        : describeStage === 'speaking'
          ? 'Describing... tap to stop'
          : 'Describe what is around me';

  const config = stateConfig[state];
  const isActive = state !== 'idle' && state !== 'error';

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={theme.subtitle} />
          </Pressable>
          <Text style={styles.headerTitle}>Cy Assistant</Text>
          <View style={styles.closeButton} />
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Status Text */}
          <View style={styles.statusContainer}>
            <Text style={[styles.statusText, { color: config.color }]}>
              {config.label}
            </Text>
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
          </View>

          {/* Orb */}
          <View style={styles.orbWrap}>
            {/* Ripple rings */}
            {ringProgress.map((progress, index) => (
              <Animated.View
                key={`ring-${index}`}
                style={[
                  styles.orbRipple,
                  {
                    borderColor: config.color,
                    opacity: progress.interpolate({
                      inputRange: [0, 0.2, 1],
                      outputRange: [0, 0.4, 0],
                    }),
                    transform: [
                      {
                        scale: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 2.2],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))}

            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handleTap}
            >
              <Animated.View
                style={[
                  styles.orbContainer,
                  { transform: [{ scale: idlePulse }] },
                ]}
              >
                <View style={[styles.orb, { backgroundColor: config.color }]}>
                  {isActive ? (
                    <Ionicons
                      name={config.icon as any}
                      size={56}
                      color="#FFFFFF"
                    />
                  ) : (
                    <View style={styles.siriGlyph}>
                      <View style={[styles.siriGlowDot, styles.siriGlowA]} />
                      <View style={[styles.siriGlowDot, styles.siriGlowB]} />
                      <View style={[styles.siriGlowDot, styles.siriGlowC]} />
                      <View style={[styles.siriGlowDot, styles.siriGlowD]} />
                      <View style={styles.siriCenter} />
                    </View>
                  )}
                </View>
              </Animated.View>
            </Pressable>
          </View>

          {/* Wave bars */}
          <View style={styles.waveRow}>
            {waveBars.map((bar, index) => (
              <Animated.View
                key={`bar-${index}`}
                style={[
                  styles.waveBar,
                  {
                    backgroundColor: config.color,
                    opacity: isActive ? 1 : 0.3,
                    transform: [{ scaleY: bar }],
                  },
                ]}
              />
            ))}
          </View>

          {/* Transcript & Response */}
          <View style={styles.textContainer}>
            {transcript ? (
              <View style={styles.transcriptBox}>
                <Text style={styles.transcriptLabel}>You said:</Text>
                <Text style={styles.transcriptText}>"{transcript}"</Text>
              </View>
            ) : null}

            {response ? (
              <View style={styles.responseBox}>
                <Text style={styles.responseLabel}>Cy:</Text>
                <Text style={styles.responseText}>{response}</Text>
              </View>
            ) : null}
          </View>

          {/* Describe-what's-around-me — accessibility-first scene description */}
          <Pressable
            onPress={handleDescribe}
            accessibilityRole="button"
            accessibilityLabel={
              describeStage === 'idle'
                ? 'Describe what is around you. Double-tap to take a photo and hear it described.'
                : describeStage === 'speaking'
                  ? 'Describing what is around you. Double-tap to stop.'
                  : 'Working on your photo. Double-tap to cancel.'
            }
            accessibilityHint="Opens the camera to take a photo, then describes the scene out loud."
            style={({ pressed }) => [
              styles.describeButton,
              describeStage !== 'idle' && styles.describeButtonActive,
              pressed && styles.describeButtonPressed,
            ]}
          >
            {describeStage === 'idle' ? (
              <Ionicons name="camera" size={22} color={theme.buttonText} />
            ) : (
              <ActivityIndicator size="small" color={theme.buttonText} />
            )}
            <Text style={styles.describeButtonText}>{describeLabel}</Text>
          </Pressable>

          {describeText ? (
            <View style={styles.describeResultBox}>
              <Text style={styles.describeResultLabel}>Cy sees:</Text>
              <Text style={styles.describeResultText}>{describeText}</Text>
            </View>
          ) : null}

          {/* Hint */}
          <View style={styles.hintRow}>
            <Ionicons
              name={state === 'listening' ? 'radio' : 'information-circle-outline'}
              size={16}
              color={state === 'listening' ? theme.listening : theme.hint}
            />
            <Text style={styles.hintText}>
              {state === 'listening'
                ? 'Release to submit'
                : state === 'speaking' || state === 'processing'
                ? 'Tap orb to cancel'
                : 'Hold the orb and speak'}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSolid,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.title,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  statusText: {
    fontSize: 24,
    fontWeight: '700',
  },
  errorText: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: theme.error,
  },
  orbWrap: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbRipple: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
  },
  orbContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.orbContainer,
    borderWidth: 2,
    borderColor: theme.orbContainerBorder,
    shadowColor: theme.orb,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  orb: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  siriGlyph: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF22',
  },
  siriGlowDot: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    opacity: 0.9,
  },
  siriGlowA: {
    backgroundColor: theme.dotA,
    top: 8,
    left: 22,
  },
  siriGlowB: {
    backgroundColor: theme.dotB,
    top: 22,
    right: 8,
  },
  siriGlowC: {
    backgroundColor: theme.dotC,
    top: 22,
    left: 8,
  },
  siriGlowD: {
    backgroundColor: theme.dotD,
    bottom: 8,
    left: 22,
  },
  siriCenter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFFDD',
  },
  waveRow: {
    marginTop: spacing.xl,
    height: 36,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  waveBar: {
    width: 6,
    height: 28,
    borderRadius: 3,
  },
  textContainer: {
    marginTop: spacing.xl,
    width: '100%',
    maxWidth: 340,
    minHeight: 120,
  },
  transcriptBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  transcriptLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.hint,
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 16,
    color: theme.title,
    fontStyle: 'italic',
  },
  responseBox: {
    backgroundColor: 'rgba(12, 159, 133, 0.1)',
    borderRadius: radii.lg,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.orb,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.orb,
    marginBottom: 4,
  },
  responseText: {
    fontSize: 16,
    color: theme.title,
    lineHeight: 22,
  },
  hintRow: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintText: {
    fontSize: 14,
    color: theme.hint,
  },
  describeButton: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 22,
    minHeight: 52, // Big touch target for accessibility (>= 44pt iOS HIG).
    borderRadius: radii.lg,
    backgroundColor: theme.button,
    shadowColor: theme.button,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  describeButtonActive: {
    backgroundColor: theme.buttonActive,
  },
  describeButtonPressed: {
    opacity: 0.85,
  },
  describeButtonText: {
    color: theme.buttonText,
    fontWeight: '700',
    fontSize: 15,
  },
  describeResultBox: {
    marginTop: spacing.md,
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'rgba(12, 159, 133, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: theme.orb,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  describeResultLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.orb,
    marginBottom: 4,
  },
  describeResultText: {
    fontSize: 15,
    color: theme.title,
    lineHeight: 21,
  },
});
