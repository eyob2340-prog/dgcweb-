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

export const RESIDENCE_CATEGORIES = [
  'የሴክተር ተቋማት',
  'ወረዳ',
  'የገጠር ወረዳዎች',
] as const;

export const SECTOR_INSTITUTIONS = [
  'የመሬት ልማትና ማኔጅመንት ቢሮ',
  'የድሬዳዋ አስተዳደር ጤና ቢሮ',
  'የፋይናንስና ኢኮኖሚ ልማት ቢሮ',
  'የንግድና ኢንዱስትሪ ልማት ቢሮ',
  'የስራ በፈጠራና ክህሎት ቢሮ',
  'ሲቨል ሰርቪስ እና ሰው ሀብት ልማት ቢሮ',
  'የከተማ ልማትና ኮንስትራክሽን ቢሮ',
  'የትምህርት ቢሮ',
  'የጤና ቢሮ',
  'ሴቶች ህፃናትና ወጣቶች ቢሮ',
  'ፍትህ ፀጥታና ህግ ጉዳዮች ቢሮ',
  'ግብርናና ገጠር ልማት ቢሮ',
  'ድሬዳዋ አስተዳደር ምክር ቤት ፅህፈት ቤት',
  'የትራንስፖርትና ሎጀስቲክ ባለስልጣን',
  'የድሬዳዋ ፖሊስ ጠቅላይ መመሪያ',
  'የድሬዳዋ ከተማ ስራ አስኪያጅ ፅህፈት ቤት',
  'ወጣቶችና ስፖርት ኮሚሽን',
  'የድሬዳዋ አሰተዳደር ከንቲባ ፅህፈት ቤት',
] as const;

export const URBAN_WOREDAS = [
  'ወረዳ 01',
  'ወረዳ 02',
  'ወረዳ 03',
  'ወረዳ 04',
  'ወረዳ 05',
  'ወረዳ 06',
  'ወረዳ 07',
  'ወረዳ 08',
  'ወረዳ 09',
] as const;

export const RURAL_WOREDAS = [
  'የዋሂል ክላስተር ፅህፈት ቤት',
  'የቀለአድ ክላስተር ፅህፈት ቤት',
  'አሰሊሶ ክላስተር ፅህፈት ቤት',
  'ቢዮ አዋሌ ክላስተር ፅህፈት ቤት',
] as const;

export interface Demographics {
  age_group?: string; // '18-25', '26-35', '36-45', '46-65', '65+'
  gender?: string; // 'ወንድ', 'ሴት'
  education?: string; // 'ያልተማረ / መሠረታዊ', 'የመጀመሪያ ደረጃ (1-8)', 'ሁለተኛ ደረጃ (9-12)', 'ዲፕሎማ / ሰርተፊኬት', 'የመጀመሪያ ዲግሪ', 'ሁለተኛ ዲግሪና ከዚያ በላይ'
  residence_category?: string; // 'የሴክተር ተቋማት', 'ወረዳ', 'የገጠር ወረዳዎች'
  residence?: string; // Specific institution or woreda name
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
  created_at?: string;
  ip_address?: string;
}

export interface AiReportResponse {
  executive_summary: string;
  introduction?: string;
  key_findings: string[];
  positive_feedback?: string[];
  negative_feedback?: string[];
  section_analyses?: {
    section_number: string;
    title: string;
    positive_points: string[];
    negative_points: string[];
  }[];
  demographic_insights: string;
  policy_recommendations: string[];
  conclusion?: string;
  satisfaction_score: number;
  official_header: {
    bureau_name: string;
    recipient_service?: string;
    city: string;
    generated_date: string;
    ref_code: string;
  };
  full_report_markdown: string;
}

export interface AdminUser {
  id: number;
  email: string;
  username?: string;
  role: 'developer' | 'owner' | 'admin';
  must_change_password?: boolean;
  two_factor_enabled?: boolean;
  created_at?: string;
}

export interface AuthResponse {
  token: string;
  mustChangePassword?: boolean;
  twoFactorEnabled?: boolean;
  admin: AdminUser;
}

export interface TelegramConfig {
  botToken?: string;
  chatId?: string;
}

export type TicketStatus = 'Pending' | 'Under Review' | 'Resolved' | 'Closed';
export type TicketPriority = 'Normal' | 'High' | 'Urgent';

export interface CitizenTicket {
  id: number;
  ticket_code: string;
  category: string;
  residence?: string;
  subject: string;
  description: string;
  full_name?: string;
  phone?: string;
  email?: string;
  priority: TicketPriority;
  status: TicketStatus;
  admin_response?: string;
  responded_at?: string;
  responded_by?: string;
  created_at: string;
}

export interface TicketSubmission {
  category: string;
  residence?: string;
  subject: string;
  description: string;
  full_name?: string;
  phone?: string;
  email?: string;
  priority?: TicketPriority;
}

export interface TranslationResult {
  detected_language: string;
  translated_amharic: string;
  translated_english: string;
}

export interface ErrorLog {
  id: number;
  api_path: string;
  error_type: string;
  message: string;
  stack_trace?: string;
  line_info?: string;
  ip_address?: string;
  timestamp: string;
}

