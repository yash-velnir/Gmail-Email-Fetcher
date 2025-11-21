import { Request } from 'express';

export interface EmailQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  isRead?: string;
  isImportant?: string;
}

export interface AuthCallbackQuery {
  code?: string;
  error?: string;
}

export interface SuccessPageQuery {
  token?: string;
}

export interface ErrorPageQuery {
  message?: string;
}

export interface JWTDecoded {
  userId: string;
  email: string;
  tokenVersion: number;
  iat: number;
  exp: number;
}