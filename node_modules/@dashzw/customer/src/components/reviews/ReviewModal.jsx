import React, { useState } from 'react';
import { base44 } from '@/api';
import { Star, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

function StarPicker({ value, onChange, label }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-1.5">{label}</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                star <= (hovered || value)
                  ? 'text-accent fill-accent'
                  : 'text-muted-foreground'
              }`}
            />
          </button>
        ))}
        {value > 0 && (
          <span className="ml-2 text-sm text-muted-foreground">{value}/5</span>
        )}
      </div>
    </div>
  );
}

export default function ReviewModal({ order, onClose, onSubmitted }) {
  const [foodRating, setFoodRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!foodRating) {
      toast.error('Please rate the food');
      return;
    }
    if (!deliveryRating) {
      toast.error('Please rate the delivery');
      return;
    }

    setSubmitting(true);
    try {
      await base44.entities.Review.create({
        order_id: order.id,
        shop_id: order.shop_id,
        shop_name: order.shop_name,
        customer_email: order.customer_email,
        customer_name: order.customer_name,
        driver_email: order.driver_email,
        driver_name: order.driver_name,
        food_rating: foodRating,
        delivery_rating: deliveryRating,
        comment: comment.trim() || undefined,
      });
      toast.success('Thank you for your review!');
      onSubmitted?.();
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative z-10 w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-foreground">Rate Your Experience</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{order.shop_name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-5">
          <StarPicker
            value={foodRating}
            onChange={setFoodRating}
            label="🍔 How was the food?"
          />
          <StarPicker
            value={deliveryRating}
            onChange={setDeliveryRating}
            label="🛵 How was the delivery?"
          />
          <div>
            <p className="text-sm font-medium text-foreground mb-1.5">
              Comments <span className="text-muted-foreground font-normal">(optional)</span>
            </p>
            <Textarea
              placeholder="Tell us more about your experience..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="rounded-xl bg-muted/50 border-0 h-20 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-xl bg-primary hover:bg-primary/90"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
            ) : (
              'Submit Review'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
