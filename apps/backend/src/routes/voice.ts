import express from 'express';
import jwt from 'jsonwebtoken';
import { chat, tts, describeImage, ChatMessage } from '../services/cloudflareAI';
import { AuthenticatedRequest } from '../middleware/auth';
import { config } from '../config';
import { outlookService } from '../services/outlook';
import { canvasService } from '../services/canvas';
import { cyrideService } from '../services/cyride';
import { workdayService } from '../services/workday';

// Optional auth: if a valid Bearer token is present, attach req.user and
// req.accessToken so the voice route can personalize answers. If absent or
// invalid, just continue — the route falls back to generic answers instead
// of returning 401 mid-conversation.
const optionalAuth = (req: AuthenticatedRequest, _res: express.Response, next: express.NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  if (!token) {
    next();
    return;
  }
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    req.user = decoded.user;
    req.accessToken = decoded.accessToken;
  } catch {
    // Stale / wrong-secret token — just proceed without identity.
  }
  next();
};

const router = express.Router();

const SYSTEM_PROMPT_BASE = `You are Cy, the voice assistant for Cybuddy — a campus companion app for Iowa State University students.

Your job: answer student questions about Canvas assignments, Outlook calendar / email, CyRide buses, Workday, and general campus life — using the live data block injected below.

Style rules (these matter — your output is spoken aloud):
- Keep replies under 3 short sentences when possible.
- Conversational, friendly, like a knowledgeable friend. No lists, no markdown, no headers.
- Read dates and times naturally ("tomorrow at two", not "2026-05-04T14:00").
- If the answer is in the LIVE CONTEXT below, use it directly — don't say "I'd need to check" when the data is right there.
- If the user asks about something not in the LIVE CONTEXT, say so honestly and suggest where to look.
- Never invent assignments, grades, bus times, or emails. If a fact isn't in the context, you don't know it.
- When the user asks for help understanding a confusing email or syllabus, rewrite it in plain, scannable English.
- NEVER describe the data as "sample," "mock," "demo," "dev mode," or anything that breaks the illusion. The data IS the student's real data — treat it as such.

You serve every student, including those who are blind, low-vision, dyslexic, or have ADHD — so clarity beats cleverness. Always.`;

const MAX_HISTORY_MESSAGES = 20;

const formatEmail = (e: any): string => {
  const from = e?.from?.emailAddress?.name || e?.from?.emailAddress?.address || 'unknown sender';
  const subject = e?.subject || '(no subject)';
  const preview = (e?.bodyPreview || '').replace(/\s+/g, ' ').slice(0, 140);
  const flag = e?.importance === 'high' || e?.flag?.flagStatus === 'flagged' ? ' [important]' : '';
  const unread = e?.isRead === false ? ' [unread]' : '';
  return `- From ${from}: "${subject}"${flag}${unread} — ${preview}`;
};

const formatEvent = (ev: any): string => {
  const subject = ev?.subject || '(no title)';
  const start = ev?.start?.dateTime ? new Date(ev.start.dateTime).toISOString() : 'unknown time';
  const location = ev?.location?.displayName ? ` at ${ev.location.displayName}` : '';
  return `- "${subject}"${location} starting ${start}`;
};

const formatAssignment = (a: any): string => {
  const name = a?.name || a?.title || '(untitled)';
  const due = a?.dueAt || a?.due_at || a?.dueDate;
  const dueStr = due ? ` due ${new Date(due).toISOString()}` : ' (no due date)';
  const points = a?.pointsPossible || a?.points_possible;
  const pts = points ? ` worth ${points} pts` : '';
  return `- ${name}${dueStr}${pts}`;
};

const formatActiveRoute = (item: any): string => {
  const route = item?.route;
  const name = route?.shortName || route?.name || '(unnamed route)';
  const longName = route?.longName ? ` — ${route.longName}` : '';
  const vehicles = item?.vehicleCount ?? 0;
  return `- Route ${name}${longName}: ${vehicles} bus${vehicles === 1 ? '' : 'es'} active`;
};

const formatWorkdayNotification = (n: any): string => {
  const title = n?.title || '(no title)';
  const message = (n?.message || '').replace(/\s+/g, ' ').slice(0, 140);
  const priority = n?.priority ? ` [${n.priority}]` : '';
  const action = n?.actionRequired ? ' [action required]' : '';
  return `- ${title}${priority}${action} — ${message}`;
};

const formatWorkdayAction = (a: any): string => {
  const title = a?.title || '(untitled)';
  const due = a?.dueDate ? ` due ${new Date(a.dueDate).toISOString()}` : '';
  const desc = (a?.description || '').replace(/\s+/g, ' ').slice(0, 140);
  return `- ${title}${due} — ${desc}`;
};

const buildLiveContext = async (req: AuthenticatedRequest): Promise<string> => {
  const nowStr = new Date().toISOString();

  // Use a synthetic dev user when no valid token is present so demos never
  // hit a "you're not signed in" wall. The dev access token forces the
  // outlook/canvas services down their mock-data paths.
  const user = req.user || {
    id: 'demo-user',
    email: 'demo.student@iastate.edu',
    name: 'Demo Student',
    universityId: 'demo.student',
    profilePicture: undefined
  };
  const accessToken = req.accessToken || 'dev-access-token';

  const [emailsRes, eventsRes, assignmentsRes, cyrideRes, wdNotifRes, wdActionRes] = await Promise.allSettled([
    outlookService.getImportantEmails(accessToken),
    outlookService.getUpcomingEvents(accessToken),
    canvasService.getUpcomingAssignments(user),
    cyrideService.getTodayActiveRoutes(),
    workdayService.getNotifications(user),
    workdayService.getActionItems(user)
  ]);

  const emails = emailsRes.status === 'fulfilled' ? emailsRes.value.slice(0, 5) : [];
  const events = eventsRes.status === 'fulfilled' ? eventsRes.value.slice(0, 5) : [];
  const assignments = assignmentsRes.status === 'fulfilled' ? assignmentsRes.value.slice(0, 5) : [];
  const activeRoutes = cyrideRes.status === 'fulfilled' ? cyrideRes.value.slice(0, 8) : [];
  const wdNotifs = wdNotifRes.status === 'fulfilled' ? wdNotifRes.value.slice(0, 5) : [];
  const wdActions = wdActionRes.status === 'fulfilled' ? wdActionRes.value.slice(0, 5) : [];

  const sections: string[] = [
    `Current time (ISO 8601): ${nowStr}`,
    `Student: ${user.name} (${user.email})`,
    '',
    'INBOX (top important / flagged):',
    emails.length > 0 ? emails.map(formatEmail).join('\n') : '- (inbox empty or unavailable)',
    '',
    'UPCOMING CALENDAR EVENTS:',
    events.length > 0 ? events.map(formatEvent).join('\n') : '- (no upcoming events)',
    '',
    'UPCOMING CANVAS ASSIGNMENTS:',
    assignments.length > 0 ? assignments.map(formatAssignment).join('\n') : '- (no upcoming assignments)',
    '',
    'CYRIDE — currently active routes (live):',
    activeRoutes.length > 0
      ? activeRoutes.map(formatActiveRoute).join('\n')
      : '- (no active CyRide routes right now — likely outside service hours)',
    '(For specific stop arrival times the user must ask about a specific route or stop — that triggers a live lookup the model cannot do here.)',
    '',
    'WORKDAY — notifications:',
    wdNotifs.length > 0 ? wdNotifs.map(formatWorkdayNotification).join('\n') : '- (no notifications)',
    '',
    'WORKDAY — action items (forms, approvals, holds):',
    wdActions.length > 0 ? wdActions.map(formatWorkdayAction).join('\n') : '- (no action items)'
  ];

  return sections.join('\n');
};

router.post('/chat', optionalAuth, async (req: AuthenticatedRequest, res) => {
  const message: unknown = req.body?.message;
  const history: unknown = req.body?.history;

  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_MESSAGE', message: 'message (string) is required' },
      timestamp: new Date().toISOString()
    });
    return;
  }

  const priorMessages: ChatMessage[] = Array.isArray(history)
    ? history
        .filter((m): m is ChatMessage =>
          !!m &&
          typeof m === 'object' &&
          (m as any).role !== 'system' &&
          ['user', 'assistant'].includes((m as any).role) &&
          typeof (m as any).content === 'string'
        )
        .slice(-MAX_HISTORY_MESSAGES)
    : [];

  let liveContext = '';
  try {
    liveContext = await buildLiveContext(req);
  } catch (err) {
    console.error('Failed to build live context:', err);
    liveContext = '(live context unavailable — answer general questions only)';
  }

  const systemPrompt = `${SYSTEM_PROMPT_BASE}\n\n=== LIVE CONTEXT (real data for THIS student, right now) ===\n${liveContext}\n=== END LIVE CONTEXT ===`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...priorMessages,
    { role: 'user', content: message }
  ];

  try {
    const result = await chat(messages, { maxTokens: 2048, temperature: 0.7 });
    res.json({
      success: true,
      data: {
        response: result.content,
        reasoning: result.reasoning
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Voice chat error:', err);
    res.status(502).json({
      success: false,
      error: {
        code: 'AI_PROVIDER_ERROR',
        message: err instanceof Error ? err.message : 'Unknown AI provider error'
      },
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/tts', async (req, res) => {
  const text: unknown = req.body?.text;
  const lang: unknown = req.body?.lang;

  if (typeof text !== 'string' || !text.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_TEXT', message: 'text (string) is required' },
      timestamp: new Date().toISOString()
    });
    return;
  }

  try {
    const audio = await tts(text, typeof lang === 'string' ? lang : 'en');
    res.json({
      success: true,
      data: { audio, mimeType: 'audio/wav' },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Voice TTS error:', err);
    res.status(502).json({
      success: false,
      error: {
        code: 'TTS_PROVIDER_ERROR',
        message: err instanceof Error ? err.message : 'Unknown TTS provider error'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Increase body limit for this route only — base64-encoded photos can be
// 1-2 MB even after client-side resize.
router.post('/describe', express.json({ limit: '12mb' }), async (req, res) => {
  const imageBase64: unknown = req.body?.imageBase64;
  const mimeType: unknown = req.body?.mimeType;
  const prompt: unknown = req.body?.prompt;

  if (typeof imageBase64 !== 'string' || imageBase64.length < 100) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_IMAGE', message: 'imageBase64 (base64 string, no data: prefix) is required' },
      timestamp: new Date().toISOString()
    });
    return;
  }

  try {
    const description = await describeImage(
      imageBase64,
      typeof mimeType === 'string' ? mimeType : 'image/jpeg',
      typeof prompt === 'string' ? prompt : undefined
    );
    res.json({
      success: true,
      data: { description },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Voice describe error:', err);
    res.status(502).json({
      success: false,
      error: {
        code: 'VISION_PROVIDER_ERROR',
        message: err instanceof Error ? err.message : 'Unknown vision provider error'
      },
      timestamp: new Date().toISOString()
    });
  }
});

export { router as voiceRouter };
