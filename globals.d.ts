// =================================================================
// globals.d.ts — Universal ambient type declarations
// This file is a SCRIPT (not a module), so it has NO import/export.
// It must be included in tsconfig.json "include" for the TS Language
// Server to automatically apply it to every file in the project.
// =================================================================

// ─── Node.js Globals ──────────────────────────────────────────────
declare var process: {
  env: Record<string, string | undefined>;
  argv: string[];
  exit(code?: number): never;
  cwd(): string;
  [key: string]: any;
};
declare type Buffer = any;
declare var Buffer: any;
declare var __dirname: string;
declare var __filename: string;
declare var setTimeout: (fn: (...args: any[]) => any, ms?: number, ...args: any[]) => any;
declare var clearTimeout: (id?: any) => void;
declare var setInterval: (fn: (...args: any[]) => any, ms?: number, ...args: any[]) => any;
declare var clearInterval: (id?: any) => void;
declare var global: any;
declare var require: any;
declare var module: any;
declare var exports: any;

// ─── Node built-in modules ────────────────────────────────────────
declare module 'crypto' {
  function randomBytes(size: number): any;
  function randomBytes(size: number, callback: (err: Error | null, buf: any) => void): void;
  function createHash(algorithm: string, options?: any): any;
  function randomUUID(): string;
  function randomInt(min: number, max: number): number;
  function randomInt(max: number): number;
  function timingSafeEqual(a: any, b: any): boolean;
  const webcrypto: any;
}

declare module 'node:crypto' {
  export * from 'crypto';
}

declare module 'path' {
  function join(...paths: string[]): string;
  function resolve(...paths: string[]): string;
  function dirname(p: string): string;
  function basename(p: string, ext?: string): string;
  function extname(p: string): string;
  const sep: string;
  const delimiter: string;
}

declare module 'node:path' {
  export * from 'path';
}

declare module 'fs' {
  function readFileSync(path: any, options?: any): any;
  function writeFileSync(path: any, data: any, options?: any): void;
  function existsSync(path: any): boolean;
  function mkdirSync(path: any, options?: any): void;
  function unlinkSync(path: any): void;
  function renameSync(oldPath: any, newPath: any): void;
  function copyFileSync(src: any, dest: any, flags?: number): void;
  function mkdtempSync(prefix: string, options?: any): string;
  function createWriteStream(path: any, options?: any): any;
  function readFile(path: any, options: any, callback: (err: any, data: any) => void): void;
  function statSync(path: any, options?: any): any;
  function readdirSync(path: any, options?: any): any;
}

declare module 'node:fs' {
  export * from 'fs';
}

// ─── Third-party modules ──────────────────────────────────────────
declare module 'express' {
  interface RequestHandler {
    (req: Request, res: Response, next: NextFunction): any;
  }
  interface Request {
    [key: string]: any;
    headers: any;
    body: any;
    params: any;
    query: any;
    cookies: any;
    ip: string;
    baseUrl: string;
    path: string;
    method: string;
    url: string;
    get(name: string): string | undefined;
  }
  // Named exports that TypeScript looks for with { Request, Response, NextFunction } imports
  export type { Request, Response, NextFunction };
  interface Response {
    [key: string]: any;
    status(code: number): this;
    json(body?: any): this;
    send(body?: any): this;
    sendFile(path: string, options?: any, callback?: any): void;
    cookie(name: string, val: any, options?: any): this;
    clearCookie(name: string, options?: any): this;
    setHeader(name: string, value: any): this;
    redirect(url: string): void;
    redirect(status: number, url: string): void;
    end(data?: any): this;
  }
  type NextFunction = (err?: any) => void;
  interface Application {
    [key: string]: any;
    use(...args: any[]): this;
    get(path: any, ...handlers: any[]): this;
    post(path: any, ...handlers: any[]): this;
    put(path: any, ...handlers: any[]): this;
    delete(path: any, ...handlers: any[]): this;
    patch(path: any, ...handlers: any[]): this;
    listen(port: number, host?: string, callback?: () => void): any;
    set(setting: string, val: any): this;
  }
  interface Router {
    [key: string]: any;
    use(...args: any[]): this;
    get(path: any, ...handlers: any[]): this;
    post(path: any, ...handlers: any[]): this;
    put(path: any, ...handlers: any[]): this;
    delete(path: any, ...handlers: any[]): this;
    patch(path: any, ...handlers: any[]): this;
  }
  function express(): Application;
  namespace express {
    function static(root: string, options?: any): RequestHandler;
    function Router(options?: any): Router;
    function json(options?: any): RequestHandler;
    function urlencoded(options?: any): RequestHandler;
  }
  export = express;
}

declare module 'jsonwebtoken' {
  function sign(payload: any, secret: any, options?: any): string;
  function verify(token: string, secret: any, options?: any): any;
  function decode(token: string, options?: any): any;
  class JsonWebTokenError extends Error {}
  class TokenExpiredError extends JsonWebTokenError {}
  namespace jwt {}
  export { sign, verify, decode, JsonWebTokenError, TokenExpiredError };
}

declare module 'bcryptjs' {
  function hashSync(data: string, saltOrRounds: number | string): string;
  function hash(data: string, saltOrRounds: number | string): Promise<string>;
  function compareSync(data: string, encrypted: string): boolean;
  function compare(data: string, encrypted: string): Promise<boolean>;
  function genSaltSync(rounds?: number): string;
  function genSalt(rounds?: number): Promise<string>;
}

declare module 'dotenv' {
  function config(options?: any): { parsed?: Record<string, string>; error?: Error };
  function parse(src: string | Buffer): Record<string, string>;
}

declare module 'pg' {
  class Pool {
    constructor(config?: any);
    connect(): Promise<any>;
    query(text: any, params?: any[]): Promise<{ rows: any[]; rowCount: number; [key: string]: any }>;
    on(event: string, listener: (...args: any[]) => void): this;
    end(): Promise<void>;
  }
  class Client {
    constructor(config?: any);
    connect(): Promise<void>;
    query(text: any, params?: any[]): Promise<{ rows: any[]; rowCount: number }>;
    release(err?: boolean | Error): void;
    end(): Promise<void>;
  }
}

declare module 'cors' {
  function cors(options?: any): any;
  namespace cors {}
  export = cors;
}

declare module 'helmet' {
  function helmet(options?: any): any;
  namespace helmet {}
  export = helmet;
}

declare module 'express-rate-limit' {
  function rateLimit(options?: any): any;
  namespace rateLimit {}
  export = rateLimit;
}

declare module 'vite' {
  function createServer(options?: any): Promise<any>;
  function build(options?: any): Promise<any>;
  interface UserConfig { [key: string]: any; }
  function defineConfig(config: any): any;
}

declare module '@google/genai' {
  class GoogleGenAI {
    constructor(options?: any);
    models: any;
    getGenerativeModel(params: any): any;
  }
  class GenerativeModel {
    generateContent(request: any): Promise<any>;
    generateContentStream(request: any): Promise<any>;
  }
}

declare module 'jspdf' {
  class jsPDF {
    constructor(options?: any);
    [key: string]: any;
  }
  export = jsPDF;
}

declare module 'qrcode' {
  function toDataURL(text: string, options?: any): Promise<string>;
  function toBuffer(text: string, options?: any): Promise<Buffer>;
  function toString(text: string, options?: any): Promise<string>;
}

declare module 'otplib' {
  function generateSecret(): string;
  function generateURI(options: any): string;
  function verifySync(options: any): boolean;
  const authenticator: {
    generateSecret(): string;
    keyuri(user: string, service: string, secret: string): string;
    verify(options: { token: string; secret: string }): boolean;
    generate(secret: string): string;
  };
}

declare module 'nodemailer' {
  function createTransporter(options: any): any;
  function createTransport(options: any): any;
}
