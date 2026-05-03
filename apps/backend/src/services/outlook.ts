import axios from 'axios';
import { User } from '@cypilot/shared';
import { OutlookEmail, OutlookCalendarEvent } from '@cypilot/shared';

class OutlookService {
  private baseUrl = 'https://graph.microsoft.com/v1.0';
  private isDevAccessToken(accessToken: string): boolean {
    return accessToken === 'dev-access-token' || accessToken.startsWith('dev-');
  }

  private getMockEmails(): OutlookEmail[] {
    return [
      {
        id: 'email-advising-grad-check',
        subject: 'Action needed: senior graduation check by Friday',
        bodyPreview: 'Your degree audit shows two outstanding requirements. Please review the attached audit and confirm your spring graduation plan with your advisor by Friday.',
        receivedDateTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        from: {
          emailAddress: {
            address: 'advising@iastate.edu',
            name: 'ISU Academic Advising'
          }
        },
        toRecipients: [
          {
            emailAddress: {
              address: 'student@iastate.edu',
              name: 'ISU Student'
            }
          }
        ],
        importance: 'high',
        isRead: false,
        hasAttachments: false,
        flag: { flagStatus: 'flagged' },
        webLink: 'https://outlook.office.com/mail/'
      },
      {
        id: 'email-prof-meeting',
        subject: 'Office hours moved this week — Thursday 3 to 4',
        bodyPreview: 'Heads up: I have a faculty meeting Wednesday so this week office hours move to Thursday 3 to 4 in Coover 1010. Bring your sprint 2 questions.',
        receivedDateTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        from: {
          emailAddress: {
            address: 'jdavis@iastate.edu',
            name: 'Prof. Jordan Davis'
          }
        },
        toRecipients: [
          {
            emailAddress: {
              address: 'student@iastate.edu',
              name: 'ISU Student'
            }
          }
        ],
        importance: 'high',
        isRead: false,
        hasAttachments: false,
        flag: { flagStatus: 'flagged' },
        webLink: 'https://outlook.office.com/mail/'
      },
      {
        id: 'email-registrar-window',
        subject: 'Spring registration window opens tomorrow at 8 AM',
        bodyPreview: 'Your registration appointment is tomorrow at 8 AM. Plan your next semester schedule and confirm prerequisites in MyState before then.',
        receivedDateTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        from: {
          emailAddress: {
            address: 'registrar@iastate.edu',
            name: 'ISU Registrar'
          }
        },
        toRecipients: [
          {
            emailAddress: {
              address: 'student@iastate.edu',
              name: 'ISU Student'
            }
          }
        ],
        importance: 'normal',
        isRead: true,
        hasAttachments: false,
        flag: { flagStatus: 'notFlagged' },
        webLink: 'https://outlook.office.com/mail/'
      }
    ];
  }

  private getMockEvents(): OutlookCalendarEvent[] {
    const now = Date.now();
    return [
      {
        id: 'dev-event-1',
        subject: 'COM S 309 Team Meeting',
        bodyPreview: 'Weekly sprint planning and demo prep.',
        start: {
          dateTime: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
          timeZone: 'America/Chicago'
        },
        end: {
          dateTime: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
          timeZone: 'America/Chicago'
        },
        location: { displayName: 'Coover Hall 1010' },
        organizer: {
          emailAddress: {
            address: 'instructor@iastate.edu',
            name: 'Course Instructor'
          }
        },
        attendees: [],
        isAllDay: false,
        showAs: 'busy',
        webLink: 'https://outlook.office.com/calendar/'
      },
      {
        id: 'dev-event-2',
        subject: 'Office Hours',
        bodyPreview: 'Bring assignment questions and project updates.',
        start: {
          dateTime: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
          timeZone: 'America/Chicago'
        },
        end: {
          dateTime: new Date(now + 25 * 60 * 60 * 1000).toISOString(),
          timeZone: 'America/Chicago'
        },
        location: { displayName: 'Durham Center 2nd Floor' },
        organizer: {
          emailAddress: {
            address: 'ta@iastate.edu',
            name: 'Teaching Assistant'
          }
        },
        attendees: [],
        isAllDay: false,
        showAs: 'tentative',
        webLink: 'https://outlook.office.com/calendar/'
      }
    ];
  }

  async getDashboardData(user: User, accessToken: string) {
    const [importantEmails, upcomingEvents] = await Promise.allSettled([
      this.getImportantEmails(accessToken),
      this.getUpcomingEvents(accessToken)
    ]);

    return {
      importantEmails: importantEmails.status === 'fulfilled' ? importantEmails.value : [],
      upcomingEvents: upcomingEvents.status === 'fulfilled' ? upcomingEvents.value : [],
      unreadImportantEmails: importantEmails.status === 'fulfilled' ? 
        importantEmails.value.filter(email => !email.isRead).length : 0
    };
  }

  async getImportantEmails(accessToken: string): Promise<OutlookEmail[]> {
    if (this.isDevAccessToken(accessToken)) {
      return this.getMockEmails().filter((email) => email.importance === 'high' || email.flag?.flagStatus === 'flagged');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/me/messages`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          $filter: "importance eq 'high' or flag/flagStatus eq 'flagged'",
          $orderby: 'receivedDateTime desc',
          $top: 20,
          $select: 'id,subject,bodyPreview,receivedDateTime,from,toRecipients,importance,isRead,hasAttachments,flag,webLink'
        }
      });

      return response.data.value.map((email: any) => ({
        id: email.id,
        subject: email.subject,
        bodyPreview: email.bodyPreview,
        receivedDateTime: email.receivedDateTime,
        from: email.from,
        toRecipients: email.toRecipients,
        importance: email.importance,
        isRead: email.isRead,
        hasAttachments: email.hasAttachments,
        flag: email.flag,
        webLink: email.webLink
      }));
    } catch (error) {
      console.error('Error fetching important emails:', error);
      return [];
    }
  }

  async getEmails(accessToken: string, limit: number = 50, skip: number = 0): Promise<OutlookEmail[]> {
    if (this.isDevAccessToken(accessToken)) {
      return this.getMockEmails().slice(skip, skip + limit);
    }

    try {
      const response = await axios.get(`${this.baseUrl}/me/messages`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          $orderby: 'receivedDateTime desc',
          $top: limit,
          $skip: skip,
          $select: 'id,subject,bodyPreview,receivedDateTime,from,toRecipients,importance,isRead,hasAttachments,flag,webLink'
        }
      });

      return response.data.value.map((email: any) => ({
        id: email.id,
        subject: email.subject,
        bodyPreview: email.bodyPreview,
        receivedDateTime: email.receivedDateTime,
        from: email.from,
        toRecipients: email.toRecipients,
        importance: email.importance,
        isRead: email.isRead,
        hasAttachments: email.hasAttachments,
        flag: email.flag,
        webLink: email.webLink
      }));
    } catch (error) {
      console.error('Error fetching emails:', error);
      return [];
    }
  }

  async getUpcomingEvents(accessToken: string): Promise<OutlookCalendarEvent[]> {
    if (this.isDevAccessToken(accessToken)) {
      return this.getMockEvents();
    }

    try {
      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const response = await axios.get(`${this.baseUrl}/me/events`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          $filter: `start/dateTime ge '${now.toISOString()}' and start/dateTime le '${oneWeekFromNow.toISOString()}'`,
          $orderby: 'start/dateTime asc',
          $top: 20,
          $select: 'id,subject,bodyPreview,start,end,location,organizer,attendees,isAllDay,showAs,webLink'
        }
      });

      return response.data.value.map((event: any) => ({
        id: event.id,
        subject: event.subject,
        bodyPreview: event.bodyPreview,
        start: event.start,
        end: event.end,
        location: event.location,
        organizer: event.organizer,
        attendees: event.attendees,
        isAllDay: event.isAllDay,
        showAs: event.showAs,
        webLink: event.webLink
      }));
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
      return [];
    }
  }

  async getCalendarEvents(accessToken: string, startDate?: string, endDate?: string): Promise<OutlookCalendarEvent[]> {
    if (this.isDevAccessToken(accessToken)) {
      return this.getMockEvents();
    }

    try {
      const now = new Date();
      const start = startDate ? new Date(startDate) : now;
      const end = endDate ? new Date(endDate) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const response = await axios.get(`${this.baseUrl}/me/events`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          $filter: `start/dateTime ge '${start.toISOString()}' and start/dateTime le '${end.toISOString()}'`,
          $orderby: 'start/dateTime asc',
          $top: 100,
          $select: 'id,subject,bodyPreview,start,end,location,organizer,attendees,isAllDay,showAs,webLink'
        }
      });

      return response.data.value.map((event: any) => ({
        id: event.id,
        subject: event.subject,
        bodyPreview: event.bodyPreview,
        start: event.start,
        end: event.end,
        location: event.location,
        organizer: event.organizer,
        attendees: event.attendees,
        isAllDay: event.isAllDay,
        showAs: event.showAs,
        webLink: event.webLink
      }));
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return [];
    }
  }

  async markEmailAsRead(accessToken: string, emailId: string): Promise<void> {
    if (this.isDevAccessToken(accessToken)) {
      return;
    }

    try {
      await axios.patch(`${this.baseUrl}/me/messages/${emailId}`, {
        isRead: true
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error marking email as read:', error);
      throw error;
    }
  }
}

export const outlookService = new OutlookService();
