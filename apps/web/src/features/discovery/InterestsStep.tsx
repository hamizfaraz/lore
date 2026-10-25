'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

const QUESTIONS = [
  ['weekends', 'Ideal weekend', ['outdoors', 'live music', 'movies', 'food']],
  ['energy', 'Social energy', ['small groups', 'big events', 'one-on-one']],
  ['movement', 'Move your way', ['climbing', 'running', 'cycling', 'yoga']],
  ['culture', 'Explore culture', ['museums', 'books', 'theater', 'history']],
  ['making', 'Make something', ['cooking', 'photography', 'art', 'coding']],
  ['games', 'Play together', ['board games', 'gaming', 'trivia', 'sports']],
  ['pace', 'Favorite pace', ['spontaneous', 'planned', 'low-key']],
  ['cause', 'Community time', ['volunteering', 'mentoring', 'environment']],
] as const;

export function InterestsStep({
  onDone,
  suggestedTags = [],
}: { onDone: () => void; suggestedTags?: { tag: string; from: 'facebook' }[] }) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const toggle = (id: string, value: string) =>
    setAnswers((current) => ({
      ...current,
      [id]: current[id]?.includes(value)
        ? current[id]!.filter((item) => item !== value)
        : [...(current[id] ?? []), value],
    }));
  const save = async () => {
    setSaving(true);
    try {
      await api.put('/v1/discovery/quiz', {
        answers: QUESTIONS.map(([questionId]) => ({ questionId, answer: answers[questionId] ?? [] })),
      });
      if (suggestedTags.length)
        await api.put('/v1/discovery/profile', {
          explicitTags: [
            ...new Set([...Object.values(answers).flat(), ...suggestedTags.map(({ tag }) => tag)]),
          ],
        });
      onDone();
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[22px] font-semibold">Find your people</h2>
        <p className="mt-1 text-sm text-ink-2">
          Optional. Choose as much or as little as you like; discovery stays off until you opt in.
        </p>
      </div>
      {QUESTIONS.map(([id, label, options]) => (
        <fieldset key={id}>
          <legend className="text-sm font-semibold">{label}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => toggle(id, option)}
                className={`rounded-full border px-3 py-1.5 text-sm ${answers[id]?.includes(option) ? 'border-action bg-action text-white' : 'hairline bg-bg'}`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="flex gap-2">
        <Button loading={saving} onClick={save}>
          Save interests
        </Button>
        <Button variant="text" onClick={onDone}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}
