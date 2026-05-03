import React, { useState, useEffect, useRef } from 'react';
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { apiService } from '../services/api';
import { CanvasCourse, CanvasAssignment, StudentRecord, TuitionFee, WorkdayActionItem } from '@cypilot/shared';
import { palette, radii, shadows, spacing } from '../theme/tokens';

const formatDateTime = (value?: string): string => {
  if (!value) return 'No due date';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

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

type TabType = 'assignments' | 'courses' | 'profile' | 'finances';

export const AcademicsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('assignments');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  // Canvas queries
  const coursesQuery = useQuery<CanvasCourse[]>({
    queryKey: ['canvas', 'courses'],
    queryFn: () => apiService.get<CanvasCourse[]>('/api/canvas/courses'),
  });

  const assignmentsQuery = useQuery<CanvasAssignment[]>({
    queryKey: ['canvas', 'upcoming-assignments'],
    queryFn: () => apiService.get<CanvasAssignment[]>('/api/canvas/assignments/upcoming'),
  });

  // Workday queries
  const studentRecordQuery = useQuery<StudentRecord>({
    queryKey: ['workday', 'student-record'],
    queryFn: () => apiService.get<StudentRecord>('/api/workday/student-record'),
  });

  const tuitionFeesQuery = useQuery<TuitionFee[]>({
    queryKey: ['workday', 'tuition-fees'],
    queryFn: () => apiService.get<TuitionFee[]>('/api/workday/tuition-fees'),
  });

  const actionItemsQuery = useQuery<WorkdayActionItem[]>({
    queryKey: ['workday', 'action-items'],
    queryFn: () => apiService.get<WorkdayActionItem[]>('/api/workday/action-items'),
  });

  const handleRefresh = () => {
    void coursesQuery.refetch();
    void assignmentsQuery.refetch();
    void studentRecordQuery.refetch();
    void tuitionFeesQuery.refetch();
    void actionItemsQuery.refetch();
  };

  const isRefreshing = coursesQuery.isRefetching || assignmentsQuery.isRefetching ||
    studentRecordQuery.isRefetching || tuitionFeesQuery.isRefetching;

  // Rich mock data - Canvas
  const mockAssignments = [
    { id: 1, name: 'Lab 5: Binary Trees', courseId: 228, pointsPossible: 100, dueAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), submitted: false },
    { id: 2, name: 'Homework 7: AVL Trees', courseId: 228, pointsPossible: 50, dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), submitted: false },
    { id: 3, name: 'Problem Set 4: Eigenvalues', courseId: 207, pointsPossible: 50, dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), submitted: false },
    { id: 4, name: 'Sprint 3 Code Review', courseId: 319, pointsPossible: 25, dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), submitted: true },
    { id: 5, name: 'Reading Quiz: Chapter 8', courseId: 309, pointsPossible: 10, dueAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), submitted: false },
    { id: 6, name: 'Midterm Exam', courseId: 321, pointsPossible: 150, dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), submitted: false },
    { id: 7, name: 'Final Project Proposal', courseId: 319, pointsPossible: 100, dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), submitted: false },
    { id: 8, name: 'Lab 6: Heaps & Priority Queues', courseId: 228, pointsPossible: 100, dueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), submitted: false },
    { id: 9, name: 'Group Presentation', courseId: 309, pointsPossible: 75, dueAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(), submitted: false },
  ];

  const mockCourses = [
    { id: 228, name: 'Introduction to Data Structures', courseCode: 'COM S 228', term: 'Spring 2025', instructor: 'Dr. Smith', schedule: 'MWF 9:00-9:50 AM', room: 'Pearson 1050' },
    { id: 207, name: 'Matrices and Linear Algebra', courseCode: 'MATH 207', term: 'Spring 2025', instructor: 'Prof. Johnson', schedule: 'TR 10:00-11:15 AM', room: 'Carver 0001' },
    { id: 319, name: 'Software Construction and UI', courseCode: 'SE 319', term: 'Spring 2025', instructor: 'Dr. Williams', schedule: 'MWF 1:00-1:50 PM', room: 'Coover 2245' },
    { id: 309, name: 'Software Development Practices', courseCode: 'COM S 309', term: 'Spring 2025', instructor: 'Dr. Chen', schedule: 'TR 2:00-3:15 PM', room: 'Gilman 1352' },
    { id: 321, name: 'Operating Systems', courseCode: 'COM S 321', term: 'Spring 2025', instructor: 'Prof. Davis', schedule: 'MWF 11:00-11:50 AM', room: 'Hoover 1213' },
  ];

  // Rich mock data - Workday
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

  const mockFees = [
    { term: 'Spring 2025', description: 'Tuition - In State', amount: 4298.00, dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), status: 'pending' as const },
    { term: 'Spring 2025', description: 'Technology Fee', amount: 236.00, dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), status: 'pending' as const },
    { term: 'Spring 2025', description: 'Student Services Fee', amount: 118.50, dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), status: 'pending' as const },
    { term: 'Spring 2025', description: 'Health Fee', amount: 95.00, dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), status: 'pending' as const },
    { term: 'Fall 2024', description: 'Tuition - In State', amount: 4298.00, dueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), status: 'paid' as const },
    { term: 'Fall 2024', description: 'Technology Fee', amount: 236.00, dueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), status: 'paid' as const },
    { term: 'Fall 2024', description: 'Lab Fee - COMS', amount: 50.00, dueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), status: 'paid' as const },
  ];

  const mockActionItems = [
    { id: '1', title: 'Submit Timesheet', description: 'Weekly timesheet for TA position', status: 'overdue' as const, dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
    { id: '2', title: 'Complete FERPA Training', description: 'Required annual privacy training', status: 'pending' as const, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
    { id: '3', title: 'Update Emergency Contact', description: 'Emergency contact info needs verification', status: 'pending' as const, dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() },
  ];

  // Use mock data if API returns less items (for demo purposes)
  const assignments = (assignmentsQuery.data?.length ?? 0) >= mockAssignments.length ? assignmentsQuery.data! : mockAssignments;
  const courses = (coursesQuery.data?.length ?? 0) >= mockCourses.length ? coursesQuery.data! : mockCourses;
  const student = studentRecordQuery.data || mockStudent;
  const fees = (tuitionFeesQuery.data?.length ?? 0) >= mockFees.length ? tuitionFeesQuery.data! : mockFees;
  const actionItems = (actionItemsQuery.data?.length ?? 0) >= mockActionItems.length ? actionItemsQuery.data! : mockActionItems;

  const courseColors = ['#E65100', '#7C3AED', '#0C9F85', '#DC2626', '#059669'];
  const getCourseColor = (id: number) => courseColors[id % courseColors.length];

  const pendingFees = fees.filter(f => f.status === 'pending');
  const totalPending = pendingFees.reduce((sum, f) => sum + f.amount, 0);
  const pendingActions = actionItems.filter(i => i.status === 'pending' || i.status === 'overdue').length;

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'assignments', label: 'Tasks', icon: 'document-text' },
    { key: 'courses', label: 'Courses', icon: 'book' },
    { key: 'profile', label: 'Profile', icon: 'person' },
    { key: 'finances', label: 'Finances', icon: 'card' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={palette.brand}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={[palette.brand, palette.brandDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerGradient}
            >
              <View style={styles.headerContent}>
                <View style={styles.headerIcon}>
                  <Ionicons name="school" size={24} color="#FFF" />
                </View>
                <Text style={styles.headerTitle}>Academics</Text>
                <Text style={styles.headerSubtitle}>Canvas & Workday</Text>
              </View>
              <View style={styles.headerStats}>
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{assignments.length}</Text>
                  <Text style={styles.statLabel}>Assignments</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{courses.length}</Text>
                  <Text style={styles.statLabel}>Courses</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{student.creditHours}</Text>
                  <Text style={styles.statLabel}>Credits</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {tabs.map((tab) => (
              <Pressable
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={16}
                  color={activeTab === tab.key ? palette.brand : palette.textMuted}
                />
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Assignments Tab */}
          {activeTab === 'assignments' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="clipboard-check-outline" size={18} color={palette.canvas} />
                <Text style={styles.sectionTitle}>Upcoming Assignments</Text>
              </View>
              {assignments.length > 0 ? (
                <View style={styles.card}>
                  {assignments.map((assignment: any, index) => {
                    const isUrgent = new Date(assignment.dueAt || '').getTime() - Date.now() < 48 * 60 * 60 * 1000;
                    return (
                      <Pressable key={assignment.id} style={[styles.assignmentItem, index > 0 && styles.itemBorder]}>
                        <View style={[styles.dot, { backgroundColor: isUrgent ? palette.danger : getCourseColor(assignment.courseId) }]} />
                        <View style={styles.itemContent}>
                          <Text style={styles.itemTitle}>{assignment.name}</Text>
                          <Text style={styles.itemSub}>{assignment.pointsPossible} pts</Text>
                        </View>
                        <View style={styles.itemRight}>
                          <Text style={[styles.itemMeta, isUrgent && styles.itemMetaUrgent]}>
                            {formatDateTime(assignment.dueAt)}
                          </Text>
                          {assignment.submitted && (
                            <View style={styles.submittedBadge}>
                              <Ionicons name="checkmark" size={10} color="#FFF" />
                            </View>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="checkmark-circle" size={48} color={palette.success} />
                  <Text style={styles.emptyText}>No assignments due soon</Text>
                </View>
              )}

              {/* Action Items from Workday */}
              {actionItems.length > 0 && (
                <>
                  <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
                    <MaterialCommunityIcons name="clipboard-alert-outline" size={18} color={palette.workday} />
                    <Text style={styles.sectionTitle}>Action Items</Text>
                    {pendingActions > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{pendingActions}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.card}>
                    {actionItems.map((item, index) => (
                      <View key={item.id} style={[styles.actionItem, index > 0 && styles.itemBorder]}>
                        <View style={styles.actionContent}>
                          <Text style={styles.itemTitle}>{item.title}</Text>
                          <Text style={styles.itemSub}>{item.description}</Text>
                          {item.dueDate && (
                            <Text style={styles.actionDue}>Due {new Date(item.dueDate).toLocaleDateString()}</Text>
                          )}
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                            {item.status.replace('_', ' ').toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {/* Courses Tab */}
          {activeTab === 'courses' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="book-open-variant" size={18} color={palette.canvas} />
                <Text style={styles.sectionTitle}>Current Semester</Text>
              </View>
              {courses.length > 0 ? (
                <View style={styles.coursesGrid}>
                  {courses.map((course: any) => (
                    <View key={course.id} style={styles.courseCard}>
                      <View style={[styles.courseAccent, { backgroundColor: getCourseColor(course.id) }]} />
                      <View style={styles.courseContent}>
                        <Text style={styles.courseCode}>{course.courseCode}</Text>
                        <Text style={styles.courseName} numberOfLines={2}>{course.name}</Text>
                        {course.instructor && (
                          <Text style={styles.courseInstructor}>{course.instructor}</Text>
                        )}
                        {course.schedule && (
                          <View style={styles.courseMeta}>
                            <Ionicons name="time-outline" size={12} color={palette.textMuted} />
                            <Text style={styles.courseMetaText}>{course.schedule}</Text>
                          </View>
                        )}
                        {course.room && (
                          <View style={styles.courseMeta}>
                            <Ionicons name="location-outline" size={12} color={palette.textMuted} />
                            <Text style={styles.courseMetaText}>{course.room}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="book-outline" size={48} color={palette.textMuted} />
                  <Text style={styles.emptyText}>No courses found</Text>
                </View>
              )}
            </View>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="account-circle-outline" size={18} color={palette.workday} />
                <Text style={styles.sectionTitle}>Student Information</Text>
              </View>
              <View style={styles.profileCard}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>
                    {student.name.split(' ').map(n => n[0]).join('')}
                  </Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{student.name}</Text>
                  <Text style={styles.profileEmail}>{student.email}</Text>
                  <View style={styles.profileTags}>
                    <View style={styles.profileTag}>
                      <Text style={styles.profileTagText}>{student.major || 'Undeclared'}</Text>
                    </View>
                    <View style={styles.profileTag}>
                      <Text style={styles.profileTagText}>{student.academicLevel}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoCard}>
                  <Ionicons name="school-outline" size={24} color={palette.brand} />
                  <Text style={styles.infoValue}>{student.creditHours}</Text>
                  <Text style={styles.infoLabel}>Credit Hours</Text>
                </View>
                <View style={styles.infoCard}>
                  <Ionicons name="checkmark-circle-outline" size={24} color={palette.success} />
                  <Text style={styles.infoValue}>{student.enrollmentStatus}</Text>
                  <Text style={styles.infoLabel}>Status</Text>
                </View>
                <View style={styles.infoCard}>
                  <Ionicons name="ribbon-outline" size={24} color={palette.workday} />
                  <Text style={styles.infoValue}>{student.holds?.length || 0}</Text>
                  <Text style={styles.infoLabel}>Holds</Text>
                </View>
                <View style={styles.infoCard}>
                  <Ionicons name="id-card-outline" size={24} color={palette.canvas} />
                  <Text style={styles.infoValue}>{student.studentId.slice(-4)}</Text>
                  <Text style={styles.infoLabel}>ID (last 4)</Text>
                </View>
              </View>
            </View>
          )}

          {/* Finances Tab */}
          {activeTab === 'finances' && (
            <View style={styles.section}>
              {/* Balance Summary */}
              <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Amount Due</Text>
                <Text style={styles.balanceAmount}>${totalPending.toFixed(2)}</Text>
                <Text style={styles.balanceDue}>
                  Due {pendingFees[0] ? new Date(pendingFees[0].dueDate).toLocaleDateString() : 'N/A'}
                </Text>
              </View>

              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="receipt" size={18} color={palette.workday} />
                <Text style={styles.sectionTitle}>Tuition & Fees</Text>
              </View>
              <View style={styles.card}>
                {fees.map((fee, index) => (
                  <View key={`${fee.term}-${index}`} style={[styles.feeItem, index > 0 && styles.itemBorder]}>
                    <View style={styles.feeContent}>
                      <Text style={styles.feeTerm}>{fee.term}</Text>
                      <Text style={styles.feeDesc}>{fee.description}</Text>
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
            </View>
          )}

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
  statNumber: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  // Tabs
  tabs: { flexDirection: 'row', backgroundColor: palette.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, padding: 4, marginTop: spacing.lg },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.sm, borderRadius: radii.md },
  tabActive: { backgroundColor: palette.brandMuted },
  tabText: { fontSize: 12, fontWeight: '600', color: palette.textMuted },
  tabTextActive: { color: palette.brand },
  // Section
  section: { marginTop: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: palette.textPrimary },
  badge: { backgroundColor: palette.danger, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill, marginLeft: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  // Card
  card: { backgroundColor: palette.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, overflow: 'hidden', ...shadows.soft },
  assignmentItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  itemBorder: { borderTopWidth: 1, borderTopColor: palette.borderLight },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: palette.textPrimary },
  itemSub: { fontSize: 13, color: palette.textSecondary, marginTop: 2 },
  itemRight: { marginLeft: spacing.sm, alignItems: 'flex-end' },
  itemMeta: { fontSize: 12, color: palette.textMuted, textAlign: 'right' },
  itemMetaUrgent: { color: palette.danger, fontWeight: '600' },
  submittedBadge: { backgroundColor: palette.success, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  // Action Items
  actionItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  actionContent: { flex: 1 },
  actionDue: { fontSize: 12, color: palette.textMuted, marginTop: spacing.xs },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.xs, marginLeft: spacing.sm },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  // Courses
  coursesGrid: { gap: spacing.sm },
  courseCard: { flexDirection: 'row', backgroundColor: palette.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, overflow: 'hidden', ...shadows.soft },
  courseAccent: { width: 6 },
  courseContent: { flex: 1, padding: spacing.md },
  courseCode: { fontSize: 12, fontWeight: '700', color: palette.textMuted, letterSpacing: 0.5 },
  courseName: { fontSize: 15, fontWeight: '600', color: palette.textPrimary, marginTop: 4 },
  courseInstructor: { fontSize: 13, color: palette.textSecondary, marginTop: 4 },
  courseMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  courseMetaText: { fontSize: 12, color: palette.textMuted },
  // Profile
  profileCard: { flexDirection: 'row', backgroundColor: palette.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, padding: spacing.md, ...shadows.soft },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: palette.brandMuted, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  profileAvatarText: { fontSize: 24, fontWeight: '700', color: palette.brand },
  profileInfo: { flex: 1, justifyContent: 'center' },
  profileName: { fontSize: 18, fontWeight: '700', color: palette.textPrimary },
  profileEmail: { fontSize: 13, color: palette.textSecondary, marginTop: 2 },
  profileTags: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' },
  profileTag: { backgroundColor: palette.borderLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.xs },
  profileTagText: { fontSize: 11, fontWeight: '600', color: palette.textMuted, textTransform: 'capitalize' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  infoCard: { flex: 1, minWidth: '45%', backgroundColor: palette.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, padding: spacing.md, alignItems: 'center', ...shadows.soft },
  infoValue: { fontSize: 18, fontWeight: '800', color: palette.textPrimary, marginTop: spacing.xs, textTransform: 'capitalize' },
  infoLabel: { fontSize: 12, color: palette.textMuted, marginTop: 2 },
  // Balance
  balanceCard: { backgroundColor: palette.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md, ...shadows.soft },
  balanceLabel: { fontSize: 14, color: palette.textSecondary },
  balanceAmount: { fontSize: 32, fontWeight: '800', color: palette.textPrimary, marginTop: spacing.xs },
  balanceDue: { fontSize: 13, color: palette.textMuted, marginTop: spacing.xs },
  // Fees
  feeItem: { flexDirection: 'row', padding: spacing.md },
  feeContent: { flex: 1 },
  feeTerm: { fontSize: 12, fontWeight: '700', color: palette.textMuted, letterSpacing: 0.5 },
  feeDesc: { fontSize: 14, fontWeight: '600', color: palette.textPrimary, marginTop: 2 },
  feeRight: { alignItems: 'flex-end' },
  feeAmount: { fontSize: 16, fontWeight: '700', color: palette.textPrimary },
  feeStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.xs, marginTop: spacing.xs },
  feeStatusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  // Empty
  emptyCard: { backgroundColor: palette.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 14, color: palette.textSecondary, marginTop: spacing.sm },
});
