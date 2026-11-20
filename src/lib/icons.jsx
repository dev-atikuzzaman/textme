// আইকন সেট — bkbbg অ্যাপের মতো ইমোজি-ভিত্তিক আইকন।
// আগে lucide-react থেকে ইম্পোর্ট হতো; এখন একই নামে (Trash2, X, Check …) এখান থেকে আসে,
// তাই কম্পোনেন্টের বাকি কোড (size, className, fill প্রপ) অপরিবর্তিত থাকে।
//
// আইকন বদলাতে চাইলে নিচের MAP-এ নামের পাশের ইমোজি পাল্টালেই হবে।
// glyph:true মানে সাধারণ টেক্সট-চিহ্ন (✓ ✕ ← …) — এগুলো রঙের ক্লাস (text-sky-400 ইত্যাদি) মানে।
import { createElement } from 'react'

const MAP = {
  // ── নেভিগেশন / অ্যাকশন (টেক্সট-চিহ্ন, রঙ মানে) ──
  X: { g: '✕', glyph: true },
  Check: { g: '✓', glyph: true },
  CheckCheck: { g: '✓✓', glyph: true, tight: true },
  ArrowLeft: { g: '←', glyph: true },
  ArrowUp: { g: '↑', glyph: true },
  ChevronUp: { g: '⌃', glyph: true },
  CornerDownRight: { g: '↳', glyph: true },
  ExternalLink: { g: '↗', glyph: true },
  MoreHorizontal: { g: '⋯', glyph: true },
  MoreVertical: { g: '⋮', glyph: true },
  Minimize2: { g: '⤡', glyph: true },
  Delete: { g: '⌫', glyph: true },
  RotateCcw: { g: '↺', glyph: true },
  AtSign: { g: '@', glyph: true },
  Send: { g: '➤', glyph: true },
  LayoutGrid: { g: '▦', glyph: true },
  // ── ইমোজি আইকন ──
  AlertCircle: { g: '⚠️' },
  Archive: { g: '🗄️' },
  ArchiveRestore: { g: '📤' },
  BadgeCheck: { g: '✅' },
  Ban: { g: '🚫' },
  BarChart3: { g: '📊' },
  Bell: { g: '🔔' },
  BellOff: { g: '🔕' },
  BellRing: { g: '🔔' },
  BookUser: { g: '📒' },
  Bookmark: { g: '🔖', fillable: true },
  BookmarkCheck: { g: '🔖' },
  Camera: { g: '📷' },
  CheckCircle2: { g: '✅' },
  Circle: { g: '🔴' },
  Clapperboard: { g: '🎬' },
  Clock: { g: '🕓' },
  Crown: { g: '👑' },
  Download: { g: '📥' },
  Eye: { g: '👁️' },
  EyeOff: { g: '🙈' },
  File: { g: '📄' },
  FileArchive: { g: '🗂️' },
  FileSpreadsheet: { g: '📊' },
  FileText: { g: '📄' },
  Film: { g: '🎞️' },
  Flag: { g: '🚩' },
  Globe: { g: '🌐' },
  Hand: { g: '👋' },
  Heart: { g: '❤️', off: '🤍', fillable: true },
  Home: { g: '🏠' },
  Image: { g: '🖼️' },
  ImageIcon: { g: '🖼️' },
  ImagePlus: { g: '🖼️' },
  Info: { g: 'ℹ️' },
  KeyRound: { g: '🔑' },
  Link2: { g: '🔗' },
  Loader2: { g: '🔄' },
  RefreshCw: { g: '🔄' },
  SwitchCamera: { g: '🔁' },
  Lock: { g: '🔒' },
  LockOpen: { g: '🔓' },
  LogOut: { g: '🚪' },
  Mail: { g: '✉️' },
  MailCheck: { g: '📬' },
  MessageCircle: { g: '💬' },
  Mic: { g: '🎤' },
  MicOff: { g: '🔇' },
  Music: { g: '🎵' },
  Paperclip: { g: '📎' },
  Pencil: { g: '✏️' },
  Phone: { g: '📞' },
  PhoneMissed: { g: '📵' },
  PhoneOff: { g: '📴' },
  Pin: { g: '📌' },
  PinOff: { g: '📍' },
  Play: { g: '▶️' },
  PlaySquare: { g: '▶️' },
  Youtube: { g: '▶️' },
  Plus: { g: '➕' },
  PowerOff: { g: '🔌' },
  Presentation: { g: '📽️' },
  Search: { g: '🔍' },
  Settings2: { g: '⚙️' },
  Share2: { g: '📤' },
  ShieldOff: { g: '🛡️' },
  Smile: { g: '😊' },
  Square: { g: '⏹️' },
  ThumbsUp: { g: '👍' },
  Trash2: { g: '🗑️' },
  Type: { g: '🔤' },
  Undo2: { g: '↩️' },
  User: { g: '👤' },
  UserRound: { g: '👤' },
  UserCheck: { g: '✅' },
  UserPlus: { g: '👤➕', tight: true },
  UserX: { g: '🙅' },
  Users: { g: '👥' },
  UsersRound: { g: '👥' },
  Video: { g: '🎥' },
  VideoOff: { g: '🚫' },
  Volume2: { g: '🔊' },
  VolumeX: { g: '🔇' },
  ZoomIn: { g: '🔎' },
  ZoomOut: { g: '🔍' },
}

// size প্রপ না থাকলে Tailwind-এর w-N / h-N / size-N ক্লাস থেকে মাপ বের করি (১ ইউনিট = ৪px)
function sizeFrom(size, className = '') {
  if (size != null) return Number(size) || 20
  const m = /(?:^|\s)(?:size|w|h)-(\d+(?:\.\d+)?)(?:\s|$)/.exec(className)
  return m ? parseFloat(m[1]) * 4 : 20
}

function make(name, def) {
  const Icon = ({ size, className = '', style, fill, stroke, strokeWidth, color, absoluteStrokeWidth, ...rest }) => {
    const px = sizeFrom(size, className)
    const active = fill != null ? fill !== 'none' : /(?:^|\s)fill-/.test(className)
    let g = def.g
    let extra = null
    if (def.fillable) {
      if (name === 'Heart' && !active) g = def.off
      if (name === 'Bookmark' && !active) extra = { filter: 'grayscale(1)', opacity: 0.6 }
    }
    return createElement(
      'span',
      {
        role: 'img',
        'aria-hidden': rest['aria-label'] ? undefined : 'true',
        ...rest,
        className: `inline-flex shrink-0 select-none items-center justify-center leading-none ${className}`,
        style: {
          width: def.tight ? 'auto' : px,
          minWidth: px,
          height: px,
          fontSize: def.glyph ? px * (def.tight ? 0.8 : 1) : px * 0.84,
          fontWeight: def.glyph ? 700 : undefined,
          letterSpacing: def.tight ? '-0.15em' : undefined,
          ...extra,
          ...style,
        },
      },
      g,
    )
  }
  Icon.displayName = name
  return Icon
}

const icons = Object.fromEntries(Object.entries(MAP).map(([k, v]) => [k, make(k, v)]))

export const {
  X, Check, CheckCheck, ArrowLeft, ArrowUp, ChevronUp, CornerDownRight, ExternalLink, MoreHorizontal, MoreVertical,
  Minimize2, Delete, RotateCcw, AtSign, Send, LayoutGrid, AlertCircle, Archive, ArchiveRestore, BadgeCheck, Ban,
  BarChart3, Bell, BellOff, BellRing, BookUser, Bookmark, BookmarkCheck, Camera, CheckCircle2, Circle, Clapperboard,
  Clock, Crown, Download, Eye, EyeOff, File, FileArchive, FileSpreadsheet, FileText, Film, Flag, Globe, Hand, Heart,
  Home, Image, ImageIcon, ImagePlus, Info, KeyRound, Link2, Loader2, RefreshCw, SwitchCamera, Lock, LockOpen, LogOut,
  Mail, MailCheck, MessageCircle, Mic, MicOff, Music, Paperclip, Pencil, Phone, PhoneMissed, PhoneOff, Pin, PinOff,
  Play, PlaySquare, Youtube, Plus, PowerOff, Presentation, Search, Settings2, Share2, ShieldOff, Smile, Square,
  ThumbsUp, Trash2, Type, Undo2, User, UserRound, UserCheck, UserPlus, UserX, Users, UsersRound, Video, VideoOff,
  Volume2, VolumeX, ZoomIn, ZoomOut,
} = icons
