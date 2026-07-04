import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X, Phone, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { createNotification, getChatMessages, saveChatMessages } from '@/api';

/**
 * OrderChat — masked in-app messaging for an order.
 * Participants: customer, driver (if assigned), partner.
 * No phone numbers are revealed.
 */
export default function OrderChat({ order, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const bottomRef = useRef(null);

  const load = () => getChatMessages(order.id).then(setMessages).catch(() => setMessages([]));

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [order.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const myRole = () => {
    if (user?.email === order.customer_email) return 'customer';
    if (user?.email === order.driver_email)   return 'driver';
    if (user?.email === order.partner_email)  return 'partner';
    return 'unknown';
  };

  const myLabel = () => {
    const r = myRole();
    if (r === 'customer') return user?.full_name || 'Customer';
    if (r === 'driver')   return 'Driver';
    if (r === 'partner')  return order.merchant_name || order.shop_name || 'Merchant';
    return user?.full_name;
  };

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const msg = {
      id:        Date.now().toString(36),
      sender:    user?.email,
      role:      myRole(),
      label:     myLabel(),
      text,
      timestamp: new Date().toISOString(),
    };
    const updated = [...messages, msg];
    saveChatMessages(order.id, updated);
    setMessages(updated);
    setInput('');

    // Notify the other participants
    const recipients = [order.customer_email, order.driver_email, order.partner_email]
      .filter(e => e && e !== user?.email);
    recipients.forEach(email => createNotification({
      recipient_email: email,
      title: `💬 Message from ${myLabel()}`,
      body: text.length > 60 ? text.slice(0, 57) + '…' : text,
      type: 'order_update',
      link: `/order/${order.id}`,
    }));
  };

  const isMe = (msg) => msg.sender === user?.email;

  const roleColor = {
    customer: 'bg-primary text-primary-foreground',
    driver:   'bg-orange-500 text-white',
    partner:  'bg-purple-500 text-white',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="bg-card w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-border flex flex-col"
        style={{ maxHeight: '80vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            <div>
              <p className="font-bold text-sm text-foreground">Order Chat</p>
              <p className="text-xs text-muted-foreground">
                {[
                  order.customer_email && 'Customer',
                  order.driver_email   && 'Driver',
                  order.partner_email  && 'Merchant',
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium">
              🔒 Private
            </span>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Privacy notice */}
        <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground text-center shrink-0">
          Phone numbers are never shared. All messages are private to this order.
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <MessageCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start the conversation below</p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex flex-col gap-1 ${isMe(msg) ? 'items-end' : 'items-start'}`}>
              {!isMe(msg) && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${roleColor[msg.role] || 'bg-muted text-foreground'}`}>
                  {msg.label}
                </span>
              )}
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                isMe(msg)
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-muted text-foreground rounded-bl-sm'
              }`}>
                {msg.text}
              </div>
              <span className="text-[10px] text-muted-foreground px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Quick replies */}
        <div className="px-4 pt-2 pb-1 flex gap-2 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
          {["I'm on my way!", "Please be ready at the door.", "Running 5 mins late.", "At the merchant now."].map(q => (
            <button key={q} onClick={() => setInput(q)}
              className="text-xs bg-muted rounded-full px-3 py-1.5 whitespace-nowrap shrink-0 hover:bg-muted/80">
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border shrink-0">
          <input
            className="flex-1 bg-muted/60 rounded-2xl px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Type a message…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
          />
          <button onClick={send} disabled={!input.trim()}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 shrink-0">
            <Send className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
