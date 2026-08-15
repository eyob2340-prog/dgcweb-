import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, HelpCircle, Save, CheckCircle2, ListPlus, Edit3 } from 'lucide-react';
import { QuestionType, Survey } from '../types';

interface SurveyBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSurveyCreated: () => void;
  adminToken: string;
  surveyToEdit?: Survey | null;
}

interface NewQuestion {
  id?: number;
  question_text: string;
  question_type: QuestionType;
  options: string[];
}

export const SurveyBuilderModal: React.FC<SurveyBuilderModalProps> = ({
  isOpen,
  onClose,
  onSurveyCreated,
  adminToken,
  surveyToEdit,
}) => {
  const isEditing = Boolean(surveyToEdit);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('ፖለቲካ እና ኢኮኖሚ');
  const [theme, setTheme] = useState<'government' | 'corporate' | 'education' | 'research' | 'modern' | 'minimal'>('government');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [questions, setQuestions] = useState<NewQuestion[]>([
    {
      question_text: 'ስለ አዲሱ የፖሊሲ ማሻሻያ የእርስዎን ስምምነት ደረጃ ይግለጹ፡',
      question_type: 'radio',
      options: ['በጣም እስማማለሁ', 'በከፊል እስማማለሁ', 'ያልወሰንኩ', 'አልስማማለሁ'],
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill form if editing an existing survey
  useEffect(() => {
    if (surveyToEdit) {
      setTitle(surveyToEdit.title || '');
      setDescription(surveyToEdit.description || '');
      setCategory(surveyToEdit.category || 'ፖለቲካ እና ኢኮኖሚ');
      setTheme(surveyToEdit.theme || 'government');
      setStartDate(surveyToEdit.start_date ? surveyToEdit.start_date.split('T')[0] : new Date().toISOString().split('T')[0]);
      setEndDate(surveyToEdit.end_date ? surveyToEdit.end_date.split('T')[0] : '');
      if (Array.isArray(surveyToEdit.questions) && surveyToEdit.questions.length > 0) {
        setQuestions(
          surveyToEdit.questions.map((q) => ({
            id: q.id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options && q.options.length > 0 ? [...q.options] : ['አዎ', 'አይደለም'],
          }))
        );
      }
    } else {
      // Reset to defaults for new survey
      setTitle('');
      setDescription('');
      setCategory('ፖለቲካ እና ኢኮኖሚ');
      setTheme('government');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setQuestions([
        {
          question_text: 'ስለ አዲሱ የፖሊሲ ማሻሻያ የእርስዎን ስምምነት ደረጃ ይግለጹ፡',
          question_type: 'radio',
          options: ['በጣም እስማማለሁ', 'በከፊል እስማማለሁ', 'ያልወሰንኩ', 'አልስማማለሁ'],
        },
      ]);
    }
  }, [surveyToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        question_text: '',
        question_type: 'radio',
        options: ['በጣም ጥሩ', 'መካከለኛ', 'ዝቅተኛ'],
      },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, field: string, value: any) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleOptionChange = (qIndex: number, optIndex: number, value: string) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const opts = [...copy[qIndex].options];
      opts[optIndex] = value;
      copy[qIndex].options = opts;
      return copy;
    });
  };

  const handleAddOption = (qIndex: number) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[qIndex].options = [...copy[qIndex].options, 'አዲስ አማራጭ'];
      return copy;
    });
  };

  const handleRemoveOption = (qIndex: number, optIndex: number) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[qIndex].options = copy[qIndex].options.filter((_, i) => i !== optIndex);
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('እባክዎ የመጠይቅ ርዕስ ያስገቡ::');
      return;
    }

    if (questions.length === 0) {
      setError('ቢያንስ አንድ ጥያቄ መጨመር ያስፈልጋል::');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].question_text.trim()) {
        setError(`ጥያቄ #${i + 1} ባዶ ነው:: እባክዎ የጥያቄ ጽሁፍ ያስገቡ::`);
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = isEditing ? `/api/admin/surveys/${surveyToEdit?.id}` : '/api/admin/surveys';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          title,
          description,
          category,
          theme,
          start_date: startDate,
          end_date: endDate || undefined,
          questions,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onSurveyCreated();
        onClose();
      } else {
        setError(data.error || (isEditing ? 'መጠይቁን ማስተካከል አልተቻለም::' : 'መጠይቁን መፍጠር አልተቻለም::'));
      }
    } catch (err) {
      setError('የኔትወርክ ስህተት::');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2">
            {isEditing ? (
              <Edit3 className="w-6 h-6 text-amber-400" />
            ) : (
              <ListPlus className="w-6 h-6 text-emerald-400" />
            )}
            <h2 className="text-xl font-bold">
              {isEditing ? `የጥናት መጠይቅ አርትዖት (Edit Survey #${surveyToEdit?.id})` : 'አዲስ የሕዝብ መጠይቅ መፍጠሪያ (Survey Builder)'}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isEditing
              ? 'የመጠይቁን ርዕስ፣ መግለጫ፣ መደብ እና ጥያቄዎች እዚህ ማስተካከልና ማዘመን ይችላሉ::'
              : 'አዳዲስ የፖለቲካ፣ የኢኮኖሚ እና የማህበራዊ ጉዳይ መጠይቆችን በቀላሉ መፍጠር ይችላሉ::'}
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Survey Details */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                የጥናት ርዕስ (Survey Title) *
              </label>
              <input
                type="text"
                required
                placeholder="ምሳሌ፡ የ2026/2018 የፓርላማና የኢኮኖሚ አፈጻጸም የሕዝብ አስተያየት"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  የጥናት መደብ (Category)
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ፖለቲካ እና ኢኮኖሚ">ፖለቲካ እና ኢኮኖሚ</option>
                  <option value="መሠረተ ልማት">መሠረተ ልማት</option>
                  <option value="ማህበራዊ ጉዳዮች">ማህበራዊ ጉዳዮች</option>
                  <option value="አጠቃላይ">አጠቃላይ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  የጥናት ዲዛይን ገጽታ (Survey Theme)
                </label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as any)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="government">🏛️ Government (Navy Blue & Gold)</option>
                  <option value="corporate">🏢 Corporate (Emerald & Slate)</option>
                  <option value="education">🎓 Education (Indigo & Purple)</option>
                  <option value="research">🔬 Research (Teal & Cyan)</option>
                  <option value="modern">✨ Modern (Rose & Dark Obsidian)</option>
                  <option value="minimal">✏️ Minimal (Monochrome Slate)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ማብራሪያ (Description)
                </label>
                <input
                  type="text"
                  placeholder="አጭር መግለጫ..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  የሚጀመርበት ቀን (Start Date)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  የሚያበቃበት ቀን (End Date) - አማራጭ
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Dynamic Questions Builder */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-800">የመጠይቅ ጥያቄዎች ({questions.length})</h3>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ጥያቄ ጨምር</span>
              </button>
            </div>

            {questions.map((q, qIndex) => (
              <div
                key={qIndex}
                className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 relative shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    ጥያቄ #{qIndex + 1}
                  </span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(qIndex)}
                      className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> ሰርዝ
                    </button>
                  )}
                </div>

                <div>
                  <input
                    type="text"
                    required
                    placeholder="የጥያቄው ጽሁፍ..."
                    value={q.question_text}
                    onChange={(e) => handleQuestionChange(qIndex, 'question_text', e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">የጥያቄ ዓይነት</label>
                    <select
                      value={q.question_type}
                      onChange={(e) =>
                        handleQuestionChange(qIndex, 'question_type', e.target.value as QuestionType)
                      }
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    >
                      <option value="radio">ምርጫ (Radio Button)</option>
                      <option value="rating">ደረጃ (Rating 1-5)</option>
                      <option value="text">ጽሁፍ (Open-ended Text)</option>
                    </select>
                  </div>
                </div>

                {/* Options for Radio */}
                {q.question_type === 'radio' && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="block text-xs font-semibold text-slate-600">
                      የምርጫ አማራጮች (Choice Options):
                    </label>
                    {q.options.map((opt, optIndex) => (
                      <div key={optIndex} className="flex items-center space-x-2">
                        <input
                          type="text"
                          required
                          value={opt}
                          onChange={(e) => handleOptionChange(qIndex, optIndex, e.target.value)}
                          className="flex-grow p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                        />
                        {q.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(qIndex, optIndex)}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAddOption(qIndex)}
                      className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> ሌላ አማራጭ ጨምር
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
            >
              ሰርዝ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'በመፍጠር ላይ...' : 'መጠይቁን መዝግብ (Save Survey)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
