import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

/**
 * Delete account placeholder.
 * TODO(backend): soft-delete user, anonymise orders, revoke tokens.
 */
export default function DeleteAccount() {
  const { user, logout } = useAuth();
  const [confirm, setConfirm] = useState('');

  return (
    <div className="px-4 pt-6 pb-8 space-y-4">
      <PageHeader title="Delete account" subtitle="Permanent action" />

      <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Trash2 className="w-5 h-5 text-destructive shrink-0" />
          <div>
            <p className="font-semibold text-sm text-destructive">This cannot be undone</p>
            <p className="text-xs text-muted-foreground mt-1">
              Deleting your account will remove profile data, wallet balance access, and loyalty points.
              Order history may be retained for legal/compliance reasons.
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2">
          Type <strong>DELETE</strong> to confirm ({user?.email})
        </p>
        <Input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="DELETE"
          className="rounded-xl"
        />
      </div>

      <Button
        variant="destructive"
        className="w-full rounded-xl"
        disabled={confirm !== 'DELETE'}
        onClick={() => {
          toast.message('Account deletion is not enabled in this demo');
          // TODO(backend): DELETE /api/v1/account
        }}
      >
        Delete my account
      </Button>

      <Button variant="outline" className="w-full rounded-xl" onClick={logout}>
        Sign out instead
      </Button>
    </div>
  );
}
