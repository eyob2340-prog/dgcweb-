import React, { useState } from 'react';
import { Database, Copy, Check, Send, Shield, Server, Terminal, Code2 } from 'lucide-react';

export const DbSetupGuide: React.FC = () => {
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  const sqlSchema = `-- Database Schema for Public Opinion & Survey Platform (PostgreSQL / Supabase)

CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS surveys (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'General',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    survey_id INT REFERENCES surveys(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('text', 'radio', 'rating')),
    options JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS responses (
    id SERIAL PRIMARY KEY,
    survey_id INT REFERENCES surveys(id) ON DELETE CASCADE,
    ip_hash VARCHAR(64) NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(survey_id, ip_hash)
);

CREATE TABLE IF NOT EXISTS answers (
    id SERIAL PRIMARY KEY,
    response_id INT REFERENCES responses(id) ON DELETE CASCADE,
    question_id INT REFERENCES questions(id) ON DELETE CASCADE,
    answer_text TEXT,
    rating_value INT CHECK (rating_value BETWEEN 1 AND 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`;

  const envSample = `# Environment Variables (.env)
JWT_SECRET="super-secret-jwt-key-change-in-production"
TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrsTUVwxyZ"
TELEGRAM_CHAT_ID="-100123456789"
DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
ADMIN_EMAIL="admin@ethiopia-opinion.gov.et"
ADMIN_PASSWORD="Admin@123456"`;

  const copyToClipboard = (text: string, setFn: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Intro Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              የዳታቤዝ (PostgreSQL / Supabase) እና Telegram Bot ማዋቀሪያ መመሪያ
            </h2>
            <p className="text-xs text-slate-500">
              ይህ መድረክ በDual-Mode ይሰራል፡ ያለ DATABASE_URL በlocal JSON store በቅጽበት ሲሰራ፣ Supabase/PostgreSQL ሲገናኝ ደግሞ በሙሉ PostgreSQL ይሰራል::
            </p>
          </div>
        </div>
      </div>

      {/* SQL Schema Block */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 border border-slate-800 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Code2 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">1. PostgreSQL / Supabase Schema SQL</h3>
          </div>

          <button
            onClick={() => copyToClipboard(sqlSchema, setCopiedSql)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-colors flex items-center space-x-1.5"
          >
            {copiedSql ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>ተኮፒ አድርጓል!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>SQL ኮፒ አድርግ</span>
              </>
            )}
          </button>
        </div>

        <pre className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed border border-slate-800/80">
          {sqlSchema}
        </pre>
      </div>

      {/* Env Vars Block */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">2. የEnvironment Variables (.env.example) ማዋቀሪያ</h3>
          </div>

          <button
            onClick={() => copyToClipboard(envSample, setCopiedEnv)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-colors flex items-center space-x-1.5"
          >
            {copiedEnv ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span>ተኮፒ አድርጓል!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>.env ኮፒ አድርግ</span>
              </>
            )}
          </button>
        </div>

        <pre className="bg-slate-50 p-4 rounded-xl text-xs font-mono text-slate-800 overflow-x-auto border border-slate-200">
          {envSample}
        </pre>
      </div>

      {/* Telegram Bot Instructions */}
      <div className="bg-sky-50 p-6 rounded-2xl border border-sky-200 space-y-3">
        <div className="flex items-center space-x-2 text-sky-900 font-bold text-sm">
          <Send className="w-5 h-5 text-sky-600" />
          <span>3. የTelegram Bot አሰራር እርምጃዎች (How to create Telegram Bot)</span>
        </div>

        <ol className="list-decimal list-inside text-xs text-sky-950 space-y-2 leading-relaxed pl-1">
          <li>በቴሌግራም ላይ <b>@BotFather</b> በመፈለግ <code>/newbot</code> ብለው አዲስ ቦት ይፍጠሩ::</li>
          <li>የሚሰጥዎትን <b>HTTP API Bot Token</b> (ምሳሌ፡ <code>1234567890:ABC...</code>) ይውሰዱ::</li>
          <li>ቦቱን ወደ አድሚን ቻነልዎ ወይም ግሩፕዎ አድሚን አድርገው ይጨምሩት::</li>
          <li>የቻት/ቻነል ID (ምሳሌ፡ <code>-100123456789</code>) በ <code>TELEGRAM_CHAT_ID</code> ውስጥ ያስገቡ::</li>
          <li>በአድሚን ዳሽቦርድ ላይ <b>"Export to Telegram"</b> በሚለው ቁልፍ ሪፖርቶችን በቅጽበት ይላኩ::</li>
        </ol>
      </div>
    </div>
  );
};
