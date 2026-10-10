import { useState, useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  User,
  Shield,
  Sliders,
  AlertTriangle,
  Lock,
  Smartphone,
  Laptop,
  LogOut,
  Trash2,
  Key,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Palette,
  Bell,
  Mail,
  ArrowRight,
  Phone,
  Globe,
  X,
} from "lucide-react"

import { FluxLogo } from "./Landing"
import type { UserAccount, SecuritySession } from "../types"
import {
  currentAccount,
  signOutAccount,
  updateUserProfile,
  changeUserPassword,
  fetchUserSessions,
  revokeUserSession,
  revokeOtherUserSessions,
  deleteUserAccount,
  signInWithGoogleService,
  type GoogleAccountLink,
} from "../utils/accounts"
import {
  analyzeNistPassword,
  generatePassphrase,
  maskEmail,
} from "../utils/security"
import { normalizePhoneNumber } from "../utils/phone"
import NistPasswordValidator from "../components/NistPasswordValidator"
import InProfileResetModal from "../components/InProfileResetModal"
import GoogleAccountLinkModal from "../components/GoogleAccountLinkModal"
import { useToast } from "../components/Toast"

type TabType = "general" | "security" | "preferences" | "danger"

const AVATAR_PALETTES = [
  { id: "forest", name: "Forest", bg: "#0D530E", fg: "#FBF5DD" },
  { id: "green", name: "Moss", bg: "#306D29", fg: "#FBF5DD" },
  { id: "sand", name: "Sand", bg: "#E7E1B1", fg: "#0D530E" },
  { id: "teal", name: "Deep Sage", bg: "#2E5E4E", fg: "#FBF5DD" },
  { id: "earth", name: "Ochre", bg: "#8A5A2B", fg: "#FBF5DD" },
  { id: "slate", name: "Charcoal", bg: "#36454F", fg: "#FBF5DD" },
]

export default function Profile() {
  const navigate = useNavigate()
  const location = useLocation()
  const reviewSecurity =
    new URLSearchParams(location.search).get("tab") === "security"
  const { showToast } = useToast()

  // User state
  const [user, setUser] = useState<UserAccount | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>(
    reviewSecurity ? "security" : "general",
  )

  // Easy Read Mode
  const [easyReadMode, setEasyReadMode] = useState(() => {
    try {
      return localStorage.getItem("flux_easy_read_mode") === "true"
    } catch {
      return false
    }
  })

  // General tab form state
  const [name, setName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [bio, setBio] = useState("")
  const [selectedAvatar, setSelectedAvatar] = useState("forest")
  const [savingGeneral, setSavingGeneral] = useState(false)
  const [generalError, setGeneralError] = useState<string | null>(null)

  // Security tab state - Change Password
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPass, setShowCurrentPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [revokeOthersOnChange, setRevokeOthersOnChange] = useState(true)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [copiedPassphrase, setCopiedPassphrase] = useState(false)

  // Security tab state - Active Sessions
  const [sessions, setSessions] = useState<SecuritySession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(
    null,
  )
  const [revokingAllOthers, setRevokingAllOthers] = useState(false)

  // In-profile Forgot Password modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)

  // Google Account link modal
  const [googleAccountLink, setGoogleAccountLink] =
    useState<GoogleAccountLink | null>(null)
  const [connectingGoogle, setConnectingGoogle] = useState(false)

  // Preferences tab state
  const [securityAlerts] = useState(true)
  const [productAnnouncements, setProductAnnouncements] = useState(() => {
    try {
      return localStorage.getItem("flux_pref_announcements") !== "false"
    } catch {
      return true
    }
  })
  const [weeklyDigest, setWeeklyDigest] = useState(() => {
    try {
      return localStorage.getItem("flux_pref_digest") === "true"
    } catch {
      return false
    }
  })
  const [publicProfile, setPublicProfile] = useState(() => {
    try {
      return localStorage.getItem("flux_pref_public_profile") !== "false"
    } catch {
      return true
    }
  })

  // Danger zone state - Delete Account modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("")
  const [deletePassword, setDeletePassword] = useState("")
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Initial load
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const account = await currentAccount()
        if (!active) return
        if (!account) {
          navigate("/login", { replace: true, state: { reviewSecurity } })
          return
        }
        setUser(account)
        setName(account.name || "")
        setPhoneNumber(account.phoneNumber || "")
        setBio(account.bio || "")
        setSelectedAvatar(account.avatarUrl || "forest")
        setPageLoading(false)
      } catch {
        if (active) {
          navigate("/login", { replace: true, state: { reviewSecurity } })
        }
      }
    })()
    return () => {
      active = false
    }
  }, [navigate, reviewSecurity])

  // Load sessions when Security tab is selected
  useEffect(() => {
    if (activeTab === "security" && user) {
      loadSessions()
    }
  }, [activeTab, user])

  const loadSessions = async () => {
    setSessionsLoading(true)
    try {
      const list = await fetchUserSessions()
      setSessions(list)
    } catch {
      // Non-blocking
    } finally {
      setSessionsLoading(false)
    }
  }

  const toggleEasyRead = () => {
    const next = !easyReadMode
    setEasyReadMode(next)
    try {
      localStorage.setItem("flux_easy_read_mode", String(next))
    } catch {
      /* Optional */
    }
    showToast({
      title: next ? "Easy Read Mode enabled" : "Easy Read Mode disabled",
      message: next
        ? "Enlarged typography and enhanced contrast applied."
        : "Standard theme restored.",
      type: "notice-green",
      duration: 3000,
    })
  }

  // Handle saving general profile
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError(null)

    if (name.trim().length < 2 || name.trim().length > 100) {
      setGeneralError("Please enter a name between 2 and 100 characters.")
      return
    }

    let normalizedPhone: string | undefined = undefined
    if (phoneNumber.trim()) {
      try {
        const parsed = normalizePhoneNumber(phoneNumber)
        normalizedPhone = parsed || undefined
      } catch {
        setGeneralError("Please enter a valid international phone number.")
        return
      }
    }

    setSavingGeneral(true)
    try {
      const updated = await updateUserProfile({
        name: name.trim(),
        phoneNumber: normalizedPhone,
        bio: bio.trim(),
        avatarUrl: selectedAvatar,
      })
      setUser(updated)
      showToast({
        title: "Profile updated",
        message: "Your profile details have been successfully saved.",
        type: "notice-green",
      })
    } catch (error) {
      setGeneralError(
        error instanceof Error ? error.message : "Failed to update profile.",
      )
    } finally {
      setSavingGeneral(false)
    }
  }

  // Handle password change
  const nistAnalysis = analyzeNistPassword(newPassword, user?.email || "")
  const isPassMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword
  const canSubmitPassChange =
    (!user?.hasPassword || currentPassword.length > 0) &&
    nistAnalysis.allCriticalMet &&
    isPassMatch &&
    !savingPassword

  const handleSuggestPassphrase = () => {
    const suggested = generatePassphrase()
    setNewPassword(suggested)
    setConfirmPassword(suggested)
    setShowNewPass(true)
    setShowConfirmPass(true)
    setCopiedPassphrase(false)
  }

  const handleCopyPassphrase = async () => {
    try {
      await navigator.clipboard.writeText(newPassword)
      setCopiedPassphrase(true)
      setTimeout(() => setCopiedPassphrase(false), 2500)
    } catch {
      /* fallback */
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmitPassChange) return
    setPasswordError(null)
    setSavingPassword(true)

    try {
      const result = await changeUserPassword({
        currentPassword: user?.hasPassword ? currentPassword : undefined,
        newPassword,
        revokeOtherSessions: revokeOthersOnChange,
      })

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      showToast({
        title: "Password changed",
        message: result.sessionsRevoked
          ? "Your password has been changed. Other sessions were signed out."
          : "Your password has been changed.",
        type: "security",
      })
      // Refresh user to update lastPasswordReset
      const freshUser = await currentAccount()
      if (freshUser) setUser(freshUser)
      if (activeTab === "security") loadSessions()
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "Failed to change password. Please verify current password.",
      )
    } finally {
      setSavingPassword(false)
    }
  }

  // Revoke single session
  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId)
    try {
      await revokeUserSession(sessionId)
      showToast({
        title: "Session revoked",
        message: "The device has been signed out.",
        type: "notice-green",
      })
      await loadSessions()
    } catch (error) {
      showToast({
        title: "Revoke failed",
        message:
          error instanceof Error ? error.message : "Could not revoke session.",
        type: "notice-red",
      })
    } finally {
      setRevokingSessionId(null)
    }
  }

  // Revoke all other sessions
  const handleRevokeOtherSessions = async () => {
    setRevokingAllOthers(true)
    try {
      await revokeOtherUserSessions()
      showToast({
        title: "Other sessions signed out",
        message: "All other devices have been disconnected from Flux.",
        type: "security",
      })
      await loadSessions()
    } catch (error) {
      showToast({
        title: "Action failed",
        message:
          error instanceof Error
            ? error.message
            : "Could not sign out other sessions.",
        type: "notice-red",
      })
    } finally {
      setRevokingAllOthers(false)
    }
  }

  // Connect Google account
  const handleConnectGoogle = async () => {
    setConnectingGoogle(true)
    try {
      const res = await signInWithGoogleService()
      if (res.success && res.user) {
        setUser(res.user)
        showToast({
          title: "Google connected",
          message: "Your Google account has been linked.",
          type: "notice-green",
        })
      } else if (res.accountLink) {
        setGoogleAccountLink(res.accountLink)
      } else {
        showToast({
          title: "Connection failed",
          message: res.error || "Could not link Google account.",
          type: "notice-red",
        })
      }
    } finally {
      setConnectingGoogle(false)
    }
  }

  // Sign out
  const handleSignOut = async () => {
    try {
      await signOutAccount()
      showToast({
        title: "Signed out",
        message: "You have been safely signed out.",
        type: "notice-green",
      })
      navigate("/login", { replace: true })
    } catch {
      navigate("/login", { replace: true })
    }
  }

  // Delete account
  const handleDeleteAccount = async () => {
    if (user?.hasPassword && !deletePassword) {
      setDeleteError("Please enter your current password to confirm.")
      return
    }
    if (deleteConfirmationText.trim().toUpperCase() !== "DELETE") {
      setDeleteError("Type DELETE in capital letters to confirm.")
      return
    }

    setDeletingAccount(true)
    setDeleteError(null)
    try {
      await deleteUserAccount({
        password: user?.hasPassword ? deletePassword : undefined,
      })
      showToast({
        title: "Account deleted",
        message: "Your Flux account and associated data were removed.",
        type: "notice-green",
      })
      navigate("/", { replace: true })
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete account.",
      )
    } finally {
      setDeletingAccount(false)
    }
  }

  // User initials & avatar styling
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "FL"

  const activePalette =
    AVATAR_PALETTES.find((p) => p.id === selectedAvatar) || AVATAR_PALETTES[0]

  if (pageLoading) {
    return (
      <div className="bg-cream min-h-screen flex flex-col items-center justify-center p-6 text-forest">
        <RefreshCw className="w-8 h-8 animate-spin text-green mb-3" />
        <p className="text-sm font-medium">Loading account settings…</p>
      </div>
    )
  }

  return (
    <div
      className={`bg-cream min-h-screen flex flex-col text-forest ${
        easyReadMode ? "text-base" : "text-sm"
      }`}
    >
      {/* ── Top Header Navigation ── */}
      <header className="border-b border-sand bg-cream/90 backdrop-blur-xs sticky top-0 z-30">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 md:px-10 h-14">
          <div className="flex items-center gap-6">
            <FluxLogo />
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-dim">
              <Link to="/" className="hover:text-forest transition-colors">
                Home
              </Link>
              <ChevronRight className="w-3 h-3 text-sand" />
              <span className="font-semibold text-forest">
                Account Settings
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleEasyRead}
              className={`text-xs px-2.5 py-1.5 rounded border transition-colors flex items-center gap-1.5 ${
                easyReadMode
                  ? "bg-green text-cream border-green"
                  : "bg-transparent text-dim border-sand hover:text-forest"
              }`}
              title="Toggle enlarged typography and enhanced readability"
            >
              <span>{easyReadMode ? "Easy Read: On" : "Easy Read"}</span>
            </button>

            {/* Quick avatar badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-sand">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xs"
                style={{
                  background: activePalette.bg,
                  color: activePalette.fg,
                }}
              >
                {initials}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="btn btn-ghost text-xs p-1.5 hover:text-red-700"
                title="Sign out of Flux"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* ── Main Profile Container ── */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 md:px-8 py-8 flex-1">
        {/* Profile Hero Overview Card */}
        <section className="panel p-6 sm:p-8 mb-8 border border-sand bg-white shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center font-heading font-bold text-2xl sm:text-3xl shadow-sm border border-sand/60 transition-transform"
                style={{
                  background: activePalette.bg,
                  color: activePalette.fg,
                }}
              >
                {initials}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="font-heading text-2xl sm:text-3xl font-bold text-forest">
                    {user?.name}
                  </h1>
                  <span className="sec-pill text-[11px] py-0.5">Verified</span>
                </div>
                <p className="text-xs sm:text-sm text-dim flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{user?.email}</span>
                  {user?.provider === "google" && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-medium ml-1">
                      Google
                    </span>
                  )}
                </p>
                {user?.bio && (
                  <p className="text-xs text-forest/80 italic pt-0.5 max-w-md">
                    "{user.bio}"
                  </p>
                )}
              </div>
            </div>

            {/* Account Metadata Pills */}
            <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-2 text-xs text-dim">
              <span className="bg-sand/30 border border-sand/60 px-3 py-1.5 rounded-md">
                Member since{" "}
                <strong className="text-forest">
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })
                    : "2026"}
                </strong>
              </span>
              <span className="bg-sand/30 border border-sand/60 px-3 py-1.5 rounded-md">
                Active sessions:{" "}
                <strong className="text-forest">
                  {user?.sessionsCount || 1}
                </strong>
              </span>
            </div>
          </div>
        </section>

        {/* ── Navigation Tabs ── */}
        <div className="flex border-b border-sand mb-6 gap-2 sm:gap-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`pb-3 px-3 font-medium text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "general"
                ? "border-forest text-forest font-semibold"
                : "border-transparent text-dim hover:text-forest"
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile Information</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`pb-3 px-3 font-medium text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "security"
                ? "border-forest text-forest font-semibold"
                : "border-transparent text-dim hover:text-forest"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Security & Password</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("preferences")}
            className={`pb-3 px-3 font-medium text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "preferences"
                ? "border-forest text-forest font-semibold"
                : "border-transparent text-dim hover:text-forest"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Preferences</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("danger")}
            className={`pb-3 px-3 font-medium text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "danger"
                ? "border-red-600 text-red-700 font-semibold"
                : "border-transparent text-dim hover:text-red-600"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Danger Zone</span>
          </button>
        </div>

        {/* ───────────────────────────────────────────────────────── */}
        {/* TAB 1: GENERAL PROFILE                                    */}
        {/* ───────────────────────────────────────────────────────── */}
        {activeTab === "general" && (
          <div className="space-y-6 animate-fade-up">
            <div className="panel p-6 border border-sand bg-white shadow-xs">
              <h2 className="font-heading text-lg font-bold text-forest mb-1">
                Personal Information
              </h2>
              <p className="text-xs text-dim mb-6">
                Update your identity details, personal bio, and profile color.
              </p>

              {generalError && (
                <div
                  role="alert"
                  className="p-3 mb-5 rounded-lg text-xs flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="font-medium">{generalError}</p>
                </div>
              )}

              <form onSubmit={handleSaveGeneral} className="space-y-5">
                {/* Avatar Color Selector */}
                <div>
                  <label className="block text-xs font-semibold text-forest mb-2">
                    Avatar Style & Accent
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    {AVATAR_PALETTES.map((pal) => (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => setSelectedAvatar(pal.id)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-transform cursor-pointer border ${
                          selectedAvatar === pal.id
                            ? "ring-2 ring-forest scale-110 shadow-sm border-forest"
                            : "border-sand/70 opacity-80 hover:opacity-100"
                        }`}
                        style={{ background: pal.bg, color: pal.fg }}
                        title={pal.name}
                      >
                        {selectedAvatar === pal.id && (
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-forest mb-1.5">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      className="input"
                      required
                    />
                  </div>

                  {/* Registered Email (Read only) */}
                  <div>
                    <label className="block text-xs font-semibold text-forest mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={user?.email || ""}
                        disabled
                        className="input bg-sand/20 cursor-not-allowed pr-20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold bg-green/10 text-green px-2 py-0.5 rounded">
                        Verified
                      </span>
                    </div>
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-semibold text-forest mb-1.5">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (202) 555-0123"
                    className="input"
                  />
                  <p className="text-[11px] text-dim mt-1">
                    Used for recovery notices and multi-factor security alerts.
                  </p>
                </div>

                {/* Bio / Headline */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-forest">
                      Bio / Status
                    </label>
                    <span className="text-[11px] text-dim">
                      {bio.length} / 300
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={300}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell the Flux community about what you create or research…"
                    className="input resize-none py-2.5"
                  />
                </div>

                {/* Account Details Box */}
                <div className="bg-cream/60 border border-sand p-4 rounded-lg text-xs space-y-2">
                  <p className="font-semibold text-forest">
                    Account Identification
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-dim">
                    <span>Flux Account ID:</span>
                    <span className="font-mono text-forest bg-white px-2 py-0.5 rounded border border-sand/50 select-all">
                      {user?.id}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-dim">
                    <span>Primary Authentication:</span>
                    <span className="capitalize font-medium text-forest">
                      {user?.provider || "password"}
                    </span>
                  </div>
                </div>

                {/* Save button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingGeneral}
                    className="btn btn-forest py-2.5 px-6 text-xs flex items-center gap-2"
                  >
                    {savingGeneral ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Changes…</span>
                      </>
                    ) : (
                      <>
                        <span>Save Profile Changes</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────── */}
        {/* TAB 2: SECURITY & PASSWORD (FEATURING FORGOT PASSWORD)   */}
        {/* ───────────────────────────────────────────────────────── */}
        {activeTab === "security" && (
          <div className="space-y-6 animate-fade-up">
            {/* 1. Change Password Card */}
            <div className="panel p-6 border border-sand bg-white shadow-xs">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-heading text-lg font-bold text-forest flex items-center gap-2">
                    <Key className="w-4 h-4 text-green" />
                    <span>Password Management</span>
                  </h2>
                  <p className="text-xs text-dim mt-0.5">
                    {user?.hasPassword
                      ? "Update your existing account password with NIST-grade security."
                      : "Set a password to enable direct email and password sign-in."}
                  </p>
                </div>
                {user?.lastPasswordReset && (
                  <span className="text-[11px] text-dim bg-cream px-2.5 py-1 rounded border border-sand">
                    Last updated:{" "}
                    {new Date(user.lastPasswordReset).toLocaleDateString()}
                  </span>
                )}
              </div>

              {passwordError && (
                <div
                  role="alert"
                  className="p-3 mb-5 rounded-lg text-xs flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="font-medium">{passwordError}</p>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                {/* Current password (only if user already has one) */}
                {user?.hasPassword && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-forest">
                        Current Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsResetModalOpen(true)}
                        className="text-xs text-green hover:underline font-semibold flex items-center gap-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Forgot current password?</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showCurrentPass ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter your current password"
                        className="input pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-forest p-1 rounded"
                        aria-label={
                          showCurrentPass ? "Hide password" : "Show password"
                        }
                      >
                        {showCurrentPass ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* New Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-forest">
                      New Password
                    </label>
                    <button
                      type="button"
                      onClick={handleSuggestPassphrase}
                      className="inline-flex items-center gap-1 text-xs text-green hover:underline font-medium"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Suggest secure passphrase</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showNewPass ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 15 characters"
                      className="input pr-16 font-mono text-xs sm:text-sm"
                      required
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-dim">
                      {newPassword && (
                        <button
                          type="button"
                          onClick={handleCopyPassphrase}
                          className="p-1 hover:text-forest rounded"
                          title="Copy to clipboard"
                        >
                          {copiedPassphrase ? (
                            <Check className="w-3.5 h-3.5 text-green" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="p-1 hover:text-forest rounded"
                        aria-label={
                          showNewPass ? "Hide password" : "Show password"
                        }
                      >
                        {showNewPass ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* NIST Validator */}
                  <NistPasswordValidator
                    analysis={nistAnalysis}
                    passwordLength={newPassword.length}
                    easyReadMode={easyReadMode}
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold text-forest mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your new password"
                      className="input pr-10 font-mono text-xs sm:text-sm"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-forest p-1 rounded"
                      aria-label={
                        showConfirmPass ? "Hide password" : "Show password"
                      }
                    >
                      {showConfirmPass ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && (
                    <p
                      className={`text-xs mt-1 font-medium ${
                        isPassMatch ? "text-green" : "text-red-600"
                      }`}
                    >
                      {isPassMatch
                        ? "✓ Passwords match"
                        : "✕ Passwords do not match"}
                    </p>
                  )}
                </div>

                {/* Revoke other sessions checkbox */}
                <div className="p-3 rounded-lg border border-sand bg-cream/50">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={revokeOthersOnChange}
                      onChange={(e) =>
                        setRevokeOthersOnChange(e.target.checked)
                      }
                      className="mt-0.5 rounded text-green focus:ring-green accent-forest"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-forest">
                        Sign out other devices and active sessions
                      </p>
                      <p className="text-dim mt-0.5">
                        Revokes all previous session tokens while keeping you
                        signed in on this browser.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Submit button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={!canSubmitPassChange}
                    className="btn btn-forest py-2.5 px-6 text-xs flex items-center gap-2"
                  >
                    {savingPassword ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Password…</span>
                      </>
                    ) : (
                      <>
                        <span>Update Password</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* 2. PROPER & SECURE FORGOT PASSWORD CARD */}
            <div className="panel p-6 border border-sand bg-gradient-to-br from-cream/90 to-white shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-green/10 text-green flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="font-heading text-base font-bold text-forest">
                      Forgot Your Current Password?
                    </h3>
                    <p className="text-xs text-dim mt-1 max-w-xl leading-relaxed">
                      Don't recall your current password? Trigger a secure,
                      time-limited 6-digit OTP code sent directly to{" "}
                      <span className="font-semibold text-forest">
                        {maskEmail(user?.email || "")}
                      </span>
                      . You can verify your identity and set a fresh password
                      without logging out.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(true)}
                  className="btn btn-outline py-2.5 px-5 text-xs flex items-center gap-2 flex-shrink-0 font-semibold"
                >
                  <Mail className="w-4 h-4 text-green" />
                  <span>Send Reset Code</span>
                </button>
              </div>
            </div>

            {/* 3. Connected Authentication Providers */}
            <div className="panel p-6 border border-sand bg-white shadow-xs space-y-4">
              <h2 className="font-heading text-lg font-bold text-forest">
                Connected Accounts
              </h2>
              <p className="text-xs text-dim">
                Manage external identity providers linked to your Flux profile.
              </p>

              <div className="space-y-3 pt-1">
                {/* Google Provider Card */}
                <div className="flex items-center justify-between p-3.5 rounded-lg border border-sand bg-cream/40">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white border border-sand flex items-center justify-center shadow-2xs">
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-forest">
                        Google Account
                      </p>
                      <p className="text-[11px] text-dim">
                        {user?.firebaseUid || user?.provider === "google"
                          ? "Connected to " + user.email
                          : "Not linked yet"}
                      </p>
                    </div>
                  </div>

                  {user?.firebaseUid || user?.provider === "google" ? (
                    <span className="text-xs font-semibold text-green flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Connected</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectGoogle}
                      disabled={connectingGoogle}
                      className="btn btn-outline py-1.5 px-3 text-xs"
                    >
                      {connectingGoogle ? "Connecting…" : "Connect Google"}
                    </button>
                  )}
                </div>

                {/* Email & Password */}
                <div className="flex items-center justify-between p-3.5 rounded-lg border border-sand bg-cream/40">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white border border-sand flex items-center justify-center shadow-2xs text-forest">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-forest">
                        Direct Email Authentication
                      </p>
                      <p className="text-[11px] text-dim">
                        {user?.hasPassword
                          ? "Secured with salted scrypt hashing"
                          : "No password configured yet"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-green flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Active</span>
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Active Device Sessions */}
            <div className="panel p-6 border border-sand bg-white shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-heading text-lg font-bold text-forest">
                    Active Devices & Sessions
                  </h2>
                  <p className="text-xs text-dim">
                    Devices currently signed into your Flux account.
                  </p>
                </div>

                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={handleRevokeOtherSessions}
                    disabled={revokingAllOthers}
                    className="btn btn-outline text-xs py-2 px-3.5 text-dim hover:text-red-700"
                  >
                    {revokingAllOthers ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <LogOut className="w-3.5 h-3.5" />
                    )}
                    <span>Sign out all other devices</span>
                  </button>
                )}
              </div>

              {sessionsLoading ? (
                <div className="py-6 text-center text-xs text-dim flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-green" />
                  <span>Loading device sessions…</span>
                </div>
              ) : (
                <div className="space-y-2.5 pt-1">
                  {sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className={`flex items-center justify-between p-3.5 rounded-lg border transition-all ${
                        sess.isCurrent
                          ? "border-green/40 bg-green/5"
                          : "border-sand bg-cream/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white border border-sand flex items-center justify-center text-dim flex-shrink-0">
                          {sess.device.toLowerCase().includes("iphone") ||
                          sess.device.toLowerCase().includes("android") ? (
                            <Smartphone className="w-4 h-4" />
                          ) : (
                            <Laptop className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-forest">
                              {sess.device}
                            </p>
                            {sess.isCurrent && (
                              <span className="text-[10px] font-bold bg-green/20 text-green px-2 py-0.2 rounded-full">
                                This device
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-dim">
                            Last active:{" "}
                            {new Date(sess.lastActive).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {!sess.isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleRevokeSession(sess.id)}
                          disabled={revokingSessionId === sess.id}
                          className="btn btn-ghost text-xs py-1 px-2.5 hover:text-red-700 hover:bg-red-50 rounded"
                        >
                          {revokingSessionId === sess.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <span>Revoke</span>
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────── */}
        {/* TAB 3: PREFERENCES                                        */}
        {/* ───────────────────────────────────────────────────────── */}
        {activeTab === "preferences" && (
          <div className="space-y-6 animate-fade-up">
            <div className="panel p-6 border border-sand bg-white shadow-xs space-y-5">
              <h2 className="font-heading text-lg font-bold text-forest">
                Reading & Display
              </h2>
              <p className="text-xs text-dim">
                Customize your reading comfort and accessibility settings across
                Flux.
              </p>

              <div className="p-4 rounded-lg border border-sand bg-cream/30 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-forest">
                    Easy Read Mode
                  </p>
                  <p className="text-xs text-dim mt-0.5">
                    Larger typography scale, higher contrast, and widened text
                    spacing designed for effortless reading.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleEasyRead}
                  className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer ${
                    easyReadMode ? "bg-green" : "bg-sand"
                  }`}
                  aria-pressed={easyReadMode}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-xs absolute top-0.5 transition-transform ${
                      easyReadMode ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="panel p-6 border border-sand bg-white shadow-xs space-y-5">
              <h2 className="font-heading text-lg font-bold text-forest">
                Notification Preferences
              </h2>
              <p className="text-xs text-dim">
                Choose what communications you receive from Flux.
              </p>

              <div className="space-y-3">
                {/* Security alerts */}
                <div className="p-4 rounded-lg border border-sand bg-cream/30 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-forest">
                        Security & Login Alerts
                      </p>
                      <span className="text-[10px] bg-green/15 text-green font-semibold px-2 py-0.2 rounded">
                        Required
                      </span>
                    </div>
                    <p className="text-xs text-dim mt-0.5">
                      Immediate notifications when your password changes or an
                      unrecognized device signs in.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={securityAlerts}
                    disabled
                    className="rounded text-green accent-forest opacity-60 cursor-not-allowed"
                  />
                </div>

                {/* Product announcements */}
                <div className="p-4 rounded-lg border border-sand bg-cream/30 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-forest">
                      Product Highlights & Features
                    </p>
                    <p className="text-xs text-dim mt-0.5">
                      Quarterly notes about new spaces, community tools, and
                      platform updates.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={productAnnouncements}
                    onChange={(e) => {
                      setProductAnnouncements(e.target.checked)
                      try {
                        localStorage.setItem(
                          "flux_pref_announcements",
                          String(e.target.checked),
                        )
                      } catch {
                        /* fallback */
                      }
                    }}
                    className="rounded text-green accent-forest cursor-pointer"
                  />
                </div>

                {/* Weekly digest */}
                <div className="p-4 rounded-lg border border-sand bg-cream/30 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-forest">
                      Weekly Feed Digest
                    </p>
                    <p className="text-xs text-dim mt-0.5">
                      A quiet Sunday summary of conversations in the spaces you
                      follow.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={weeklyDigest}
                    onChange={(e) => {
                      setWeeklyDigest(e.target.checked)
                      try {
                        localStorage.setItem(
                          "flux_pref_digest",
                          String(e.target.checked),
                        )
                      } catch {
                        /* fallback */
                      }
                    }}
                    className="rounded text-green accent-forest cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="panel p-6 border border-sand bg-white shadow-xs space-y-5">
              <h2 className="font-heading text-lg font-bold text-forest">
                Privacy & Discoverability
              </h2>
              <p className="text-xs text-dim">
                Manage how your profile appears to other members.
              </p>

              <div className="p-4 rounded-lg border border-sand bg-cream/30 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-forest">
                    Public Directory Listing
                  </p>
                  <p className="text-xs text-dim mt-0.5">
                    Allow people to discover your profile in public spaces and
                    creator recommendations.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={publicProfile}
                  onChange={(e) => {
                    setPublicProfile(e.target.checked)
                    try {
                      localStorage.setItem(
                        "flux_pref_public_profile",
                        String(e.target.checked),
                      )
                    } catch {
                      /* fallback */
                    }
                  }}
                  className="rounded text-green accent-forest cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────── */}
        {/* TAB 4: DANGER ZONE                                        */}
        {/* ───────────────────────────────────────────────────────── */}
        {activeTab === "danger" && (
          <div className="space-y-6 animate-fade-up">
            <div className="panel p-6 border border-red-200 bg-red-50/20 shadow-xs space-y-6">
              <div>
                <h2 className="font-heading text-lg font-bold text-red-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span>Account Danger Zone</span>
                </h2>
                <p className="text-xs text-red-800/80 mt-1">
                  Actions here affect your active login sessions and stored
                  account records. Please proceed carefully.
                </p>
              </div>

              {/* Sign out of current session */}
              <div className="p-4 rounded-lg border border-sand bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-forest">
                    Sign Out of This Device
                  </p>
                  <p className="text-xs text-dim mt-0.5">
                    End your current session safely on this browser.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="btn btn-outline py-2 px-4 text-xs font-semibold"
                >
                  Sign Out
                </button>
              </div>

              {/* Sign out of all devices */}
              <div className="p-4 rounded-lg border border-sand bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-forest">
                    Revoke All Device Sessions
                  </p>
                  <p className="text-xs text-dim mt-0.5">
                    Sign out of every device including phones, tablets, and
                    other computers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRevokeOtherSessions}
                  className="btn btn-outline py-2 px-4 text-xs font-semibold text-amber-800 border-amber-300 hover:bg-amber-50"
                >
                  Sign Out All Devices
                </button>
              </div>

              {/* Delete Account */}
              <div className="p-4 rounded-lg border border-red-300 bg-red-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-red-900">
                    Permanently Delete Flux Account
                  </p>
                  <p className="text-xs text-red-700/80 mt-0.5">
                    Irrevocably erase your profile, spaces, and active sessions.
                    This action cannot be undone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="btn bg-red-700 hover:bg-red-800 text-white border border-red-800 py-2 px-4 text-xs font-semibold"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── IN-PROFILE FORGOT PASSWORD MODAL ── */}
      <InProfileResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        userEmail={user?.email || ""}
        easyReadMode={easyReadMode}
        onPasswordUpdated={async () => {
          setIsResetModalOpen(false)
          const freshUser = await currentAccount()
          if (freshUser) setUser(freshUser)
          if (activeTab === "security") loadSessions()
        }}
      />

      {/* ── GOOGLE ACCOUNT LINK MODAL ── */}
      {googleAccountLink && (
        <GoogleAccountLinkModal
          accountLink={googleAccountLink}
          onCancel={() => setGoogleAccountLink(null)}
          onLinked={(linkedUser: UserAccount) => {
            setGoogleAccountLink(null)
            setUser(linkedUser)
            showToast({
              title: "Connected with Google",
              message: "Google account successfully linked to Flux.",
              type: "notice-green",
            })
          }}
        />
      )}

      {/* ── DELETE ACCOUNT CONFIRMATION MODAL ── */}
      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest/40 backdrop-blur-xs animate-fade-up"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-red-200 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-700 font-bold font-heading text-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span>Delete Account</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false)
                  setDeleteError(null)
                  setDeleteConfirmationText("")
                  setDeletePassword("")
                }}
                className="text-dim hover:text-forest p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-dim leading-relaxed">
              Are you sure you want to delete your Flux account? All of your
              data, profile identity, and active sessions will be permanently
              purged.
            </p>

            {deleteError && (
              <div className="p-2.5 rounded bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                {deleteError}
              </div>
            )}

            {user?.hasPassword && (
              <div>
                <label className="block text-xs font-semibold text-forest mb-1">
                  Enter your password
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Account password"
                  className="input"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-forest mb-1">
                Type <strong className="text-red-700">DELETE</strong> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="DELETE"
                className="input font-mono uppercase"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="btn btn-outline py-2 px-4 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={
                  deletingAccount ||
                  deleteConfirmationText.trim().toUpperCase() !== "DELETE" ||
                  (user?.hasPassword && !deletePassword)
                }
                className="btn bg-red-700 hover:bg-red-800 text-white border border-red-800 py-2 px-4 text-xs font-bold"
              >
                {deletingAccount ? "Deleting…" : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="border-t border-sand mt-12 bg-cream">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-dim">
          <FluxLogo />
          <p>© 2026 Flux, Inc. Calmer Social Architecture.</p>
        </div>
      </footer>
    </div>
  )
}
