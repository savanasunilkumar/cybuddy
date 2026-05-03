import axios from 'axios';
import { config } from '../config';
import { User } from '@cypilot/shared';
import { CanvasCourse, CanvasAssignment, CanvasAnnouncement } from '@cypilot/shared';

class CanvasService {
  private baseUrl = config.canvas.baseUrl;
  private apiKey = config.canvas.apiKey;
  private isDevUser(user: User): boolean {
    return user.id.startsWith('dev-');
  }

  private getMockCourses(): CanvasCourse[] {
    return [
      {
        id: 1001,
        name: 'COM S 309 - Software Development Practices',
        courseCode: 'COM S 309',
        term: 'Spring 2026',
        enrollmentTermId: 20261,
        workflowState: 'available',
        totalStudents: 120,
        courseFormat: 'on_campus'
      },
      {
        id: 1002,
        name: 'SE 319 - Construction of User Interfaces',
        courseCode: 'SE 319',
        term: 'Spring 2026',
        enrollmentTermId: 20261,
        workflowState: 'available',
        totalStudents: 90,
        courseFormat: 'on_campus'
      }
    ];
  }

  private getMockAssignments(): CanvasAssignment[] {
    const dueSoon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const dueLater = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    return [
      {
        id: 2001,
        name: 'Sprint 2 Demo',
        description: 'Prepare demo slides and record a short walkthrough.',
        dueAt: dueSoon,
        pointsPossible: 100,
        gradingType: 'points',
        submissionTypes: ['online_upload'],
        hasSubmittedSubmissions: false,
        dueDateString: new Date(dueSoon).toLocaleDateString(),
        courseId: 1001,
        htmlUrl: 'https://canvas.iastate.edu',
        assignmentGroupId: 1,
        position: 1,
        published: true
      },
      {
        id: 2002,
        name: 'UI Prototype Review',
        description: 'Submit wireframes and navigation flow.',
        dueAt: dueLater,
        pointsPossible: 50,
        gradingType: 'points',
        submissionTypes: ['online_text_entry'],
        hasSubmittedSubmissions: false,
        dueDateString: new Date(dueLater).toLocaleDateString(),
        courseId: 1002,
        htmlUrl: 'https://canvas.iastate.edu',
        assignmentGroupId: 1,
        position: 2,
        published: true
      }
    ];
  }

  private getMockAnnouncements(): CanvasAnnouncement[] {
    return [
      {
        id: 3001,
        title: 'Exam Review Session',
        message: 'Exam review is scheduled for Friday at 4 PM in Coover 1010.',
        postedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        author: {
          id: 42,
          displayName: 'Professor Example'
        },
        htmlUrl: 'https://canvas.iastate.edu'
      },
      {
        id: 3002,
        title: 'Project Milestone Reminder',
        message: 'Please complete milestone check-in by Sunday night.',
        postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        author: {
          id: 43,
          displayName: 'Course Staff'
        },
        htmlUrl: 'https://canvas.iastate.edu'
      }
    ];
  }

  async getDashboardData(user: User, accessToken: string) {
    const [courses, upcomingAssignments, recentAnnouncements] = await Promise.allSettled([
      this.getCourses(user),
      this.getUpcomingAssignments(user),
      this.getRecentAnnouncements(user)
    ]);

    return {
      courses: courses.status === 'fulfilled' ? courses.value : [],
      upcomingAssignments: upcomingAssignments.status === 'fulfilled' ? upcomingAssignments.value : [],
      recentAnnouncements: recentAnnouncements.status === 'fulfilled' ? recentAnnouncements.value : [],
      unreadAnnouncements: recentAnnouncements.status === 'fulfilled' ? 
        recentAnnouncements.value.filter(a => !a.readAt).length : 0
    };
  }

  async getCourses(user: User): Promise<CanvasCourse[]> {
    if (this.isDevUser(user) || !this.apiKey) {
      return this.getMockCourses();
    }

    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/courses`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        params: {
          enrollment_type: 'student',
          enrollment_state: 'active',
          include: ['term', 'total_scores']
        }
      });

      return response.data.map((course: any) => ({
        id: course.id,
        name: course.name,
        courseCode: course.course_code,
        term: course.term?.name || '',
        enrollmentTermId: course.enrollment_term_id,
        startAt: course.start_at,
        endAt: course.end_at,
        workflowState: course.workflow_state,
        totalStudents: course.total_students,
        courseFormat: course.course_format
      }));
    } catch (error) {
      console.error('Error fetching Canvas courses:', error);
      return [];
    }
  }

  async getAssignments(courseId: number, user: User): Promise<CanvasAssignment[]> {
    if (this.isDevUser(user) || !this.apiKey) {
      return this.getMockAssignments().filter((assignment) => assignment.courseId === courseId);
    }

    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/courses/${courseId}/assignments`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        params: {
          include: ['submission', 'assignment_visibility'],
          per_page: 50
        }
      });

      return response.data.map((assignment: any) => ({
        id: assignment.id,
        name: assignment.name,
        description: assignment.description,
        dueAt: assignment.due_at,
        unlockAt: assignment.unlock_at,
        lockAt: assignment.lock_at,
        pointsPossible: assignment.points_possible || 0,
        gradingType: assignment.grading_type,
        submissionTypes: assignment.submission_types || [],
        hasSubmittedSubmissions: assignment.has_submitted_submissions || false,
        dueDateString: assignment.due_at ? new Date(assignment.due_at).toLocaleDateString() : undefined,
        courseId: assignment.course_id,
        htmlUrl: assignment.html_url,
        quizId: assignment.quiz_id,
        assignmentGroupId: assignment.assignment_group_id,
        position: assignment.position,
        published: assignment.published
      }));
    } catch (error) {
      console.error('Error fetching Canvas assignments:', error);
      return [];
    }
  }

  async getUpcomingAssignments(user: User): Promise<CanvasAssignment[]> {
    try {
      const courses = await this.getCourses(user);
      const allAssignments = await Promise.all(
        courses.map(course => this.getAssignments(course.id, user))
      );

      const flatAssignments = allAssignments.flat();
      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      return flatAssignments
        .filter(assignment => {
          if (!assignment.dueAt) return false;
          const dueDate = new Date(assignment.dueAt);
          return dueDate >= now && dueDate <= oneWeekFromNow;
        })
        .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());
    } catch (error) {
      console.error('Error fetching upcoming assignments:', error);
      return [];
    }
  }

  async getRecentAnnouncements(user: User): Promise<CanvasAnnouncement[]> {
    try {
      const courses = await this.getCourses(user);
      const allAnnouncements = await Promise.all(
        courses.map(course => this.getAnnouncements(course.id, user))
      );

      const flatAnnouncements = allAnnouncements.flat();
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      return flatAnnouncements
        .filter(announcement => new Date(announcement.postedAt) >= oneWeekAgo)
        .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
        .slice(0, 10); // Limit to 10 most recent
    } catch (error) {
      console.error('Error fetching recent announcements:', error);
      return [];
    }
  }

  async getAnnouncements(courseId: number, user: User): Promise<CanvasAnnouncement[]> {
    if (this.isDevUser(user) || !this.apiKey) {
      return this.getMockAnnouncements();
    }

    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/announcements`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        params: {
          context_codes: [`course_${courseId}`],
          per_page: 20
        }
      });

      return response.data.map((announcement: any) => ({
        id: announcement.id,
        title: announcement.title,
        message: announcement.message,
        postedAt: announcement.posted_at,
        author: {
          id: announcement.author.id,
          displayName: announcement.author.display_name,
          avatarImageUrl: announcement.author.avatar_image_url
        },
        htmlUrl: announcement.html_url
      }));
    } catch (error) {
      console.error('Error fetching Canvas announcements:', error);
      return [];
    }
  }
}

export const canvasService = new CanvasService();
