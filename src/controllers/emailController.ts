import { Request, Response } from 'express';
import Email from '../models/Email';
import emailSyncService from '../services/emailSyncService';
import { EmailQueryParams } from '../types/request.types';

export const getEmails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      page = '1', 
      limit = '50', 
      search, 
      isRead, 
      isImportant 
    } = req.query as EmailQueryParams;

    const query: any = { userId: req.userId };

    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { 'from.email': { $regex: search, $options: 'i' } },
        { snippet: { $regex: search, $options: 'i' } }
      ];
    }

    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    if (isImportant !== undefined) {
      query.isImportant = isImportant === 'true';
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const emails = await Email.find(query)
      .sort({ date: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .select('-body.html -body.text'); // Don't send full body in list

    const count = await Email.countDocuments(query);

    res.json({
      emails,
      totalPages: Math.ceil(count / limitNum),
      currentPage: pageNum,
      total: count
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
};

export const getEmailById = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = await Email.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!email) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    res.json({ email });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
};

export const triggerSync = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const result = await emailSyncService.syncUserEmails(req.userId);
    res.json({ message: 'Sync completed', result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
};