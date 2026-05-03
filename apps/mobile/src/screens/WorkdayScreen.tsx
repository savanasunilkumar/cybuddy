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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { apiService } from '../services/api';
import {
  WorkdayNotification,
  WorkdayActionItem,
  TuitionFee,
  StudentRecord,
} from '@cypilot/shared';
import { palette, radii, shadows, spacing } from '../theme/tokens';

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed':
    case 'paid':
      return palette.success;
    case 'overdue':
      return palette.danger;
    case 'in_progress':
      return palette.info;
    case 'waived':
      return palette.textMuted;
    default:
      return palette.warning;
  }
};

export const WorkdayScreen: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const actionItemsQuery = useQuery<WorkdayActionItem[]>({
    queryKey: ['workday', 'action-items'],
    queryFn: () => apiService.get<WorkdayActionItem[]>('/api/workday/action-items'),
  });

  const tuitionFeesQuery = useQuery<TuitionFee[]>({
    queryKey: ['workday', 'tuition-fees'],
    queryFn: () => apiService.get<TuitionFee[]>('/api/workday/tuition-fees'),
  });

  const studentRecordQuery = useQuery<StudentRecord>({
    queryKey: ['workday', 'student-record'],
    queryFn: () => apiService.get<StudentRecord>('/api/workday/student-record'),
  });

  const handleRefresh = () => {
    void actionItemsQuery.refetch();
    void tuitionFeesQuery.refetch();
    void studentRecordQuery.refetch();
  };

  const isLoading = actionItemsQuery.isLoading || tuitionFeesQuery.isLoading || studentRecordQuery.isLoading;
  const isRefreshing = actionItemsQuery.isRefetching || tuitionFeesQuery.isRefetching || studentRecordQuery.isRefetching;

  // Rich mock data
  const mockStudent: StudentRecord = {
    studentId: '123456789',
    name: 'Alex Johnson',
    email: 'ajohnson@iastate.edu',
    major: 'Computer Science',
    enrollmentStatus: 'active',
    academicLevel: 'undergraduate',
    creditHours: 15,
    holds: [],
  };

  const mockActionItems = [
    { id: '1', title: 'Submit Timesheet', description: 'Weekly timesheet for Research Assistant position', status: 'overdue' as const, dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
    { id: '2', title: 'Complete I-9 Verification', description: 'Employment eligibility verification required', status: 'pending' as const, dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
    { id: '3', title: 'Update Direct Deposit', description: 'Bank account information needs verification', status: 'pending' as const, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
    { id: '4', title: 'Complete FERPA Training', description: 'Required annual privacy training', status: 'pending' as const, dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() },
    { id: '5', title: 'Review Benefits Election', description: 'Open enrollment period ends soon', status: 'in_progress' as const, dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString() },
  ];

  const mockFees = [
    { term: 'Spring 2025', description: 'Tuition - In State', amount: 4298.00, dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), status: 'pending' as const },
    { term: 'Spring 2025', description: 'Technology Fee', amount: 236.00, dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), status: 'pending' as const },
    { term: 'Spring 2025', description: 'Student Services Fee', amount: 118.50, dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), status: 'pending' as const },
    { term: 'Fall 2024', description: 'Tuition - In State', amount: 4298.00, dueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), status: 'paid' as const },
    { term: 'Fall 2024', description: 'Lab Fee - COMS', amount: 50.00, dueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), status: 'paid' as const },
  ];

  const student = studentRecordQuery.data || mockStudent;
  // Use mock data if API returns less items (for demo purposes)
  const actionItems = (actionItemsQuery.data?.length ?? 0) >= mockActionItems.length ? actionItemsQuery.data! : mockActionItems;
  const fees = (tuitionFeesQuery.data?.length ?? 0) >= mockFees.length ? tuitionFeesQuery.data! : mockFees;

  const pendingActions = actionItems.filter(i => i.status === 'pending' || i.status === 'overdue').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing && !isLoading}
            onRefresh={handleRefresh}
            tintColor={palette.brand}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={[palette.workday, '#5B21B6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerGradient}
            >
              <View style={styles.headerContent}>
                <View style={styles.headerIcon}>
                  <Ionicons name="briefcase" size={24} color="#FFF" />
                </View>
                <Text style={styles.headerTitle}>Workday</Text>
                <Text style={styles.headerSubtitle}>Student Operations</Text>
              </View>
              <View style={styles.headerStats}>
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{pendingActions}</Text>
                  <Text style={styles.statLabel}>Actions</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{student.creditHours}</Text>
                  <Text style={styles.statLabel}>Credits</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Student Profile */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLeft}>
                <View style={[styles.sectionIcon, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="person" size={16} color={palette.workday} />
                </View>
                <Text style={styles.sectionTitle}>Profile</Text>
              </View>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{student.name.split(' ').map(n => n[0]).join('')}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{student.name}</Text>
                <Text style={styles.profileDetail}>{student.major || 'Undeclared'}</Text>
                <View style={styles.profileMeta}>
                  <View style={styles.profileTag}>
                    <Text style={styles.profileTagText}>{student.enrollmentStatus.charAt(0).toUpperCase() + student.enrollmentStatus.slice(1)}</Text>
                  </View>
                  <View style={styles.profileTag}>
                    <Text style={styles.profileTagText}>{student.academicLevel.charAt(0).toUpperCase() + student.academicLevel.slice(1)}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Action Items */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLeft}>
                <View style={[styles.sectionIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="alert-circle" size={16} color={palette.warning} />
                </View>
                <Text style={styles.sectionTitle}>Action Items</Text>
                {pendingActions > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pendingActions}</Text>
                  </View>
                )}
              </View>
            </View>

            {actionItems.length > 0 ? (
              <View style={styles.card}>
                {actionItems.map((item, index) => (
                  <Pressable key={item.id} style={[styles.actionItem, index > 0 && styles.itemBorder]}>
                    <View style={styles.actionContent}>
                      <Text style={styles.actionTitle}>{item.title}</Text>
                      <Text style={styles.actionDesc}>{item.description}</Text>
                      {item.dueDate && (
                        <Text style={styles.actionDue}>
                          Due {new Date(item.dueDate).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {item.status.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="checkmark-circle" size={48} color={palette.success} />
                <Text style={styles.emptyText}>No action items</Text>
              </View>
            )}
          </View>

          {/* Tuition & Fees */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLeft}>
                <View style={[styles.sectionIcon, { backgroundColor: '#D1FAE5' }]}>
                  <Ionicons name="card" size={16} color={palette.success} />
                </View>
                <Text style={styles.sectionTitle}>Tuition & Fees</Text>
              </View>
            </View>

            {fees.length > 0 ? (
              <View style={styles.card}>
                {fees.map((fee, index) => (
                  <View key={`${fee.term}-${index}`} style={[styles.feeItem, index > 0 && styles.itemBorder]}>
                    <View style={styles.feeContent}>
                      <Text style={styles.feeTerm}>{fee.term}</Text>
                      <Text style={styles.feeDesc}>{fee.description}</Text>
                      <Text style={styles.feeDue}>Due {new Date(fee.dueDate).toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.feeRight}>
                      <Text style={styles.feeAmount}>${fee.amount.toFixed(2)}</Text>
                      <View style={[styles.feeStatus, { backgroundColor: getStatusColor(fee.status) + '20' }]}>
                        <Text style={[styles.feeStatusText, { color: getStatusColor(fee.status) }]}>
                          {fee.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="wallet-outline" size={48} color={palette.success} />
                <Text style={styles.emptyText}>No fees due</Text>
              </View>
            )}
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: 120 },
  // Header
  header: { borderRadius: radii.xl, overflow: 'hidden', ...shadows.elevated },
  headerGradient: { padding: spacing.lg },
  headerContent: { marginBottom: spacing.md },
  headerIcon: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  headerStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radii.lg, padding: spacing.md },
  stat: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  // Section
  section: { marginTop: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionIcon: { width: 30, height: 30, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: palette.textPrimary },
  badge: { backgroundColor: palette.danger, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill, marginLeft: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  // Profile Card
  profileCard: { flexDirection: 'row', backgroundColor: palette.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, padding: spacing.md, ...shadows.soft },
  profileAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: palette.brandMuted, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  profileAvatarText: { fontSize: 20, fontWeight: '700', color: palette.brand },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: palette.textPrimary },
  profileDetail: { fontSize: 14, color: palette.textSecondary, marginTop: 2 },
  profileMeta: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  profileTag: { backgroundColor: palette.borderLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.xs },
  profileTagText: { fontSize: 11, fontWeight: '600', color: palette.textMuted },
  // Card
  card: { backgroundColor: palette.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, overflow: 'hidden', ...shadows.soft },
  itemBorder: { borderTopWidth: 1, borderTopColor: palette.borderLight },
  // Action Items
  actionItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '600', color: palette.textPrimary },
  actionDesc: { fontSize: 13, color: palette.textSecondary, marginTop: 2 },
  actionDue: { fontSize: 12, color: palette.textMuted, marginTop: spacing.xs },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.xs, marginLeft: spacing.sm },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  // Fee Items
  feeItem: { flexDirection: 'row', padding: spacing.md },
  feeContent: { flex: 1 },
  feeTerm: { fontSize: 15, fontWeight: '700', color: palette.textPrimary },
  feeDesc: { fontSize: 13, color: palette.textSecondary, marginTop: 2 },
  feeDue: { fontSize: 12, color: palette.textMuted, marginTop: spacing.xs },
  feeRight: { alignItems: 'flex-end' },
  feeAmount: { fontSize: 18, fontWeight: '800', color: palette.textPrimary },
  feeStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.xs, marginTop: spacing.xs },
  feeStatusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  // Empty
  emptyCard: { backgroundColor: palette.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 14, color: palette.textSecondary, marginTop: spacing.sm },
});
