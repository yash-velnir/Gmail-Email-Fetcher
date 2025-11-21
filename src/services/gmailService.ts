import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { oauth2Client } from '../config/gmail';
import { IEmailData, IEmailAddress, IAttachment } from '../types';

class GmailService {
  private gmail: gmail_v1.Gmail;

  constructor(accessToken: string, refreshToken: string) {
    const auth: OAuth2Client = Object.create(oauth2Client);
    auth.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    this.gmail = google.gmail({ version: 'v1', auth });
  }

  async fetchEmails(query: string, maxResults: number = 100): Promise<gmail_v1.Schema$Message[]> {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: maxResults
      });

      return response.data.messages || [];
    } catch (error) {
      console.error('Error fetching email list:', error);
      throw error;
    }
  }

  async getEmailDetails(messageId: string): Promise<IEmailData> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      return this.parseEmail(response.data);
    } catch (error) {
      console.error('Error fetching email details:', error);
      throw error;
    }
  }

  private parseEmail(message: gmail_v1.Schema$Message): IEmailData {
    const headers = message.payload?.headers || [];
    
    const getHeader = (name: string): string => {
      const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    const parseAddress = (addressString: string): IEmailAddress => {
      if (!addressString) return { name: '', email: '' };
      const match = addressString.match(/(?:"?([^"]*)"?\s)?<?([^>]+)>?/);
      return {
        name: match?.[1] || '',
        email: match?.[2] || addressString
      };
    };

    const body: { text?: string; html?: string } = { text: '', html: '' };
    
    const getBody = (parts?: gmail_v1.Schema$MessagePart[]): void => {
      if (!parts) {
        if (message.payload?.body?.data) {
          const data = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
          if (message.payload.mimeType === 'text/html') {
            body.html = data;
          } else {
            body.text = data;
          }
        }
        return;
      }

      parts.forEach(part => {
        if (part.parts) {
          getBody(part.parts);
        } else if (part.mimeType === 'text/plain' && part.body?.data) {
          body.text = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          body.html = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      });
    };

    getBody(message.payload?.parts);

    const attachments: IAttachment[] = [];
    const getAttachments = (parts?: gmail_v1.Schema$MessagePart[]): void => {
      if (!parts) return;
      parts.forEach(part => {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType || 'application/octet-stream',
            size: part.body.size || 0
          });
        }
        if (part.parts) {
          getAttachments(part.parts);
        }
      });
    };
    getAttachments(message.payload?.parts);

    // ✅ FIX: Handle null/undefined with proper type guards
    return {
      messageId: message.id ?? '', // ✅ Provide default empty string
      threadId: message.threadId ?? undefined, // ✅ Convert null to undefined
      from: parseAddress(getHeader('From')),
      to: getHeader('To')
        .split(',')
        .filter(addr => addr.trim()) // ✅ Filter empty addresses
        .map(addr => parseAddress(addr.trim())),
      subject: getHeader('Subject') || undefined, // ✅ Convert empty string to undefined
      snippet: message.snippet ?? undefined, // ✅ Convert null to undefined
      body: {
        text: body.text || undefined,
        html: body.html || undefined
      },
      date: new Date(parseInt(message.internalDate || '0')),
      labels: message.labelIds || [],
      isRead: !message.labelIds?.includes('UNREAD'),
      isImportant: message.labelIds?.includes('IMPORTANT') || false,
      hasAttachments: attachments.length > 0,
      attachments: attachments
    };
  }
}

export default GmailService;