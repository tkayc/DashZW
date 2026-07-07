import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Check, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  getNotifications,
  markAllRead,
  markRead,
  deleteNotification,
  subscribeToDbChanges,
} from '@/api';

const TYPE_COLORS = {
  order_placed: 'bg-blue-50 border-blue-200',
  order_confirmed: 'bg-blue-50 border-blue-200',
  order_preparing: 'bg-orange-50 border-orange-200',
  order_ready_for_pickup: 'bg-purple-50 border-purple-200',
  order_picked_up: 'bg-indigo-50 border-indigo-200',
  order_on_the_way: 'bg-cyan-50 border-cyan-200',
  order_delivered: 'bg-green-50 border-green-200',
  order_cancelled: 'bg-red-50 border-red-200',
  item_unavailable: 'bg-yellow-50 border-yellow-200',
  wallet_credited: 'bg-green-50 border-green-200',
  driver_blocked: 'bg-red-50 border-red-200',
  new_order: 'bg-primary/5 border-primary/20',
  job_available: 'bg-accent/5 border-accent/20',
  shop_approved: 'bg-green-50 border-green-200',
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!user?.email || isGuest) return;
    try {
      const personal = await getNotifications(user.email);
      const driverBroadcast =
        user.role === 'driver' ? await getNotifications('__drivers__') : [];
      const all = [...(personal || []), ...(driverBroadcast || [])]
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
        .slice(0, 50);
      setNotifs(all);
      setUnread(all.filter((n) => !n.is_read).length);
    } catch (e) {
      console.warn('[DashZW] notifications refresh failed', e);
    }
  }, [user?.email, user?.role, isGuest]);

  useEffect(() => {
    refresh();
    const unsub = subscribeToDbChanges(() => {
      refresh();
    });
    const interval = setInterval(refresh, 3000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = async () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && user?.email && !isGuest) {
      try {
        await markAllRead(user.email);
        if (user.role === 'driver') await markAllRead('__drivers__');
      } catch {}
      setUnread(0);
      refresh();
    }
  };

  const handleClick = async (n) => {
    try {
      await markRead(n.id);
    } catch {}
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setNotifs((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
      >
        <Bell className="w-5 h-5 text-foreground" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 max-h-96 overflow-y-auto bg-card border border-border rounded-2xl shadow-xl z-50">
          <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
            <p className="font-bold text-sm text-foreground">Notifications</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate('/notifications');
                }}
                className="text-[10px] font-semibold text-primary"
              >
                See all
              </button>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          {notifs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No notifications yet</div>
          ) : (
            notifs.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-muted/40 transition-colors ${
                  TYPE_COLORS[n.type] || ''
                } ${n.is_read ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_date)}</p>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleDelete(e, n.id)}
                    className="shrink-0 p-1 rounded-lg hover:bg-muted cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </span>
                </div>
              </button>
            ))
          )}
          {notifs.length > 0 && (
            <div className="px-4 py-2 text-center text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <Check className="w-3 h-3" /> Tap to open
            </div>
          )}
        </div>
      )}
    </div>
  );
}
