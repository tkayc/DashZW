import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { requirePermission, canAccessCustomerApp } from '@/domain/permissions';
import { ROLES, normalizeRole } from '@/domain/roles';

/**
 * Protect screens by role / permission.
 * TODO(backend): Enforce the same checks on every API route.
 */
export function RoleGuard({ permission, roles, children, fallback = null }) {
  const { user, isGuest, isAuthenticated } = useAuth();

  if (roles) {
    const role = isGuest ? ROLES.GUEST : normalizeRole(user?.role);
    if (!roles.includes(role)) {
      return fallback || <Navigate to="/" replace />;
    }
  }

  if (permission && !requirePermission(user || { role: ROLES.GUEST }, permission)) {
    if (isGuest && permission !== 'browse.merchants') {
      return <Navigate to="/login" replace />;
    }
    return fallback || <Navigate to="/" replace />;
  }

  if (!isAuthenticated && !isGuest) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function CustomerAppGuard({ children }) {
  const { user, isGuest, isAuthenticated } = useAuth();
  if (!canAccessCustomerApp(user, isGuest) && isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <p className="font-bold text-foreground mb-2">Wrong portal</p>
          <p className="text-sm text-muted-foreground">
            This account is not a customer. Use the merchant, driver, or admin app.
          </p>
        </div>
      </div>
    );
  }
  return children;
}
