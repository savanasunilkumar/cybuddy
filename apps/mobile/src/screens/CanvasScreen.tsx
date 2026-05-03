import React from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { apiService } from '../services/api';
import { CanvasCourse, CanvasAssignment } from '@cypilot/shared';
import { palette, radii, shadows, spacing } from '../theme/tokens';

const formatDate = (value?: string): string => {
  if (!value) return 'No due date';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const CanvasScreen: React.FC = () => {
  const {
    data: courses,
    isLoading: coursesLoading,
    refetch: refetchCourses,
    isRefetching: coursesRefetching,
  } = useQuery<CanvasCourse[]>({
    queryKey: ['canvas', 'courses'],
    queryFn: () => apiService.get<CanvasCourse[]>('/api/canvas/courses'),
  });

  const {
    data: upcomingAssignments,
    isLoading: assignmentsLoading,
    refetch: refetchAssignments,
    isRefetching: assignmentsRefetching,
  } = useQuery<CanvasAssignment[]>({
    queryKey: ['canvas', 'upcoming-assignments'],
    queryFn: () => apiService.get<CanvasAssignment[]>('/api/canvas/assignments/upcoming'),
  });

  const handleRefresh = () => {
    void refetchCourses();
    void refetchAssignments();
  };

  const isRefreshing = coursesRefetching || assignmentsRefetching;
  const isLoading = coursesLoading || assignmentsLoading;

  return (
    <SafeAreaView style={styles.container}>
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
        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <Ionicons name="school-outline" size={14} color={palette.canvas} />
            <Text style={styles.headerBadgeText}>Canvas</Text>
          </View>
          <Text style={styles.headerTitle}>Course Activity</Text>
          <Text style={styles.headerSubtitle}>
            Assignments and course updates in one view.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Assignments</Text>
          {isLoading && !upcomingAssignments ? (
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderText}>Loading assignments...</Text>
            </View>
          ) : upcomingAssignments?.length ? (
            upcomingAssignments.map((assignment) => (
              <View key={assignment.id} style={styles.assignmentCard}>
                <View style={styles.assignmentTopRow}>
                  <Text style={styles.assignmentName}>{assignment.name}</Text>
                  <Text style={styles.assignmentPoints}>{assignment.pointsPossible} pts</Text>
                </View>
                <Text style={styles.assignmentMeta}>Course #{assignment.courseId}</Text>
                <View style={styles.assignmentDueRow}>
                  <Ionicons name="time-outline" size={14} color={palette.textMuted} />
                  <Text style={styles.assignmentDueText}>{formatDate(assignment.dueAt)}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderText}>No assignments due soon.</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Courses</Text>
          {isLoading && !courses ? (
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderText}>Loading courses...</Text>
            </View>
          ) : courses?.length ? (
            courses.map((course) => (
              <View key={course.id} style={styles.courseCard}>
                <Text style={styles.courseName}>{course.name}</Text>
                <Text style={styles.courseCode}>{course.courseCode}</Text>
                <Text style={styles.courseTerm}>{course.term}</Text>
              </View>
            ))
          ) : (
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderText}>No courses found.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 110,
    gap: spacing.md,
  },
  header: {
    backgroundColor: palette.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    ...shadows.card,
  },
  headerBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE4E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    marginBottom: spacing.sm,
  },
  headerBadgeText: {
    color: palette.canvas,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',
    color: palette.textPrimary,
  },
  headerSubtitle: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: palette.textSecondary,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.textPrimary,
    paddingHorizontal: 2,
  },
  placeholderCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
  },
  placeholderText: {
    fontSize: 14,
    color: palette.textSecondary,
  },
  assignmentCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    ...shadows.card,
  },
  assignmentTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 4,
  },
  assignmentName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  assignmentPoints: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.canvas,
    textTransform: 'uppercase',
  },
  assignmentMeta: {
    fontSize: 13,
    color: palette.textSecondary,
    marginBottom: 6,
  },
  assignmentDueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assignmentDueText: {
    fontSize: 13,
    color: palette.textMuted,
  },
  courseCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    ...shadows.card,
  },
  courseName: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.textPrimary,
    marginBottom: 4,
  },
  courseCode: {
    fontSize: 13,
    color: palette.canvas,
    fontWeight: '600',
    marginBottom: 2,
  },
  courseTerm: {
    fontSize: 13,
    color: palette.textSecondary,
  },
});

