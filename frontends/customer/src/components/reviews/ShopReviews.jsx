import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api';
import { Star } from 'lucide-react';

function StarRating({ value, max = 5 }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < Math.round(value) ? 'text-accent fill-accent' : 'text-muted-foreground'}`}
        />
      ))}
    </div>
  );
}

export default function ShopReviews({ shopId }) {
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews', shopId],
    queryFn: () => base44.entities.Review.filter({ shop_id: shopId }, '-created_date', 20),
    enabled: !!shopId,
  });

  if (isLoading) {
    return (
      <div className="px-4 mt-6">
        <h2 className="text-lg font-bold text-foreground mb-3">Reviews</h2>
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (reviews.length === 0) return null;

  const avgFood = reviews.reduce((s, r) => s + (r.food_rating || 0), 0) / reviews.length;
  const avgDelivery = reviews.reduce((s, r) => s + (r.delivery_rating || 0), 0) / reviews.length;

  return (
    <div className="px-4 mt-6">
      <h2 className="text-lg font-bold text-foreground mb-1">Reviews</h2>

      {/* Summary row */}
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-1.5">
          <StarRating value={avgFood} />
          <span className="text-xs text-muted-foreground">Food ({avgFood.toFixed(1)})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StarRating value={avgDelivery} />
          <span className="text-xs text-muted-foreground">Delivery ({avgDelivery.toFixed(1)})</span>
        </div>
      </div>

      <div className="space-y-3">
        {reviews.map((review, idx) => (
          <div key={review.id || idx} className="bg-card rounded-xl p-3.5 border border-border/50">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {review.customer_name || 'Anonymous'}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">Food</span>
                    <StarRating value={review.food_rating} />
                  </div>
                  {review.delivery_rating && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Delivery</span>
                      <StarRating value={review.delivery_rating} />
                    </div>
                  )}
                </div>
              </div>
            </div>
            {review.comment && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{review.comment}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
