import React, { useEffect, useRef, useState } from 'react';
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
import { OutlookEmail, OutlookCalendarEvent } from '@cypilot/shared';
import { palette, radii, shadows, spacing } from '../theme/tokens';

export const OutlookScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'calendar'>('inbox');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const emailsQuery = useQuery<OutlookEmail[]>({
    queryKey: ['outlook', 'important-emails'],
    queryFn: () => apiService.get<OutlookEmail[]>('/api/outlook/emails/important'),
  });

  const eventsQuery = useQuery<OutlookCalendarEvent[]>({
    queryKey: ['outlook', 'upcoming-events'],
    queryFn: () => apiService.get<OutlookCalendarEvent[]>('/api/outlook/events/upcoming'),
  });

  const handleRefresh = () => {
    void emailsQuery.refetch();
    void eventsQuery.refetch();
  };

  // Rich mock data - More emails
  const mockEmails = [
    { id: '1', from: { emailAddress: { name: 'Prof. Smith', address: 'smith@iastate.edu' } }, subject: 'Office Hours Cancelled Tomorrow', bodyPreview: 'Hi all, I need to cancel my office hours this Thursday due to a department meeting. Please reach out via email if you have questions about the upcoming exam...', receivedDateTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), importance: 'high' as const, isRead: false },
    { id: '2', from: { emailAddress: { name: 'SE 319 Group', address: 'se319-team@iastate.edu' } }, subject: 'Sprint Planning Tonight', bodyPreview: 'Hey team, reminder that we have sprint planning at 7pm in the library. Please come prepared with your task estimates for the next sprint...', receivedDateTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), importance: 'high' as const, isRead: false },
    { id: '3', from: { emailAddress: { name: 'ISU Career Services', address: 'careers@iastate.edu' } }, subject: 'Spring Career Fair - Register Now!', bodyPreview: 'Over 200 companies will be attending the Spring Career Fair on March 20. Register now to secure your spot and get access to exclusive networking events...', receivedDateTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), importance: 'normal' as const, isRead: false },
    { id: '4', from: { emailAddress: { name: 'COM S 228 TA', address: 'ta228@iastate.edu' } }, subject: 'Re: Question about Lab 5', bodyPreview: 'Yes, you can use recursion for the tree traversal portion. Make sure to handle the base case properly when the node is null. Let me know if you have more questions...', receivedDateTime: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), importance: 'normal' as const, isRead: true },
    { id: '5', from: { emailAddress: { name: 'ISU Recreation', address: 'recreation@iastate.edu' } }, subject: 'Intramural Basketball Registration Open', bodyPreview: 'Spring intramural basketball registration is now open! Sign up your team by March 15 to participate. Games start the following week...', receivedDateTime: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), importance: 'normal' as const, isRead: false },
    { id: '6', from: { emailAddress: { name: 'ISU Dining', address: 'dining@iastate.edu' } }, subject: 'New Extended Hours at UDCC', bodyPreview: 'Starting next week, the UDCC will have extended hours on weekdays until 10 PM. Weekend hours remain unchanged. New late-night menu options available...', receivedDateTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), importance: 'normal' as const, isRead: true },
    { id: '7', from: { emailAddress: { name: 'MATH 207 Instructor', address: 'math207@iastate.edu' } }, subject: 'Exam 2 Results Posted', bodyPreview: 'Exam 2 results have been posted to Canvas. The class average was 78%. Please see me during office hours if you have questions about your grade...', receivedDateTime: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(), importance: 'normal' as const, isRead: true },
    { id: '8', from: { emailAddress: { name: 'Student Government', address: 'stugov@iastate.edu' } }, subject: 'Vote in Student Elections!', bodyPreview: 'Student elections are happening next week. Make your voice heard and vote for your representatives. Polling locations across campus...', receivedDateTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), importance: 'normal' as const, isRead: true },
    { id: '9', from: { emailAddress: { name: 'ISU Library', address: 'library@iastate.edu' } }, subject: 'Extended Hours During Finals', bodyPreview: 'Parks Library will have 24-hour access during finals week. Study rooms can be reserved online up to 3 days in advance...', receivedDateTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), importance: 'normal' as const, isRead: true },
    { id: '10', from: { emailAddress: { name: 'COM S Department', address: 'cs-dept@iastate.edu' } }, subject: 'Summer Research Opportunities', bodyPreview: 'Applications are now open for summer research positions in the CS department. Multiple faculty are looking for undergraduate researchers...', receivedDateTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), importance: 'normal' as const, isRead: true },
  ];

  // Rich mock data - More calendar events
  const mockEvents = [
    { id: '1', subject: 'COM S 228 Lecture', start: { dateTime: new Date().toISOString() }, end: { dateTime: new Date(Date.now() + 50 * 60 * 1000).toISOString() }, location: { displayName: 'Pearson 1050' }, isAllDay: false },
    { id: '2', subject: 'Study Group - Data Structures', start: { dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() }, end: { dateTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString() }, location: { displayName: 'Parks Library Room 201' }, isAllDay: false },
    { id: '3', subject: 'MATH 207 Lecture', start: { dateTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000).toISOString() }, end: { dateTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 11.25 * 60 * 60 * 1000).toISOString() }, location: { displayName: 'Carver 0001' }, isAllDay: false },
    { id: '4', subject: 'SE 319 Sprint Planning', start: { dateTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() }, end: { dateTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() }, location: { displayName: 'Parks Library Room 201' }, isAllDay: false },
    { id: '5', subject: 'Project Team Meeting', start: { dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() }, end: { dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString() }, location: { displayName: 'Zoom' }, isAllDay: false },
    { id: '6', subject: 'TA Office Hours', start: { dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000).toISOString() }, end: { dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000).toISOString() }, location: { displayName: 'Atanasoff 226' }, isAllDay: false },
    { id: '7', subject: 'Career Fair', start: { dateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }, end: { dateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString() }, location: { displayName: 'Hilton Coliseum' }, isAllDay: false },
    { id: '8', subject: 'COM S 321 Midterm', start: { dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000).toISOString() }, end: { dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000).toISOString() }, location: { displayName: 'Hoover 1213' }, isAllDay: false },
    { id: '9', subject: 'Intramural Basketball', start: { dateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000).toISOString() }, end: { dateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 20 * 60 * 60 * 1000).toISOString() }, location: { displayName: 'State Gym Court 3' }, isAllDay: false },
    { id: '10', subject: 'Advisor Meeting', start: { dateTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000).toISOString() }, end: { dateTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 9.5 * 60 * 60 * 1000).toISOString() }, location: { displayName: 'Atanasoff 114' }, isAllDay: false },
  ];

  // Use mock data if API returns less items (for demo purposes)
  const emails = (emailsQuery.data?.length ?? 0) >= mockEmails.length ? emailsQuery.data! : mockEmails;
  const events = (eventsQuery.data?.length ?? 0) >= mockEvents.length ? eventsQuery.data! : mockEvents;
  const unreadCount = emails.filter((e: any) => !e.isRead).length;

  const formatTime = (date: string) => new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const formatDate = (date: string) => new Date(date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const formatRelative = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={emailsQuery.isRefetching || eventsQuery.isRefetching} onRefresh={handleRefresh} tintColor={palette.brand} />}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient colors={[palette.outlook, '#005A9E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGradient}>
              <View style={styles.headerTop}>
                <MaterialCommunityIcons name="microsoft-outlook" size={32} color="#FFF" />
                <View style={styles.headerStats}>
                  <View style={styles.headerStat}>
                    <Text style={styles.headerStatNum}>{unreadCount}</Text>
                    <Text style={styles.headerStatLabel}>Unread</Text>
                  </View>
                  <View style={styles.headerStat}>
                    <Text style={styles.headerStatNum}>{events.length}</Text>
                    <Text style={styles.headerStatLabel}>Events</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.headerTitle}>Outlook</Text>
              <Text style={styles.headerSubtitle}>Mail & Calendar</Text>
            </LinearGradient>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <Pressable style={[styles.tab, activeTab === 'inbox' && styles.tabActive]} onPress={() => setActiveTab('inbox')}>
              <MaterialCommunityIcons name="email-outline" size={18} color={activeTab === 'inbox' ? palette.outlook : palette.textMuted} />
              <Text style={[styles.tabText, activeTab === 'inbox' && styles.tabTextActive]}>Inbox</Text>
              {unreadCount > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{unreadCount}</Text></View>}
            </Pressable>
            <Pressable style={[styles.tab, activeTab === 'calendar' && styles.tabActive]} onPress={() => setActiveTab('calendar')}>
              <MaterialCommunityIcons name="calendar-outline" size={18} color={activeTab === 'calendar' ? palette.outlook : palette.textMuted} />
              <Text style={[styles.tabText, activeTab === 'calendar' && styles.tabTextActive]}>Calendar</Text>
            </Pressable>
          </View>

          {activeTab === 'inbox' ? (
            <View style={styles.list}>
              {emails.map((email: any, i) => (
                <Pressable key={email.id} style={[styles.emailItem, i > 0 && styles.itemBorder]}>
                  <View style={[styles.emailAvatar, !email.isRead && styles.emailAvatarUnread]}>
                    <Text style={[styles.emailAvatarText, !email.isRead && styles.emailAvatarTextUnread]}>
                      {email.from.emailAddress.name[0]}
                    </Text>
                  </View>
                  <View style={styles.emailContent}>
                    <View style={styles.emailTop}>
                      <Text style={[styles.emailFrom, !email.isRead && styles.emailFromUnread]} numberOfLines={1}>
                        {email.from.emailAddress.name}
                      </Text>
                      <Text style={styles.emailTime}>{formatRelative(email.receivedDateTime)}</Text>
                    </View>
                    <Text style={[styles.emailSubject, !email.isRead && styles.emailSubjectUnread]} numberOfLines={1}>
                      {email.subject}
                    </Text>
                    <Text style={styles.emailPreview} numberOfLines={2}>{email.bodyPreview}</Text>
                  </View>
                  {email.importance === 'high' && (
                    <Ionicons name="flag" size={16} color={palette.danger} style={styles.flagIcon} />
                  )}
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.list}>
              {events.map((event: any, i) => {
                const isToday = new Date(event.start.dateTime).toDateString() === new Date().toDateString();
                return (
                  <View key={event.id} style={[styles.eventItem, i > 0 && styles.itemBorder]}>
                    <View style={styles.eventDate}>
                      <Text style={[styles.eventDay, isToday && { color: palette.outlook }]}>
                        {isToday ? 'Today' : formatDate(event.start.dateTime).split(' ')[0]}
                      </Text>
                      <Text style={styles.eventDateNum}>
                        {new Date(event.start.dateTime).getDate()}
                      </Text>
                    </View>
                    <View style={[styles.eventLine, { backgroundColor: isToday ? palette.outlook : palette.borderLight }]} />
                    <View style={styles.eventContent}>
                      <Text style={styles.eventSubject}>{event.subject}</Text>
                      <View style={styles.eventMeta}>
                        <Ionicons name="time-outline" size={12} color={palette.textMuted} />
                        <Text style={styles.eventMetaText}>{formatTime(event.start.dateTime)}</Text>
                      </View>
                      {event.location?.displayName && (
                        <View style={styles.eventMeta}>
                          <Ionicons name="location-outline" size={12} color={palette.textMuted} />
                          <Text style={styles.eventMetaText}>{event.location.displayName}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: spacing.md, paddingBottom: 120 },
  // Header
  header: { borderRadius: radii.xl, overflow: 'hidden', marginBottom: spacing.md, ...shadows.elevated },
  headerGradient: { padding: spacing.lg },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  headerStats: { flexDirection: 'row', gap: spacing.lg },
  headerStat: { alignItems: 'center' },
  headerStatNum: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  headerStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#FFF' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  // Tabs
  tabs: { flexDirection: 'row', backgroundColor: palette.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, padding: 4, marginBottom: spacing.md },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radii.md },
  tabActive: { backgroundColor: palette.brandMuted },
  tabText: { fontSize: 14, fontWeight: '600', color: palette.textMuted },
  tabTextActive: { color: palette.outlook },
  tabBadge: { backgroundColor: palette.outlook, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  // List
  list: { backgroundColor: palette.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, overflow: 'hidden', ...shadows.soft },
  itemBorder: { borderTopWidth: 1, borderTopColor: palette.borderLight },
  // Email
  emailItem: { flexDirection: 'row', padding: spacing.md },
  emailAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.borderLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  emailAvatarUnread: { backgroundColor: '#E0F2FE' },
  emailAvatarText: { fontSize: 16, fontWeight: '600', color: palette.textMuted },
  emailAvatarTextUnread: { color: palette.outlook },
  emailContent: { flex: 1 },
  emailTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emailFrom: { fontSize: 14, fontWeight: '500', color: palette.textPrimary, flex: 1 },
  emailFromUnread: { fontWeight: '700' },
  emailTime: { fontSize: 11, color: palette.textMuted, marginLeft: 8 },
  emailSubject: { fontSize: 14, color: palette.textSecondary, marginTop: 2 },
  emailSubjectUnread: { color: palette.textPrimary, fontWeight: '600' },
  emailPreview: { fontSize: 13, color: palette.textMuted, marginTop: 4, lineHeight: 18 },
  flagIcon: { marginLeft: 8, alignSelf: 'flex-start', marginTop: 2 },
  // Event
  eventItem: { flexDirection: 'row', padding: spacing.md },
  eventDate: { width: 44, alignItems: 'center', marginRight: spacing.sm },
  eventDay: { fontSize: 11, fontWeight: '600', color: palette.textMuted, textTransform: 'uppercase' },
  eventDateNum: { fontSize: 22, fontWeight: '800', color: palette.textPrimary },
  eventLine: { width: 3, borderRadius: 2, marginRight: spacing.sm },
  eventContent: { flex: 1 },
  eventSubject: { fontSize: 15, fontWeight: '600', color: palette.textPrimary },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  eventMetaText: { fontSize: 12, color: palette.textMuted },
});
