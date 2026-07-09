import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bike, Loader2, Upload, CheckCircle2, AlertCircle, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registerDriver, uploadDriverDocument } from '@/api';
import { COURIER_VEHICLES } from '@/domain/courierVehicles';

const DOC_FIELDS = [
  { key: 'id_document', label: 'Valid ID', hint: 'National ID or passport' },
  { key: 'drivers_license', label: "Driver's licence", hint: 'Valid licence photo' },
  { key: 'vehicle_photo', label: 'Vehicle photo', hint: 'Clear photo of your vehicle' },
  { key: 'profile_photo', label: 'Profile photo', hint: 'Clear face photo' },
];

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function DocUpload({ field, value, onUploaded }) {
  const [busy, setBusy] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await uploadDriverDocument(dataUrl, field.key, file.name);
      onUploaded(res.url);
      toast.success(`${field.label} uploaded`);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  return (
    <label className="block border border-dashed border-border rounded-2xl p-3 hover:bg-muted/40 cursor-pointer transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${value ? 'bg-green-50' : 'bg-muted'}`}>
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : busy ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : (
            <Camera className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{field.label}</p>
          <p className="text-[11px] text-muted-foreground">{field.hint}</p>
          {value && (
            <p className="text-[11px] text-green-700 font-medium mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Uploaded
            </p>
          )}
        </div>
        <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
      <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={busy} />
    </label>
  );
}

export default function DriverSignUp() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
    date_of_birth: '',
    vehicle_type: 'motorbike',
    license_number: '',
  });
  const [docs, setDocs] = useState({
    id_document: '',
    drivers_license: '',
    vehicle_photo: '',
    profile_photo: '',
  });
  const [done, setDone] = useState(false);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const ageOk = (() => {
    if (!form.date_of_birth) return null;
    const d = new Date(form.date_of_birth);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
    return age >= 21;
  })();

  const validateStep1 = () => {
    if (!form.full_name.trim()) return 'Enter your full name';
    if (!form.email.trim()) return 'Enter your email';
    if (!form.phone.trim()) return 'Enter your phone number';
    if (!form.date_of_birth) return 'Enter your date of birth';
    if (ageOk === false) return 'You must be at least 21 years old to register as a driver';
    if (form.password.length < 6) return 'Password must be at least 6 characters';
    if (form.password !== form.confirm) return 'Passwords do not match';
    return null;
  };

  const validateStep2 = () => {
    if (!form.vehicle_type) return 'Select your vehicle type';
    for (const f of DOC_FIELDS) {
      if (!docs[f.key]) return `Upload your ${f.label.toLowerCase()}`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validateStep2();
    if (err) {
      toast.error(err);
      return;
    }
    setLoading(true);
    try {
      await registerDriver({
        ...form,
        documents: docs,
      });
      setDone(true);
    } catch (e) {
      toast.error(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-700" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Application submitted</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Once your documents are verified (which usually takes <strong>24 to 72 hours</strong>),
            complete the road safety quiz to activate your account and begin accepting delivery requests.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left text-xs text-amber-900 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> What happens next
            </p>
            <p>1. Admin reviews your ID, licence, vehicle and profile photos</p>
            <p>2. You get a notification when approved</p>
            <p>3. Log in and pass the road safety quiz</p>
            <p>4. Go online and accept jobs</p>
          </div>
          <Button className="w-full rounded-xl" onClick={() => navigate('/login')}>
            Go to login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-3">
            <Bike className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Become a DashZW driver</h1>
          <p className="text-sm text-muted-foreground mt-1">Step {step} of 2 · Must be 21+</p>
        </div>

        {step === 1 && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const err = validateStep1();
              if (err) {
                toast.error(err);
                return;
              }
              setStep(2);
            }}
          >
            <div>
              <Label>Full name</Label>
              <Input className="rounded-xl mt-1" value={form.full_name} onChange={(e) => setField('full_name', e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" className="rounded-xl mt-1" value={form.email} onChange={(e) => setField('email', e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input className="rounded-xl mt-1" value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+27 ..." />
            </div>
            <div>
              <Label>Date of birth</Label>
              <Input type="date" className="rounded-xl mt-1" value={form.date_of_birth} onChange={(e) => setField('date_of_birth', e.target.value)} />
              {ageOk === false && (
                <p className="text-xs text-destructive mt-1">You must be at least 21 years old</p>
              )}
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" className="rounded-xl mt-1" value={form.password} onChange={(e) => setField('password', e.target.value)} />
            </div>
            <div>
              <Label>Confirm password</Label>
              <Input type="password" className="rounded-xl mt-1" value={form.confirm} onChange={(e) => setField('confirm', e.target.value)} />
            </div>
            <Button type="submit" className="w-full rounded-xl h-11 mt-2">
              Continue to documents
            </Button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Vehicle type</Label>
              <div className="grid grid-cols-3 gap-2">
                {COURIER_VEHICLES.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setField('vehicle_type', v.id)}
                    className={`rounded-xl border p-3 text-center text-xs font-semibold ${
                      form.vehicle_type === v.id
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-foreground'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                You will only see courier jobs that match your vehicle (cars can also take bike jobs).
              </p>
            </div>
            <div>
              <Label>Licence number (optional)</Label>
              <Input className="rounded-xl mt-1" value={form.license_number} onChange={(e) => setField('license_number', e.target.value)} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Upload documents</p>
              {DOC_FIELDS.map((field) => (
                <DocUpload
                  key={field.key}
                  field={field}
                  value={docs[field.key]}
                  onUploaded={(url) => setDocs((d) => ({ ...d, [field.key]: url }))}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="button" className="flex-1 rounded-xl" disabled={loading} onClick={handleSubmit}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit application'}
              </Button>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already registered?{' '}
          <Link to="/login" className="text-primary font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
