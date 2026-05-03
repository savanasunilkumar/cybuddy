import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';

import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { DashboardData } from '@cypilot/shared';
import { palette, radii, shadows, spacing } from '../theme/tokens';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export const DashboardScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation<any>();
  const firstName = user?.name?.split(' ')[0] || 'Cyclone';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const { data: dashboardData, error, refetch, isRefetching, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => apiService.get<DashboardData>('/api/dashboard'),
    refetchInterval: 5 * 60 * 1000,
  });

  // Rich mock data
  const schedule = [
    { id: 1, name: 'Data Structures', code: 'COM S 228', time: '10:00 AM', room: 'Pearson 1050', color: '#DC2626', professor: 'Dr. Smith', minutesUntil: 45 },
    { id: 2, name: 'Linear Algebra', code: 'MATH 207', time: '1:00 PM', room: 'Carver 101', color: '#7C3AED', professor: 'Dr. Chen' },
    { id: 3, name: 'Software Engineering', code: 'SE 319', time: '3:30 PM', room: 'Coover 2245', color: '#059669', professor: 'Dr. Williams' },
  ];

  const assignments = [
    { id: 1, title: 'Lab 5: Binary Trees', course: 'COM S 228', due: 'Tomorrow 11:59 PM', points: 100, submitted: false, urgent: true },
    { id: 2, title: 'Problem Set 4', course: 'MATH 207', due: 'Friday 5:00 PM', points: 50, submitted: false, urgent: false },
    { id: 3, title: 'Sprint Review', course: 'SE 319', due: 'Sunday 11:59 PM', points: 25, submitted: false, urgent: false },
    { id: 4, title: 'Reading Quiz 6', course: 'ENGL 250', due: 'Thursday 8:00 AM', points: 10, submitted: true, urgent: false },
  ];

  const emails = [
    { id: 1, from: 'Prof. Smith', subject: 'Office Hours Cancelled Tomorrow', preview: 'Hi all, I need to cancel my office hours this Thursday...', time: '2h ago', unread: true, important: true },
    { id: 2, from: 'ISU Career Services', subject: 'Spring Career Fair - Register Now!', preview: 'Over 200 companies attending! Register by March 15...', time: '4h ago', unread: true, important: false },
    { id: 3, from: 'COM S 228 TA', subject: 'Re: Lab 5 Question', preview: 'Yes, you can use recursion for the traversal...', time: '1d ago', unread: false, important: false },
    { id: 4, from: 'Dining Services', subject: 'New Hours at UDCC', preview: 'Starting next week, UDCC will have extended hours...', time: '2d ago', unread: false, important: false },
  ];

  const workdayItems = [
    { id: 1, title: 'Complete I-9 Verification', type: 'Required', due: 'March 20', urgent: true },
    { id: 2, title: 'Submit Timesheet', type: 'Weekly', due: 'Friday 5 PM', urgent: false },
    { id: 3, title: 'Review Benefits', type: 'Optional', due: null, urgent: false },
  ];

  const buses = [
    { route: '23 Red', stop: 'Memorial Union', minutes: 3, nextMinutes: 18 },
    { route: '6 Brown', stop: 'Parks Library', minutes: 7, nextMinutes: 22 },
  ];


  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorWrap}>
          <LottieView source={require('../../assets/animations/bus.json')} autoPlay loop style={{ width: 100, height: 100 }} />
          <Text style={styles.errorTitle}>Connection Lost</Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const nextClass = schedule[0];
  const unreadCount = emails.filter(e => e.unread).length;
  const pendingAssignments = assignments.filter(a => !a.submitted).length;
  const urgentActions = workdayItems.filter(w => w.urgent).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={() => refetch()} tintColor={palette.brand} />}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.greeting}>{getGreeting()}, <Text style={styles.name}>{firstName}</Text></Text>
            <Pressable onPress={logout}>
              <LinearGradient colors={[palette.brand, palette.brandDark]} style={styles.avatar}>
                <Text style={styles.avatarText}>{firstName[0]}</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Next Class */}
          <Pressable style={styles.nextClass}>
            <LinearGradient colors={[nextClass.color, nextClass.color + 'CC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.nextClassGradient}>
              <View style={styles.nextClassBadge}>
                <Ionicons name="time" size={12} color={nextClass.color} />
                <Text style={[styles.nextClassBadgeText, { color: nextClass.color }]}>in {nextClass.minutesUntil} min</Text>
              </View>
              <Text style={styles.nextClassName}>{nextClass.name}</Text>
              <Text style={styles.nextClassCode}>{nextClass.code} · {nextClass.professor}</Text>
              <View style={styles.nextClassFooter}>
                <View style={styles.nextClassLoc}>
                  <Ionicons name="location" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.nextClassLocText}>{nextClass.room}</Text>
                </View>
                <Text style={styles.nextClassTime}>{nextClass.time}</Text>
              </View>
            </LinearGradient>
          </Pressable>

          {/* CyRide */}
          <Pressable style={styles.section} onPress={() => navigation.navigate('CyRide')}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLeft}>
                <MaterialCommunityIcons name="bus" size={20} color={palette.cyride} />
                <Text style={styles.sectionTitle}>CyRide</Text>
                <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
            </View>
            {buses.map((bus, i) => (
              <View key={i} style={[styles.busRow, i > 0 && { borderTopWidth: 1, borderTopColor: palette.borderLight }]}>
                <View style={styles.busInfo}>
                  <Text style={styles.busRoute}>{bus.route}</Text>
                  <Text style={styles.busStop}>{bus.stop}</Text>
                </View>
                <View style={styles.busTimes}>
                  <Text style={styles.busMin}>{bus.minutes}<Text style={styles.busMinLabel}> min</Text></Text>
                  <Text style={styles.busNext}>then {bus.nextMinutes} min</Text>
                </View>
              </View>
            ))}
          </Pressable>

          {/* Canvas / Assignments */}
          <Pressable style={styles.section} onPress={() => navigation.navigate('Academics')}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLeft}>
                <MaterialCommunityIcons name="school" size={20} color={palette.canvas} />
                <Text style={styles.sectionTitle}>Canvas</Text>
                <View style={styles.badge}><Text style={styles.badgeText}>{pendingAssignments}</Text></View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
            </View>
            {assignments.slice(0, 3).map((a, i) => (
              <View key={a.id} style={[styles.assignRow, i > 0 && { borderTopWidth: 1, borderTopColor: palette.borderLight }]}>
                <View style={[styles.assignDot, { backgroundColor: a.urgent ? palette.danger : a.submitted ? palette.success : palette.textMuted }]} />
                <View style={styles.assignInfo}>
                  <Text style={[styles.assignTitle, a.submitted && styles.assignDone]}>{a.title}</Text>
                  <Text style={styles.assignMeta}>{a.course} · {a.points} pts</Text>
                </View>
                <Text style={[styles.assignDue, a.urgent && styles.assignUrgent]}>{a.submitted ? '✓ Done' : a.due.split(' ')[0]}</Text>
              </View>
            ))}
          </Pressable>

          {/* Outlook / Mail */}
          <Pressable style={styles.section} onPress={() => navigation.navigate('Outlook')}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLeft}>
                <MaterialCommunityIcons name="microsoft-outlook" size={20} color={palette.outlook} />
                <Text style={styles.sectionTitle}>Outlook</Text>
                {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>}
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
            </View>
            {emails.slice(0, 3).map((e, i) => (
              <View key={e.id} style={[styles.emailRow, i > 0 && { borderTopWidth: 1, borderTopColor: palette.borderLight }]}>
                <View style={[styles.emailAvatar, e.unread && styles.emailAvatarUnread]}>
                  <Text style={[styles.emailAvatarText, e.unread && styles.emailAvatarTextUnread]}>{e.from[0]}</Text>
                </View>
                <View style={styles.emailInfo}>
                  <View style={styles.emailTop}>
                    <Text style={[styles.emailFrom, e.unread && styles.emailFromUnread]}>{e.from}</Text>
                    <Text style={styles.emailTime}>{e.time}</Text>
                  </View>
                  <Text style={[styles.emailSubject, e.unread && styles.emailSubjectUnread]} numberOfLines={1}>{e.subject}</Text>
                  <Text style={styles.emailPreview} numberOfLines={1}>{e.preview}</Text>
                </View>
                {e.important && <Ionicons name="flag" size={14} color={palette.danger} style={{ marginLeft: 8 }} />}
              </View>
            ))}
          </Pressable>

          {/* Workday */}
          <Pressable style={styles.section} onPress={() => navigation.navigate('Workday')}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLeft}>
                <FontAwesome5 name="briefcase" size={18} color={palette.workday} />
                <Text style={styles.sectionTitle}>Workday</Text>
                {urgentActions > 0 && <View style={[styles.badge, { backgroundColor: palette.warning }]}><Text style={styles.badgeText}>{urgentActions}</Text></View>}
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
            </View>
            {workdayItems.map((w, i) => (
              <View key={w.id} style={[styles.workdayRow, i > 0 && { borderTopWidth: 1, borderTopColor: palette.borderLight }]}>
                <View style={styles.workdayInfo}>
                  <Text style={styles.workdayTitle}>{w.title}</Text>
                  <Text style={styles.workdayMeta}>{w.type}{w.due ? ` · Due ${w.due}` : ''}</Text>
                </View>
                {w.urgent && <View style={styles.actionBadge}><Text style={styles.actionBadgeText}>Action</Text></View>}
              </View>
            ))}
          </Pressable>

          {/* Today's Schedule */}
          <View style={styles.section}>
            <Text style={styles.sectionTitleOnly}>Today's Schedule</Text>
            {schedule.map((c, i) => (
              <View key={c.id} style={styles.scheduleRow}>
                <View style={styles.scheduleTime}>
                  <Text style={styles.scheduleTimeText}>{c.time.split(' ')[0]}</Text>
                  <Text style={styles.scheduleAmPm}>{c.time.split(' ')[1]}</Text>
                </View>
                <View style={styles.scheduleLine}>
                  <View style={[styles.scheduleDot, { backgroundColor: c.color }]} />
                  {i < schedule.length - 1 && <View style={styles.scheduleConnector} />}
                </View>
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleName}>{c.name}</Text>
                  <Text style={styles.scheduleDetails}>{c.room} · {c.professor}</Text>
                </View>
              </View>
            ))}
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: spacing.md, paddingBottom: 120 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorTitle: { fontSize: 18, fontWeight: '600', color: palette.textPrimary, marginTop: 12 },
  retryBtn: { marginTop: 16, backgroundColor: palette.brand, paddingHorizontal: 24, paddingVertical: 10, borderRadius: radii.md },
  retryText: { color: '#FFF', fontWeight: '600' },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  greeting: { fontSize: 20, color: palette.textSecondary },
  name: { fontSize: 20, fontWeight: '800', color: palette.textPrimary },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  // Next Class
  nextClass: { borderRadius: radii.xl, overflow: 'hidden', marginBottom: spacing.md, ...shadows.elevated },
  nextClassGradient: { padding: spacing.lg },
  nextClassBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, gap: 4, marginBottom: spacing.sm },
  nextClassBadgeText: { fontSize: 12, fontWeight: '700' },
  nextClassName: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  nextClassCode: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  nextClassFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  nextClassLoc: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nextClassLocText: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  nextClassTime: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  // Section
  section: { backgroundColor: palette.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, marginBottom: spacing.md, overflow: 'hidden', ...shadows.soft },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.borderLight },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: palette.textPrimary },
  sectionTitleOnly: { fontSize: 16, fontWeight: '700', color: palette.textPrimary, padding: spacing.md, paddingBottom: spacing.sm },
  badge: { backgroundColor: palette.danger, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.success, marginLeft: 8 },
  liveText: { fontSize: 10, fontWeight: '700', color: palette.success, marginLeft: 4 },
  // Bus
  busRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  busInfo: { flex: 1 },
  busRoute: { fontSize: 15, fontWeight: '600', color: palette.textPrimary },
  busStop: { fontSize: 13, color: palette.textSecondary, marginTop: 1 },
  busTimes: { alignItems: 'flex-end' },
  busMin: { fontSize: 20, fontWeight: '800', color: palette.brand },
  busMinLabel: { fontSize: 12, fontWeight: '400', color: palette.textMuted },
  busNext: { fontSize: 11, color: palette.textMuted },
  // Assignments
  assignRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  assignDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  assignInfo: { flex: 1 },
  assignTitle: { fontSize: 15, fontWeight: '500', color: palette.textPrimary },
  assignDone: { textDecorationLine: 'line-through', color: palette.textMuted },
  assignMeta: { fontSize: 12, color: palette.textSecondary, marginTop: 1 },
  assignDue: { fontSize: 12, color: palette.textMuted },
  assignUrgent: { color: palette.danger, fontWeight: '600' },
  // Email
  emailRow: { flexDirection: 'row', padding: spacing.md },
  emailAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.borderLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  emailAvatarUnread: { backgroundColor: palette.brandMuted },
  emailAvatarText: { fontSize: 14, fontWeight: '600', color: palette.textMuted },
  emailAvatarTextUnread: { color: palette.brand },
  emailInfo: { flex: 1 },
  emailTop: { flexDirection: 'row', justifyContent: 'space-between' },
  emailFrom: { fontSize: 14, fontWeight: '500', color: palette.textPrimary },
  emailFromUnread: { fontWeight: '700' },
  emailTime: { fontSize: 11, color: palette.textMuted },
  emailSubject: { fontSize: 13, color: palette.textSecondary, marginTop: 1 },
  emailSubjectUnread: { color: palette.textPrimary, fontWeight: '600' },
  emailPreview: { fontSize: 12, color: palette.textMuted, marginTop: 2 },
  // Workday
  workdayRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  workdayInfo: { flex: 1 },
  workdayTitle: { fontSize: 15, fontWeight: '500', color: palette.textPrimary },
  workdayMeta: { fontSize: 12, color: palette.textSecondary, marginTop: 1 },
  actionBadge: { backgroundColor: palette.warning, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.xs },
  actionBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  // Schedule
  scheduleRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  scheduleTime: { width: 50, alignItems: 'flex-end', marginRight: spacing.sm },
  scheduleTimeText: { fontSize: 14, fontWeight: '600', color: palette.textPrimary },
  scheduleAmPm: { fontSize: 10, color: palette.textMuted },
  scheduleLine: { alignItems: 'center', width: 20 },
  scheduleDot: { width: 10, height: 10, borderRadius: 5 },
  scheduleConnector: { width: 2, flex: 1, backgroundColor: palette.borderLight, marginVertical: 4 },
  scheduleInfo: { flex: 1, paddingBottom: spacing.md },
  scheduleName: { fontSize: 15, fontWeight: '600', color: palette.textPrimary },
  scheduleDetails: { fontSize: 12, color: palette.textSecondary, marginTop: 1 },
});
