import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

export class AIService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
  }

  async summarizeAssignment(assignment: any): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Summarize this Canvas assignment for a college student. Focus on key requirements, due date, and what needs to be done:

Title: ${assignment.name}
Description: ${assignment.description || 'No description provided'}
Due Date: ${assignment.dueAt || 'No due date'}
Points: ${assignment.pointsPossible || 0}

Provide a concise, actionable summary.`
        }]
      });

      return response.content[0].type === 'text' ? response.content[0].text : 'Unable to summarize';
    } catch (error) {
      console.error('Error summarizing assignment:', error);
      return `Assignment: ${assignment.name} - Due: ${assignment.dueAt || 'No due date'}`;
    }
  }

  async prioritizeAssignments(assignments: any[]): Promise<any[]> {
    try {
      const response = await this.anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Prioritize these Canvas assignments for a college student. Consider due dates, point values, and complexity. Return a JSON array with priority scores (1-10, where 10 is highest priority):

${assignments.map(a => `- ${a.name} (${a.pointsPossible} pts, due: ${a.dueAt || 'No due date'})`).join('\n')}

Return only a JSON array with objects containing: name, priority, reasoning`
        }]
      });

      const content = response.content[0].type === 'text' ? response.content[0].text : '[]';
      const priorities = JSON.parse(content);
      
      return assignments.map(assignment => ({
        ...assignment,
        aiPriority: priorities.find((p: any) => p.name === assignment.name)?.priority || 5,
        aiReasoning: priorities.find((p: any) => p.name === assignment.name)?.reasoning || 'Standard priority'
      }));
    } catch (error) {
      console.error('Error prioritizing assignments:', error);
      return assignments.map(assignment => ({
        ...assignment,
        aiPriority: 5,
        aiReasoning: 'Unable to determine priority'
      }));
    }
  }

  async predictWorkload(assignments: any[]): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Analyze these assignments and predict the total workload in hours for a college student:

${assignments.map(a => `- ${a.name} (${a.pointsPossible} pts, due: ${a.dueAt || 'No due date'})`).join('\n')}

Provide a brief estimate of total hours needed and any time management advice.`
        }]
      });

      return response.content[0].type === 'text' ? response.content[0].text : 'Unable to predict workload';
    } catch (error) {
      console.error('Error predicting workload:', error);
      return 'Unable to predict workload at this time.';
    }
  }

  async generateStudyPlan(assignments: any[], courses: any[]): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `Create a personalized study plan for a college student based on these assignments and courses:

Courses: ${courses.map(c => c.name).join(', ')}
Upcoming Assignments: ${assignments.map(a => `${a.name} (due: ${a.dueAt || 'No due date'})`).join(', ')}

Provide a structured study schedule with daily recommendations.`
        }]
      });

      return response.content[0].type === 'text' ? response.content[0].text : 'Unable to generate study plan';
    } catch (error) {
      console.error('Error generating study plan:', error);
      return 'Unable to generate study plan at this time.';
    }
  }

  async analyzeDeadlines(assignments: any[]): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Analyze these assignment deadlines and provide insights:

${assignments.map(a => `- ${a.name}: Due ${a.dueAt || 'No due date'} (${a.pointsPossible} pts)`).join('\n')}

Identify potential conflicts, busy periods, and recommendations for planning.`
        }]
      });

      return response.content[0].type === 'text' ? response.content[0].text : 'Unable to analyze deadlines';
    } catch (error) {
      console.error('Error analyzing deadlines:', error);
      return 'Unable to analyze deadlines at this time.';
    }
  }
}

export const aiService = new AIService();

