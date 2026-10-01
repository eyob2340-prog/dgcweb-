// Ambient declarations for clean IDE resolution and 0 problems
declare var process: any;
declare var Buffer: any;
declare var __dirname: string;
declare var __filename: string;

declare module 'crypto' {
  const crypto: any;
  export default crypto;
  export = crypto;
}

declare module 'node:crypto' {
  const crypto: any;
  export default crypto;
  export = crypto;
}

declare module 'express' {
  export interface Request {
    [key: string]: any;
    headers?: any;
    baseUrl?: string;
    path?: string;
    ip?: string;
    body?: any;
    params?: any;
    query?: any;
    cookies?: Record<string, string>;
  }
  export interface Response {
    [key: string]: any;
    status(code: number): this;
    json(body?: any): this;
    send(body?: any): this;
    cookie(name: string, val: string, options?: any): this;
    clearCookie(name: string, options?: any): this;
    setHeader(name: string, value: any): this;
  }
  export type NextFunction = (err?: any) => void;
  const express: any;
  export default express;
}

declare module 'jsonwebtoken' {
  const jwt: any;
  export default jwt;
}

declare module 'bcryptjs' {
  const bcrypt: any;
  export default bcrypt;
}

declare module 'dotenv' {
  const dotenv: any;
  export default dotenv;
}

declare module 'path' {
  const path: any;
  export default path;
}

declare module 'fs' {
  const fs: any;
  export default fs;
}

declare module 'pg' {
  export class Pool {
    constructor(config?: any);
    connect(): Promise<any>;
    query(text: any, params?: any[]): Promise<any>;
    on(event: string, listener: (...args: any[]) => void): this;
    end(): Promise<void>;
  }
  const pg: any;
  export default pg;
}

declare module 'cors' {
  const cors: any;
  export default cors;
}

declare module 'helmet' {
  const helmet: any;
  export default helmet;
}

declare module 'express-rate-limit' {
  const rateLimit: any;
  export default rateLimit;
}

declare module 'vite' {
  export function createServer(options?: any): Promise<any>;
  const vite: any;
  export default vite;
}

declare module '@google/genai' {
  export class GoogleGenAI {
    constructor(options?: any);
    models: any;
  }
}

declare module 'jspdf' {
  const jsPDF: any;
  export default jsPDF;
}

declare module 'qrcode' {
  const qrcode: any;
  export default qrcode;
}

declare module 'otplib' {
  export function generateSecret(): string;
  export function generateURI(options: any): string;
  export function verifySync(options: any): boolean;
  const otplib: any;
  export default otplib;
}

declare module 'nodemailer' {
  const nodemailer: any;
  export default nodemailer;
}
