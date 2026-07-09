/**
 * Driver onboarding — registration docs, admin verification, road safety quiz.
 */
import { localDb } from '../../db/localDb.js';
import { query, isPostgresEnabled } from '../../db/pg.js';
import { registerUser } from '../authentication/users.js';
import { createNotification } from '../notifications/notifications.js';
import { normalizeCourierVehicle } from '../../domain/courierVehicles.js';
import { ROAD_SAFETY_QUIZ, QUIZ_PASS_SCORE, QUIZ_VERSION } from '../../domain/roadSafetyQuiz.js';

export const DRIVER_VERIFICATION = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

function ageFromDob(dob) {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
}

function parseMeta(row) {
  if (!row) return {};
  if (typeof row.metadata === 'string') {
    try {
      return JSON.parse(row.metadata || '{}');
    } catch {
      return {};
    }
  }
  return row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
}

async function findProfileByEmail(email) {
  const em = String(email || '').toLowerCase();
  if (isPostgresEnabled()) {
    const r = await query('SELECT * FROM driver_profiles WHERE lower(email) = lower($1) LIMIT 1', [em]);
    return r.rows[0] || null;
  }
  const rows = await localDb.entities.DriverProfile.filter({ email: em }, '-updated_date', 5);
  return rows[0] || null;
}

async function upsertDriverProfile(email, patch) {
  const existing = await findProfileByEmail(email);
  const now = new Date().toISOString();

  if (isPostgresEnabled()) {
    const meta = { ...parseMeta(existing), ...(patch.metadata || {}) };
    if (existing) {
      await query(
        `UPDATE driver_profiles SET
           vehicle_type = COALESCE($2, vehicle_type),
           license_number = COALESCE($3, license_number),
           metadata = $4::jsonb,
           updated_at = NOW()
         WHERE lower(email) = lower($1)`,
        [email, patch.vehicle_type || null, patch.license_number || null, JSON.stringify(meta)]
      );
    } else {
      const userRes = await query('SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1', [email]);
      const userId = userRes.rows[0]?.id;
      if (!userId) throw new Error('Driver user not found');
      await query(
        `INSERT INTO driver_profiles (user_id, email, vehicle_type, license_number, is_online, metadata)
         VALUES ($1, $2, $3, $4, FALSE, $5::jsonb)
         ON CONFLICT (email) DO UPDATE SET
           vehicle_type = EXCLUDED.vehicle_type,
           license_number = EXCLUDED.license_number,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()`,
        [userId, email.toLowerCase(), patch.vehicle_type || 'motorbike', patch.license_number || null, JSON.stringify(meta)]
      );
    }
    return findProfileByEmail(email);
  }

  const payload = {
    email: email.toLowerCase(),
    vehicle_type: patch.vehicle_type || existing?.vehicle_type || 'motorbike',
    license_number: patch.license_number || existing?.license_number || null,
    is_online: existing?.is_online ?? false,
    rating: existing?.rating ?? 5,
    full_name: patch.full_name || existing?.full_name || '',
    ...existing,
    ...patch,
    metadata: { ...parseMeta(existing), ...(patch.metadata || {}) },
    updated_date: now,
  };

  if (existing?.id) {
    return localDb.entities.DriverProfile.update(existing.id, payload);
  }
  return localDb.entities.DriverProfile.create({
    ...payload,
    id: `drv_${Date.now().toString(36)}`,
    created_date: now,
  });
}

function profileToApi(row) {
  if (!row) return null;
  const meta = parseMeta(row);
  const verification_status =
    meta.verification_status ||
    (meta.documents ? DRIVER_VERIFICATION.PENDING : DRIVER_VERIFICATION.APPROVED);
  const quiz_passed = meta.quiz_passed != null ? !!meta.quiz_passed : !meta.documents;
  return {
    id: row.id || row.user_id,
    email: row.email,
    vehicle_type: normalizeCourierVehicle(row.vehicle_type) || row.vehicle_type || 'motorbike',
    license_number: row.license_number || meta.license_number || null,
    is_online: row.is_online !== false,
    rating: row.rating != null ? Number(row.rating) : 5,
    current_lat: row.current_lat != null ? Number(row.current_lat) : null,
    current_lng: row.current_lng != null ? Number(row.current_lng) : null,
    verification_status,
    date_of_birth: meta.date_of_birth || null,
    phone: meta.phone || null,
    documents: meta.documents || {},
    rejection_reason: meta.rejection_reason || null,
    verified_at: meta.verified_at || null,
    verified_by: meta.verified_by || null,
    quiz_passed,
    quiz_passed_at: meta.quiz_passed_at || null,
    quiz_score: meta.quiz_score ?? null,
    quiz_version: meta.quiz_version || null,
    account_active: verification_status === DRIVER_VERIFICATION.APPROVED && !!quiz_passed,
    full_name: row.full_name || meta.full_name || null,
    created_date: row.created_date || row.created_at,
    updated_date: row.updated_date || row.updated_at,
    metadata: meta,
  };
}

export async function registerDriver(payload = {}) {
  const {
    email,
    password,
    full_name,
    phone,
    date_of_birth,
    vehicle_type,
    license_number,
    documents = {},
  } = payload;

  if (!email?.trim() || !password || !full_name?.trim()) {
    throw new Error('Name, email and password are required');
  }
  if (!date_of_birth) throw new Error('Date of birth is required');
  const age = ageFromDob(date_of_birth);
  if (age == null) throw new Error('Invalid date of birth');
  if (age < 21) throw new Error('Drivers must be at least 21 years old');

  const vehicle = normalizeCourierVehicle(vehicle_type);
  if (!vehicle) throw new Error('Select a valid vehicle type (motorbike, car, or van)');

  const requiredDocs = ['id_document', 'drivers_license', 'vehicle_photo', 'profile_photo'];
  for (const key of requiredDocs) {
    if (!documents[key]) throw new Error(`Please upload your ${key.replace(/_/g, ' ')}`);
  }

  const user = await registerUser({
    email: email.trim().toLowerCase(),
    password,
    full_name: full_name.trim(),
    role: 'driver',
    phone: phone || '',
  });

  const meta = {
    verification_status: DRIVER_VERIFICATION.PENDING,
    date_of_birth,
    phone: phone || '',
    full_name: full_name.trim(),
    documents: {
      id_document: documents.id_document,
      drivers_license: documents.drivers_license,
      vehicle_photo: documents.vehicle_photo,
      profile_photo: documents.profile_photo,
    },
    quiz_passed: false,
    submitted_at: new Date().toISOString(),
  };

  const profile = await upsertDriverProfile(user.email, {
    vehicle_type: vehicle,
    license_number: license_number || null,
    full_name: full_name.trim(),
    metadata: meta,
  });

  await createNotification({
    recipient_email: 'admin@dashzw.com',
    title: '🆕 New driver registration',
    body: `${full_name} applied as a ${vehicle} driver — review documents in Admin → Drivers.`,
    type: 'driver_registration',
    link: '/drivers',
  }).catch(() => {});

  await createNotification({
    recipient_email: user.email,
    title: 'Application received',
    body: 'Your documents were submitted. Verification usually takes 24–72 hours. After approval, complete the road safety quiz to start accepting jobs.',
    type: 'driver_registration',
    link: '/onboarding',
  }).catch(() => {});

  return {
    user,
    profile: profileToApi(profile),
    message: 'Registration submitted. An admin will verify your documents within 24–72 hours.',
  };
}

export async function getDriverOnboardingStatus(email) {
  const profile = await findProfileByEmail(email);
  if (!profile) {
    return {
      verification_status: DRIVER_VERIFICATION.PENDING,
      quiz_passed: false,
      account_active: false,
      needs_registration: true,
    };
  }
  return profileToApi(profile);
}

export async function listPendingDrivers() {
  if (isPostgresEnabled()) {
    const r = await query(
      `SELECT dp.*, u.full_name, u.phone AS user_phone, u.is_active, u.created_at AS user_created
       FROM driver_profiles dp
       LEFT JOIN users u ON u.id = dp.user_id
       ORDER BY dp.updated_at DESC
       LIMIT 200`
    );
    return r.rows
      .map((row) => profileToApi({ ...row, full_name: row.full_name, phone: row.user_phone || parseMeta(row).phone }))
      .filter(Boolean);
  }
  const rows = await localDb.entities.DriverProfile.list('-updated_date', 200);
  return rows.map(profileToApi);
}

export async function setDriverVerification(adminEmail, driverEmail, { status, reason } = {}) {
  if (![DRIVER_VERIFICATION.APPROVED, DRIVER_VERIFICATION.REJECTED, DRIVER_VERIFICATION.PENDING].includes(status)) {
    throw new Error('Invalid verification status');
  }
  const profile = await findProfileByEmail(driverEmail);
  if (!profile) throw new Error('Driver profile not found');

  const meta = {
    ...parseMeta(profile),
    verification_status: status,
    rejection_reason: status === DRIVER_VERIFICATION.REJECTED ? (reason || 'Documents rejected') : null,
    verified_at: status === DRIVER_VERIFICATION.APPROVED ? new Date().toISOString() : null,
    verified_by: adminEmail,
  };

  // Reset quiz if re-pending or rejected
  if (status !== DRIVER_VERIFICATION.APPROVED) {
    meta.quiz_passed = false;
    meta.quiz_passed_at = null;
    meta.quiz_score = null;
  }

  const updated = await upsertDriverProfile(driverEmail, { metadata: meta });

  if (status === DRIVER_VERIFICATION.APPROVED) {
    await createNotification({
      recipient_email: driverEmail,
      title: '✅ Documents approved',
      body: 'Your driver documents were verified. Complete the road safety quiz to activate your account and start accepting deliveries.',
      type: 'driver_approved',
      link: '/quiz',
    }).catch(() => {});
  } else if (status === DRIVER_VERIFICATION.REJECTED) {
    await createNotification({
      recipient_email: driverEmail,
      title: '❌ Documents rejected',
      body: reason || 'Please re-submit clearer documents from the driver app.',
      type: 'driver_rejected',
      link: '/onboarding',
    }).catch(() => {});
  }

  return profileToApi(updated);
}

export function getRoadSafetyQuiz() {
  return {
    version: QUIZ_VERSION,
    pass_score: QUIZ_PASS_SCORE,
    questions: ROAD_SAFETY_QUIZ.map(({ id, question, options }) => ({ id, question, options })),
  };
}

export async function submitRoadSafetyQuiz(email, answers = {}) {
  const profile = await findProfileByEmail(email);
  if (!profile) throw new Error('Driver profile not found');
  const api = profileToApi(profile);
  if (api.verification_status !== DRIVER_VERIFICATION.APPROVED) {
    throw new Error('Your documents must be approved before you can take the quiz');
  }

  let correct = 0;
  for (const q of ROAD_SAFETY_QUIZ) {
    if (Number(answers[q.id]) === q.correctIndex) correct += 1;
  }
  const score = Math.round((correct / ROAD_SAFETY_QUIZ.length) * 100);
  const passed = score >= QUIZ_PASS_SCORE;

  const meta = {
    ...parseMeta(profile),
    quiz_score: score,
    quiz_version: QUIZ_VERSION,
    quiz_attempts: (parseMeta(profile).quiz_attempts || 0) + 1,
    last_quiz_at: new Date().toISOString(),
  };

  if (passed) {
    meta.quiz_passed = true;
    meta.quiz_passed_at = new Date().toISOString();
  }

  const updated = await upsertDriverProfile(email, { metadata: meta });

  if (passed) {
    await createNotification({
      recipient_email: email,
      title: '🎉 Account activated',
      body: `You scored ${score}%. You can now go online and accept delivery requests.`,
      type: 'driver_activated',
      link: '/jobs',
    }).catch(() => {});
  }

  return {
    passed,
    score,
    pass_score: QUIZ_PASS_SCORE,
    correct,
    total: ROAD_SAFETY_QUIZ.length,
    profile: profileToApi(updated),
  };
}

export async function assertDriverCanAcceptJobs(email) {
  const status = await getDriverOnboardingStatus(email);
  if (status.needs_registration) throw new Error('Complete driver registration first');
  if (status.verification_status !== DRIVER_VERIFICATION.APPROVED) {
    throw new Error('Your documents are still under review. Verification usually takes 24–72 hours.');
  }
  if (!status.quiz_passed) {
    throw new Error('Complete the road safety quiz to activate your account.');
  }
  return status;
}
