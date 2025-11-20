const { google } = require('googleapis');
const { oauth2Client } = require('../config/gmail');

class GmailService {
  constructor(accessToken, refreshToken) {
    const auth = oauth2Client;
    auth.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    this.gmail = google.gmail({ version: 'v1', auth });
  }

  async fetchEmails(query, maxResults = 100) {
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

  async getEmailDetails(messageId) {
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

  parseEmail(message) {
    const headers = message.payload.headers;
    const getHeader = (name) => {
      const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return header ? header.value : '';
    };

    const parseAddress = (addressString) => {
      if (!addressString) return null;
      const match = addressString.match(/(?:"?([^"]*)"?\s)?<?([^>]+)>?/);
      return {
        name: match?.[1] || '',
        email: match?.[2] || addressString
      };
    };

    let body = { text: '', html: '' };
    
    const getBody = (parts) => {
      if (!parts) {
        if (message.payload.body.data) {
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
        } else if (part.mimeType === 'text/plain' && part.body.data) {
          body.text = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body.data) {
          body.html = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      });
    };

    getBody(message.payload.parts);

    const attachments = [];
    const getAttachments = (parts) => {
      if (!parts) return;
      parts.forEach(part => {
        if (part.filename && part.body.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size
          });
        }
        if (part.parts) {
          getAttachments(part.parts);
        }
      });
    };
    getAttachments(message.payload.parts);

    return {
      messageId: message.id,
      threadId: message.threadId,
      from: parseAddress(getHeader('From')),
      to: getHeader('To').split(',').map(addr => parseAddress(addr.trim())),
      subject: getHeader('Subject'),
      snippet: message.snippet,
      body: body,
      date: new Date(parseInt(message.internalDate)),
      labels: message.labelIds || [],
      isRead: !message.labelIds?.includes('UNREAD'),
      isImportant: message.labelIds?.includes('IMPORTANT'),
      hasAttachments: attachments.length > 0,
      attachments: attachments
    };
  }
}

module.exports = GmailService;
