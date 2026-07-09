import React, { useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api';

/**
 * Simple inline 5-star rating — no popup.
 * One tap submits the rating for the whole experience.
 */
export default function InlineStarRating({
  order,
  label = 'Rate your experience',
  alreadyRated = false,
  onSubmitted,
}) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(alreadyRated);

  const submit = async (value) => {
    if (done || submitting) return;
    setRating(value);
    setSubmitting(true);
    try {
      const isCourier =
        order.order_kind === 'courier' ||
        order.merchant_category === 'courier' ||
        order.shop_id === 'courier_platform';

      await base44.entities.Review.create({
        order_id: order.id,
        shop_id: order.shop_id,
        merchant_id: order.merchant_id || order.shop_id,
        shop_name: order.shop_name || order.merchant_name,
        customer_email: order.customer_email,
        customer_name: order.customer_name,
        driver_email: order.driver_email,
        driver_name: order.driver_name,
        food_rating: isCourier ? value : value,
        delivery_rating: value,
        merchant_rating: isCourier ? null : value,
        driver_rating: value,
        comment: undefined,
      });
      setDone(true);
      toast.success('Thanks for your rating!');
      onSubmitted?.(value);
    } catch (err) {
      console.error(err);
      setRating(0);
      toast.error('Could not save rating. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 p-4 text-center">
        <div className="flex items-center justify-center gap-1 mb-1.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`w-6 h-6 ${
                star <= (rating || 5) ? 'text-accent fill-accent' : 'text-muted-foreground'
              }`}
            />
          ))}
        </div>
        <p className="text-sm font-medium text-primary">Thanks for your feedback!</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-4 text-center">
      <p className="text-sm font-semibold text-foreground mb-3">{label}</p>
      <div className="flex items-center justify-center gap-1.5">
        {submitting ? (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        ) : (
          [1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => submit(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              className="p-0.5 transition-transform hover:scale-110 active:scale-95"
              aria-label={`Rate ${star} stars`}
            >
              <Star
                className={`w-8 h-8 transition-colors ${
                  star <= (hovered || rating)
                    ? 'text-accent fill-accent'
                    : 'text-muted-foreground'
                }`}
              />
            </button>
          ))
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">Tap a star to rate</p>
    </div>
  );
}
