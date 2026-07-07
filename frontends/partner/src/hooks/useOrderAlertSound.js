/**
 * useOrderAlertSound.js
 *
 * Plays /notification.mp3 on a loop as long as there are unacknowledged orders.
 *
 * Partner: fires when there are PENDING orders not yet confirmed.
 * Driver:  fires when there are READY_FOR_PICKUP orders available.
 *
 * Handles browser autoplay policy:
 *   - Modern browsers block audio until the user has interacted with the page.
 *   - We listen for the first click/tap and then start audio.
 *   - A visible banner always shows even if audio is blocked.
 *
 * Stops when:
 *   - shouldPlay becomes false (orders cleared), OR
 *   - User taps "Silence" button
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const SOUND_URL = '/notification.mp3';
const REPEAT_INTERVAL_MS = 8000; // ring every 8 seconds

/** Fallback beep when notification.mp3 is missing */
function playAlertBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.25;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => ctx.close();
  } catch {
    // ignore
  }
}

export function useOrderAlertSound(shouldPlay) {
  const audioRef     = useRef(null);
  const intervalRef  = useRef(null);
  const [silenced,   setSilenced]   = useState(false);
  const [playing,    setPlaying]    = useState(false);
  const [canPlay,    setCanPlay]    = useState(false); // browser interaction gate

  // Initialise Audio object once
  useEffect(() => {
    const audio = new Audio(SOUND_URL);
    audio.preload = 'auto';
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Gate: mark as interacted after first user gesture so audio is allowed
  useEffect(() => {
    if (canPlay) return;
    const unlock = () => setCanPlay(true);
    window.addEventListener('click',     unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('keydown',   unlock, { once: true });
    return () => {
      window.removeEventListener('click',     unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown',   unlock);
    };
  }, [canPlay]);

  // Start / stop based on shouldPlay, silenced, and canPlay
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (shouldPlay && !silenced && canPlay) {
      const playOnce = () => {
        audio.currentTime = 0;
        audio.play().catch(() => playAlertBeep());
        setPlaying(true);
      };

      playOnce();
      intervalRef.current = setInterval(playOnce, REPEAT_INTERVAL_MS);

      return () => {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        audio.pause();
        setPlaying(false);
      };
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, [shouldPlay, silenced, canPlay]);

  // Auto-reset silenced state when trigger clears (new orders = fresh alert)
  useEffect(() => {
    if (!shouldPlay) setSilenced(false);
  }, [shouldPlay]);

  const silence = useCallback(() => setSilenced(true), []);

  return { playing, silenced, silence, canPlay };
}
