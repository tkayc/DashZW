import React from 'react';
import { Sparkles } from 'lucide-react';
import FeaturePlaceholder from '@/components/shared/FeaturePlaceholder';

/**
 * AI / personalised recommendations surface.
 *
 * TODO(postgresql): recommendation_events, user_preferences.
 * TODO(ml): Ranking service using order history + time of day.
 */
export default function Recommendations() {
  return (
    <FeaturePlaceholder
      title="For you"
      subtitle="Personalised picks"
      icon={Sparkles}
      description="Discover merchants and products tailored to your order history, time of day, and location — similar to “Picks for you” on Uber Eats and DoorDash."
      bullets={[
        'Based on past orders (privacy-safe)',
        'Trending near you',
        'Reorder suggestions',
      ]}
      mockCards={[
        { id: 1, emoji: '✨', title: 'Because you ordered burgers', body: 'Zim Burger Co · 15–25 min', badge: 'Preview' },
        { id: 2, emoji: '🌙', title: 'Late-night essentials', body: 'QuickStop Convenience · Open now', badge: 'Preview' },
      ]}
    />
  );
}
