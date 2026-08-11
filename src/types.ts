export type QuestionType = 'text' | 'radio' | 'rating';

export interface Question {
  id: number;
  survey_id: number;
  question_text: string;
  question_type: QuestionType;
  options: string[]; // for 'radio' questions
}

export interface Survey {
  id: number;
  title: string;
  description: string;
  category: string;
  theme?: 'government' | 'corporate' | 'education' | 'research' | 'modern' | 'minimal';
  is_active: boolean;
  created_at: string;
  start_date?: string;
  end_date?: string;
  questions?: Question[];
  total_responses?: number;
  has_responded?: boolean;
}

export interface Demographics {
  age_group?: string; // '18-25', '26-35', '36-45', '46-65', '65+'
  gender?: string; // 'ወንድ', 'ሴት'
  education?: string; // 'ያልተማረ / መሠረታዊ', 'የመጀመሪያ ደረጃ (1-8)', 'ሁለተኛ ደረጃ (9-12)', 'ዲፕሎማ / ሰርተፊኬት', 'የመጀመሪያ ዲግሪ', 'ሁለተኛ ዲግሪና ከዚያ በላይ'
  residence?: string; // 'አዲስ ከተማ', 'ደቼቱ', 'አሰብታ', 'መላካ', 'ቦሌ (ድሬዳዋ)', 'ድሬዳዋ ዙሪያ ገጠር', 'ሌላ'
}

export interface AnswerSubmission {
  question_id: number;
  answer_text?: string;
  rating_value?: number;
}

export interface SurveySubmission {
  survey_id: number;
  demographics?: Demographics;
  answers: AnswerSubmission[];
  captcha_answer?: number;
}

export interface RadioBreakdown {
  option: string;
  count: number;
  percentage: number;
}

export interface RatingBreakdown {
  value: number; // 1 to 5
  count: number;
  percentage: number;
}

export interface DemographicBreakdown {
  label: string;
  count: number;
  percentage: number;
}

export interface DemographicAnalytics {
  age_distribution: DemographicBreakdown[];
  gender_distribution: DemographicBreakdown[];
  education_distribution: DemographicBreakdown[];
  residence_distribution: DemographicBreakdown[];
}

export interface QuestionAnalytics {
  question_id: number;
  question_text: string;
  question_type: QuestionType;
  options: string[];
  radio_data?: RadioBreakdown[];
  rating_average?: number;
  rating_distribution?: RatingBreakdown[];
  text_responses?: { id: number; answer_text: string; submitted_at: string }[];
  total_answers_count: number;
}

export interface SurveyAnalytics {
  survey: Survey;
  total_responses: number;
  questions_analytics: QuestionAnalytics[];
  demographics_analytics?: DemographicAnalytics;
}

export interface AuditLog {
  id: number;
  admin_email: string;
  action: string;
  details: string;
  timestamp: string;
  ip_address?: string;
}

export interface AiReportResponse {
  executive_summary: string;
  key_findings: string[];
  demographic_insights: string;
  policy_recommendations: string[];
  satisfaction_score: number;
  official_header: {
    bureau_name: string;
    city: string;
    generated_date: string;
    ref_code: string;
  };
  full_report_markdown: string;
}

export interface AdminUser {
  id: number;
  email: string;
}

export interface AuthResponse {
  token: string;
  admin: AdminUser;
}

export interface TelegramConfig {
  botToken?: string;
  chatId?: string;
}

