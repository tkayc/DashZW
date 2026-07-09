import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getRoadSafetyQuiz, submitRoadSafetyQuiz, getDriverOnboardingStatus } from '@/api';

export default function RoadSafetyQuiz() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [q, s] = await Promise.all([getRoadSafetyQuiz(), getDriverOnboardingStatus()]);
        setQuiz(q);
        setStatus(s);
        if (s.quiz_passed) {
          setResult({ passed: true, score: s.quiz_score || 100, already: true });
        }
      } catch (e) {
        toast.error(e.message || 'Could not load quiz');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!quiz?.questions?.length) return;
    const missing = quiz.questions.find((q) => answers[q.id] == null);
    if (missing) {
      toast.error('Please answer every question');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitRoadSafetyQuiz(answers);
      setResult(res);
      if (res.passed) {
        toast.success('Quiz passed — account activated!');
      } else {
        toast.error(`Score ${res.score}% — need ${res.pass_score}% to pass. Try again.`);
      }
    } catch (e) {
      toast.error(e.message || 'Could not submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status && status.verification_status !== 'approved' && !result?.already) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-3">
          <Shield className="w-10 h-10 mx-auto text-amber-600" />
          <h1 className="text-lg font-bold">Documents under review</h1>
          <p className="text-sm text-muted-foreground">
            Verification usually takes 24–72 hours. You can take the road safety quiz after an admin approves your documents.
          </p>
          <Button className="rounded-xl" onClick={() => navigate('/onboarding')}>
            View status
          </Button>
        </div>
      </div>
    );
  }

  if (result?.passed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-700" />
          </div>
          <h1 className="text-xl font-bold">You&apos;re ready to deliver</h1>
          <p className="text-sm text-muted-foreground">
            {result.already
              ? 'Your road safety quiz is already complete.'
              : `You scored ${result.score}%. Your account is now active.`}
          </p>
          <Button className="w-full rounded-xl" onClick={() => navigate('/jobs')}>
            View available jobs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 max-w-lg mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Road safety quiz</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Score at least {quiz?.pass_score || 80}% to activate your account and start accepting deliveries.
        </p>
      </div>

      {result && !result.passed && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-red-50 border border-red-200 p-3 text-red-800">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs">
            You scored {result.score}% ({result.correct}/{result.total}). Review the questions and try again.
          </p>
        </div>
      )}

      <div className="space-y-5">
        {quiz?.questions?.map((q, idx) => (
          <div key={q.id} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-sm font-semibold text-foreground mb-3">
              {idx + 1}. {q.question}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <button
                  key={oi}
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                  className={`w-full text-left text-sm px-3 py-2.5 rounded-xl border transition-colors ${
                    answers[q.id] === oi
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-border text-foreground hover:bg-muted/40'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button
        className="w-full rounded-xl h-12 mt-6 font-bold"
        disabled={submitting}
        onClick={handleSubmit}
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit quiz'}
      </Button>
    </div>
  );
}
