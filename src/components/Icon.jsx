import React from "react";
import {
  Phone, MessageCircle, Clock, Mail, FileText, Cog,
  Car, Bike, Wrench, KeyRound, PlugZap, Headset,
  Users, HeartHandshake, PackageCheck, PhoneCall, ReceiptText, Truck,
  Check, ArrowRight, MapPin, ChevronLeft, ChevronRight,
  PackageSearch, Timer, Handshake, ShieldCheck, Cookie,
  Menu, X, Facebook, Instagram, Linkedin, ArrowUp,
} from "lucide-react";

/* Lucide icons keyed by the kebab-case names used across the kit. */
const ICONS = {
  phone: Phone,
  "message-circle": MessageCircle,
  clock: Clock,
  mail: Mail,
  "file-text": FileText,
  cog: Cog,
  car: Car,
  bike: Bike,
  wrench: Wrench,
  "key-round": KeyRound,
  "plug-zap": PlugZap,
  headset: Headset,
  users: Users,
  "heart-handshake": HeartHandshake,
  "package-check": PackageCheck,
  "phone-call": PhoneCall,
  "receipt-text": ReceiptText,
  truck: Truck,
  check: Check,
  "arrow-right": ArrowRight,
  "map-pin": MapPin,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "package-search": PackageSearch,
  timer: Timer,
  handshake: Handshake,
  "shield-check": ShieldCheck,
  cookie: Cookie,
  menu: Menu,
  x: X,
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  "arrow-up": ArrowUp,
};

export function Icon({ name, size = 18, color = "currentColor", strokeWidth = 2 }) {
  const C = ICONS[name];
  if (!C) return null;
  return (
    <span style={{ display: "inline-flex", lineHeight: 0 }}>
      <C size={size} color={color} strokeWidth={strokeWidth} />
    </span>
  );
}
