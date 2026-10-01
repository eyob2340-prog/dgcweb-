// Ambient declarations to ensure clean IDE resolution and 0 problems
declare const process: {
  env: Record<string, string | undefined>;
  [key: string]: any;
};

declare module 'crypto' {
  const crypto: any;
  export default crypto;
  export function createHash(algorithm: string, options?: any): any;
  export function randomBytes(size: number, callback?: any): any;
  export function randomUUID(): string;
  export function timingSafeEqual(a: any, b: any): boolean;
}

declare module 'express' {
  export interface Request {
    headers: Record<string, any>;
    baseUrl: string;
    path: string;
    ip?: string;
    body?: any;
    params?: any;
    query?: any;
    cookies?: any;
    adminUser?: any;
    token?: string;
    [key: string]: any;
  }
  export interface Response {
    status(code: number): this;
    json(data: any): this;
    cookie(name: string, val: any, options?: any): this;
    clearCookie(name: string, options?: any): this;
    setHeader(name: string, val: any): this;
    sendFile(path: string): this;
    send(body?: any): this;
    [key: string]: any;
  }
  export type NextFunction = (err?: any) => void;
  const express: any;
  export default express;
}

declare module 'jsonwebtoken' {
  const jwt: {
    sign(payload: any, secretOrPrivateKey: any, options?: any): string;
    verify(token: string, secretOrPublicKey: any, options?: any): any;
    decode(token: string, options?: any): any;
  };
  export default jwt;
}

declare module 'bcryptjs' {
  const bcrypt: {
    hashSync(s: string, salt?: number | string): string;
    hash(s: string, salt: number | string): Promise<string>;
    compare(s: string, hash: string): Promise<boolean>;
    compareSync(s: string, hash: string): boolean;
  };
  export default bcrypt;
}

declare module 'pg' {
  export class Pool {
    constructor(config?: any);
    connect(): Promise<any>;
    query(queryTextOrConfig: any, values?: any[]): Promise<any>;
    end(): Promise<void>;
  }
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

declare module 'qrcode' {
  const qrcode: any;
  export default qrcode;
}

declare module 'otplib' {
  export function generateSecret(): string;
  export function generateURI(options: any): string;
  export function verifySync(options: any): boolean;
}

declare module 'nodemailer' {
  const nodemailer: any;
  export default nodemailer;
}
