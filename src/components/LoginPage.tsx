import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  User,
  Heart,
  Calendar,
  Palette,
  MapPin,
  Laptop,
  Globe,
  Wifi,
  RefreshCw,
  Cpu,
  Shield,
} from 'lucide-react';
import {
  api,
  setAuthToken,
  getClientDeviceId,
  getClientDeviceTelemetry,
} from '../lib/api';
import {
  UserSession,
  ServerConfig,
  IpNetworkIntelligence,
  RecognizedDevice,
  SecurityPolicyConfig,
} from '../types';

interface LoginPageProps {
  serverConfig: ServerConfig | null;
  onLoginSuccess: (session: UserSession) => void;
  onOpenSetupGuide: () => void;
}

// 14 rich color options for the security question
const COLOR_OPTIONS = [
  { name: 'Crimson Red', hex: '#ef4444', border: 'border-red-500/40' },
  { name: 'Electric Blue', hex: '#3b82f6', border: 'border-blue-500/40' },
  { name: 'Emerald Green', hex: '#10b981', border: 'border-emerald-500/40' },
  { name: 'Amber Gold', hex: '#f59e0b', border: 'border-amber-500/40' },
  { name: 'Royal Purple', hex: '#a855f7', border: 'border-purple-500/40' },
  { name: 'Cyan Ocean', hex: '#06b6d4', border: 'border-cyan-500/40' },
  { name: 'Hot Pink', hex: '#ec4899', border: 'border-pink-500/40' },
  { name: 'Indigo Night', hex: '#6366f1', border: 'border-indigo-500/40' },
  { name: 'Teal Mint', hex: '#14b8a6', border: 'border-teal-500/40' },
  { name: 'Sunset Orange', hex: '#f97316', border: 'border-orange-500/40' },
  { name: 'Lime Volt', hex: '#84cc16', border: 'border-lime-500/40' },
  { name: 'Violet Dusk', hex: '#8b5cf6', border: 'border-violet-500/40' },
  { name: 'Rose Coral', hex: '#f43f5e', border: 'border-rose-500/40' },
  { name: 'Slate Monochrome', hex: '#94a3b8', border: 'border-slate-500/40' },
];

export const LoginPage: React.FC<LoginPageProps> = ({
  serverConfig,
  onLoginSuccess,
  onOpenSetupGuide,
}) => {
  // Username input
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [authMode, setAuthMode] = useState<'code' | 'backup'>('code');

  // Multi-step backup verification states
  const [step, setStep] = useState<'credentials' | 'security_questions'>('credentials');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [motherName, setMotherName] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [crushName, setCrushName] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Real Device & Network Intelligence Pre-Connect States
  const [preConnectData, setPreConnectData] = useState<{
    networkInfo: IpNetworkIntelligence;
    device: RecognizedDevice;
    recognitionState: 'recognized_trusted' | 'recognized_untrusted' | 'new_device';
    isNewDevice: boolean;
    policy: SecurityPolicyConfig;
    accessAllowed: boolean;
    policyViolations: string[];
    denialReason?: string;
  } | null>(null);
  const [isPreConnecting, setIsPreConnecting] = useState(true);

  // Browser Geolocation State
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracyMeters: number;
  } | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'acquiring' | 'granted' | 'denied' | 'unsupported'
  >('idle');
  const [locationError, setLocationError] = useState<string | null>(null);

  // Acquire high accuracy geolocation
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported');
      setLocationError('Browser geolocation is not supported on this device.');
      return;
    }

    setLocationStatus('acquiring');
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracyMeters: Math.round(pos.coords.accuracy),
        };
        setUserLocation(coords);
        setLocationStatus('granted');
      },
      (err) => {
        setLocationStatus('denied');
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location permission denied. Mandatory security gate requires location.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocationError('Location position unavailable.');
        } else {
          setLocationError('Location request timed out.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, []);

  // Run security pre-connect on mount and whenever location updates
  const runPreConnect = useCallback(async (coords = userLocation) => {
    try {
      setIsPreConnecting(true);
      const clientDeviceId = getClientDeviceId();
      const telemetry = getClientDeviceTelemetry();
      const res = await api.preConnectSecurity({
        clientDeviceId,
        telemetry,
        userLocation: coords || undefined,
      });
      setPreConnectData(res);
    } catch (err) {
      console.error('Security pre-connect error:', err);
    } finally {
      setIsPreConnecting(false);
    }
  }, [userLocation]);

  useEffect(() => {
    // Automatically trigger location acquisition on mount for mandatory vault verification
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    runPreConnect(userLocation);
  }, [userLocation, runPreConnect]);

  const targetUsername = serverConfig?.targetUsername || 'raiyan';

  // Handle Initial Credentials Submission
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setErrorMessage('Please enter your username.');
      return;
    }

    if (cleanUsername.toLowerCase() !== targetUsername.toLowerCase()) {
      setErrorMessage(`Username "${cleanUsername}" not authorized for this vault.`);
      return;
    }

    const cleanCode = code.trim();
    if (!cleanCode) {
      setErrorMessage(
        authMode === 'backup'
          ? 'Please enter one of your authorized backup codes.'
          : 'Please enter your primary security code.'
      );
      return;
    }

    // Fail-Closed check for required location
    if (preConnectData?.policy?.requireExactLocation && !userLocation) {
      setErrorMessage('Fail-Closed Gateway: High-accuracy browser geolocation is strictly required. Please click "Authorize Location" below.');
      return;
    }

    if (authMode === 'code') {
      // Primary Code Mode -> direct login
      setIsLoading(true);
      try {
        const clientDeviceId = getClientDeviceId();
        const telemetry = getClientDeviceTelemetry();

        const res = await api.codeLogin({
          username: cleanUsername,
          code: cleanCode,
          authMethod: 'code',
          clientDeviceId,
          telemetry,
          userLocation: userLocation || undefined,
        });

        setAuthToken(res.token);
        onLoginSuccess({
          id: res.user.id,
          username: res.user.username,
          email: res.user.email,
          token: res.token,
        });
      } catch (err: any) {
        if (err?.data?.policyViolations) {
          setErrorMessage(`Access Denied: ${err.data.error || 'Security Policy Violation'} (${err.data.policyViolations.join(', ')})`);
        } else {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : 'Access denied: Security code incorrect. Verify code or select Backup Code option.'
          );
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      // Backup Code Mode -> Validate code first, then advance to Personal Questions
      const validBackups = ['raiyan3945', 'Raiyan77889', '77889'];
      if (!validBackups.includes(cleanCode)) {
        setErrorMessage('Invalid backup code. Please enter an authorized backup code.');
        return;
      }

      // Backup code is valid! Progress to security verification questions
      setStep('security_questions');
      setErrorMessage(null);
    }
  };

  // Handle Personal Security Questions Submission
  const handleSecurityQuestionsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedColor) {
      setErrorMessage('Please select your favorite color from the options below.');
      return;
    }

    const cleanMother = motherName.trim().toLowerCase().replace(/\s+/g, ' ');
    if (cleanMother !== 'josna akter') {
      setErrorMessage("Incorrect answer for Mother's Name.");
      return;
    }

    const cleanAge = age.trim();
    if (!cleanAge) {
      setErrorMessage('Please enter your age.');
      return;
    }

    const cleanCrush = crushName.trim().toLowerCase();
    if (cleanCrush !== 'no') {
      setErrorMessage('Incorrect answer for crush name question.');
      return;
    }

    // Submit full payload to server for verified token issuance
    setIsLoading(true);
    try {
      const clientDeviceId = getClientDeviceId();
      const telemetry = getClientDeviceTelemetry();

      const res = await api.codeLogin({
        username: username.trim(),
        code: code.trim(),
        authMethod: 'backup',
        securityAnswers: {
          favColor: selectedColor,
          motherName: motherName.trim(),
          age: cleanAge,
          crushName: crushName.trim(),
        },
        clientDeviceId,
        telemetry,
        userLocation: userLocation || undefined,
      });

      setAuthToken(res.token);
      onLoginSuccess({
        id: res.user.id,
        username: res.user.username,
        email: res.user.email,
        token: res.token,
      });
    } catch (err: any) {
      if (err?.data?.policyViolations) {
        setErrorMessage(`Access Denied: ${err.data.error} (${err.data.policyViolations.join(', ')})`);
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : 'Personal security verification failed.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillTargetUser = () => {
    setUsername(targetUsername);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center px-4 py-8 select-none font-sans">
      {/* Search Engine Safety Indicator */}
      <div className="w-full max-w-lg mb-3 flex items-center justify-between text-xs text-neutral-500 font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          RESTRICTED GATEWAY // PORT 3000
        </span>
        <span className="flex items-center gap-1 text-neutral-400">
          <Shield className="w-3.5 h-3.5 text-neutral-400" />
          FAIL-CLOSED PROTOCOL
        </span>
      </div>

      {/* Main Login / Challenge Card */}
      <div
        id="login-card"
        className="w-full max-w-lg bg-neutral-900/90 border border-neutral-800 rounded-xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm transition-all"
      >
        {/* Header / Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-neutral-800/80 border border-neutral-700/60 mb-3 text-neutral-300">
            {step === 'credentials' ? (
              <Lock className="w-5 h-5 text-neutral-200" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <h1 className="text-lg font-medium tracking-tight text-neutral-100">
            {step === 'credentials' ? 'Private Vault Access' : 'Security Verification Challenge'}
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            {step === 'credentials'
              ? 'Authorized Administrator Authentication'
              : 'Backup Code Accepted — Answer Personal Security Questions'}
          </p>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div
            id="login-error-alert"
            className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-xs text-rose-200 flex items-start gap-2 animate-in fade-in duration-150"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: USERNAME & SECURITY CODE / BACKUP CODE */}
        {step === 'credentials' && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            {/* Username Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="username-input"
                  className="block text-xs font-medium text-neutral-400 uppercase tracking-wider font-mono flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5 text-neutral-500" />
                  Username
                </label>
                <button
                  type="button"
                  onClick={handleFillTargetUser}
                  className="text-[11px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                  title="Fill configured administrator username"
                >
                  Set to @{targetUsername}
                </button>
              </div>
              <input
                id="username-input"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter authorized username..."
                className="w-full px-3.5 py-2.5 bg-neutral-950/80 border border-neutral-800 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-500 font-mono transition-colors"
              />
            </div>

            {/* Auth Method Selector Toggle (Security Code vs Backup Code) */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="code-input"
                  className="block text-xs font-medium text-neutral-400 uppercase tracking-wider font-mono flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5 text-neutral-500" />
                  {authMode === 'code' ? 'Security Code' : 'Backup Code'}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCode(!showCode)}
                    className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {showCode ? (
                      <>
                        <EyeOff className="w-3 h-3" /> Hide
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" /> Reveal
                      </>
                    )}
                  </button>
                  <span className="text-neutral-700">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode(authMode === 'code' ? 'backup' : 'code');
                      setCode('');
                      setErrorMessage(null);
                    }}
                    className="text-xs text-neutral-400 hover:text-neutral-200 underline cursor-pointer transition-colors"
                  >
                    {authMode === 'code' ? 'Use Backup Code' : 'Use Security Code'}
                  </button>
                </div>
              </div>

              <input
                id="code-input"
                type={showCode ? 'text' : 'password'}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={
                  authMode === 'backup'
                    ? 'Enter your emergency backup code...'
                    : 'Enter your private security code...'
                }
                className="w-full px-3.5 py-2.5 bg-neutral-950/80 border border-neutral-800 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-500 font-mono tracking-wider transition-colors"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                id="login-submit-button"
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-neutral-100 hover:bg-white text-neutral-950 font-medium rounded-lg text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin"></span>
                    <span>Validating Device &amp; Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {authMode === 'backup'
                        ? 'Verify Backup Code &amp; Continue'
                        : 'Authorize &amp; Unlock Vault'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: MULTI-FACTOR PERSONAL RECOVERY QUESTIONS */}
        {step === 'security_questions' && (
          <form onSubmit={handleSecurityQuestionsSubmit} className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/50 text-xs text-amber-200/90 leading-relaxed">
              <span className="font-semibold text-amber-200">Personal Identity Verification:</span> Complete
              all 4 personal security questions to authenticate your identity and gain access to the vault.
            </div>

            {/* Question 1: Favorite Color */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 uppercase tracking-wider font-mono mb-2 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-neutral-400" />
                1. Select Your Favorite Color *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COLOR_OPTIONS.map((c) => {
                  const isSelected = selectedColor.toLowerCase() === c.name.toLowerCase();
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setSelectedColor(c.name)}
                      className={`px-2.5 py-2 rounded-lg border text-xs font-mono flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-neutral-800 border-neutral-400 text-neutral-100 shadow-sm ring-1 ring-neutral-400'
                          : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-inner"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="truncate">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Question 2: Mother's Name (Ans: "josna akter") */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 uppercase tracking-wider font-mono mb-1.5 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-neutral-400" />
                2. Mother&apos;s Name *
              </label>
              <input
                type="text"
                required
                value={motherName}
                onChange={(e) => setMotherName(e.target.value)}
                placeholder="Enter mother's name..."
                className="w-full px-3.5 py-2 bg-neutral-950/80 border border-neutral-800 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-400 font-sans transition-colors"
              />
            </div>

            {/* Question 3: Age */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 uppercase tracking-wider font-mono mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                3. Your Age *
              </label>
              <input
                type="number"
                min="1"
                max="120"
                required
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Enter your age..."
                className="w-full px-3.5 py-2 bg-neutral-950/80 border border-neutral-800 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-400 font-mono transition-colors"
              />
            </div>

            {/* Question 4: Ami Crush Name (Ans: "no") */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 uppercase tracking-wider font-mono mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
                4. Ami Crush Name *
              </label>
              <input
                type="text"
                required
                value={crushName}
                onChange={(e) => setCrushName(e.target.value)}
                placeholder="Enter answer..."
                className="w-full px-3.5 py-2 bg-neutral-950/80 border border-neutral-800 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-400 font-sans transition-colors"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setErrorMessage(null);
                }}
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                &larr; Back
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2 px-4 bg-neutral-100 hover:bg-white text-neutral-950 font-medium rounded-lg text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin"></span>
                    <span>Verifying Answers...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Confirm &amp; Unlock Vault</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Security Footer Notice */}
        <div className="mt-6 pt-5 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
            Zero Public Data
          </span>
          <button
            type="button"
            onClick={onOpenSetupGuide}
            className="hover:text-neutral-300 transition-colors cursor-pointer"
          >
            Database Schema &amp; RLS
          </button>
        </div>
      </div>
    </div>
  );
};
