import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '../theme/tokens';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Voice Overlay Context
interface VoiceOverlayContextType {
  isVisible: boolean;
  showVoice: () => void;
  hideVoice: () => void;
  toggleVoice: () => void;
}

const VoiceOverlayContext = createContext<VoiceOverlayContextType>({
  isVisible: false,
  showVoice: () => {},
  hideVoice: () => {},
  toggleVoice: () => {},
});

export const useVoiceOverlay = () => useContext(VoiceOverlayContext);

// Prism theme (default)
const theme = {
  background: 'rgba(244, 255, 249, 0.97)',
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
};

interface VoiceOverlayProviderProps {
  children: React.ReactNode;
}

export const VoiceOverlayProvider: React.FC<VoiceOverlayProviderProps> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const showVoice = () => setIsVisible(true);
  const hideVoice = () => {
    setIsListening(false);
    setIsVisible(false);
  };
  const toggleVoice = () => {
    if (isVisible) {
      hideVoice();
    } else {
      showVoice();
    }
  };

  // Animations
  const idlePulse = useRef(new Animated.Value(1)).current;
  const ringProgress = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const waveBars = useRef(Array.from({ length: 9 }, () => new Animated.Value(0.3))).current;
  const listeningAnimations = useRef<Animated.CompositeAnimation[]>([]);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Slide animation
  useEffect(() => {
    if (isVisible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 90,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, slideAnim]);

  // Idle pulse animation
  useEffect(() => {
    if (!isVisible) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(idlePulse, {
          toValue: 1.05,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(idlePulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [isVisible, idlePulse]);

  // Listening animations
  useEffect(() => {
    listeningAnimations.current.forEach((animation) => animation.stop());
    listeningAnimations.current = [];

    if (!isListening) {
      waveBars.forEach((bar) => bar.setValue(0.3));
      ringProgress.forEach((ring) => ring.setValue(0));
      return;
    }

    ringProgress.forEach((ring, index) => {
      const ringAnimation = Animated.loop(
        Animated.sequence([
          Animated.delay(index * 280),
          Animated.timing(ring, {
            toValue: 1,
            duration: 1700,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(ring, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      listeningAnimations.current.push(ringAnimation);
      ringAnimation.start();
    });

    waveBars.forEach((bar, index) => {
      const waveAnimation = Animated.loop(
        Animated.sequence([
          Animated.delay(index * 70),
          Animated.timing(bar, {
            toValue: 1.05,
            duration: 260 + index * 20,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.25,
            duration: 260 + index * 18,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      listeningAnimations.current.push(waveAnimation);
      waveAnimation.start();
    });

    return () => {
      listeningAnimations.current.forEach((animation) => animation.stop());
      listeningAnimations.current = [];
    };
  }, [isListening, ringProgress, waveBars]);

  return (
    <VoiceOverlayContext.Provider value={{ isVisible, showVoice, hideVoice, toggleVoice }}>
      {children}

      <Modal
        visible={isVisible}
        transparent
        animationType="none"
        onRequestClose={hideVoice}
        statusBarTranslucent
      >
        <View style={styles.modalContainer}>
          <Pressable style={styles.backdrop} onPress={hideVoice} />

          <Animated.View
            style={[
              styles.overlay,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Close button */}
            <Pressable onPress={hideVoice} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={theme.subtitle} />
            </Pressable>

            <View style={styles.content}>
              <Text style={styles.title}>How can I help?</Text>
              <Text style={styles.subtitle}>Hold the button and speak</Text>

              {/* Orb with animations */}
              <View style={styles.orbWrap}>
                {ringProgress.map((progress, index) => (
                  <Animated.View
                    key={`ring-${index}`}
                    style={[
                      styles.orbRipple,
                      {
                        backgroundColor: theme.ripple,
                        opacity: progress.interpolate({
                          inputRange: [0, 0.15, 1],
                          outputRange: [0, 0.22, 0],
                        }),
                        transform: [
                          {
                            scale: progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.9, 1.9],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                ))}

                <Animated.View
                  style={[
                    styles.orbContainer,
                    { transform: [{ scale: idlePulse }] },
                  ]}
                >
                  <View style={[styles.orb, { backgroundColor: isListening ? theme.orbActive : theme.orb }]}>
                    <View style={styles.siriGlyph}>
                      <View style={[styles.siriGlowDot, styles.siriGlowA, { backgroundColor: theme.dotA }]} />
                      <View style={[styles.siriGlowDot, styles.siriGlowB, { backgroundColor: theme.dotB }]} />
                      <View style={[styles.siriGlowDot, styles.siriGlowC, { backgroundColor: theme.dotC }]} />
                      <View style={[styles.siriGlowDot, styles.siriGlowD, { backgroundColor: theme.dotD }]} />
                      <View style={styles.siriCenter} />
                    </View>
                  </View>
                </Animated.View>
              </View>

              {/* Wave bars */}
              <View style={styles.waveRow}>
                {waveBars.map((bar, index) => (
                  <Animated.View
                    key={`bar-${index}`}
                    style={[
                      styles.waveBar,
                      {
                        backgroundColor: theme.wave,
                        opacity: isListening ? 1 : 0.45,
                        transform: [{ scaleY: bar }],
                      },
                    ]}
                  />
                ))}
              </View>

              {/* Action button */}
              <Pressable
                onPressIn={() => setIsListening(true)}
                onPressOut={() => setIsListening(false)}
                style={[
                  styles.actionButton,
                  { backgroundColor: isListening ? theme.buttonActive : theme.button },
                ]}
              >
                <Ionicons
                  name={isListening ? 'radio' : 'mic'}
                  size={20}
                  color={theme.buttonText}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.actionButtonText}>
                  {isListening ? 'Listening...' : 'Hold To Speak'}
                </Text>
              </Pressable>

              {/* Hint */}
              <View style={styles.hintRow}>
                <Ionicons
                  name={isListening ? 'radio' : 'information-circle-outline'}
                  size={14}
                  color={isListening ? '#22C55E' : theme.hint}
                />
                <Text style={[styles.caption, { color: theme.hint }]}>
                  {isListening ? 'Release to submit' : 'Ask about classes, buses, or campus info'}
                </Text>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </VoiceOverlayContext.Provider>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.background,
    borderTopLeftRadius: radii.xl + 8,
    borderTopRightRadius: radii.xl + 8,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 10,
    padding: spacing.xs,
  },
  content: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.title,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 15,
    color: theme.subtitle,
    textAlign: 'center',
  },
  orbWrap: {
    marginTop: spacing.lg,
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  orbRipple: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
  },
  orbContainer: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.orbContainer,
    borderWidth: 1,
    borderColor: theme.orbContainerBorder,
  },
  orb: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  siriGlyph: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF17',
  },
  siriGlowDot: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 999,
    opacity: 0.9,
  },
  siriGlowA: {
    top: 6,
    left: 18,
  },
  siriGlowB: {
    top: 18,
    right: 6,
  },
  siriGlowC: {
    top: 18,
    left: 6,
  },
  siriGlowD: {
    bottom: 6,
    left: 18,
  },
  siriCenter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFFD9',
  },
  waveRow: {
    marginTop: spacing.md,
    height: 28,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  waveBar: {
    width: 5,
    height: 22,
    borderRadius: 999,
  },
  actionButton: {
    marginTop: spacing.lg,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.buttonText,
  },
  hintRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  caption: {
    fontSize: 13,
    textAlign: 'center',
  },
});
